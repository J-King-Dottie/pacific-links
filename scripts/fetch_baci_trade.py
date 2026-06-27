"""
Fetch and process BACI (CEPII) reconciled bilateral trade data for Pacific islands.

BACI is pre-reconciled from both importer- and exporter-reported UN Comtrade data,
eliminating outliers and transshipment distortions. Free, no registration required.

Usage:
  python fetch_baci_trade.py              # run all phases
  python fetch_baci_trade.py --phase download
  python fetch_baci_trade.py --phase extract
  python fetch_baci_trade.py --phase combine
  python fetch_baci_trade.py --phase exports

See BACI_INGEST_PLAN.md for full documentation.
"""

import argparse
import csv
import io
import json
import os
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# To pull a newer BACI release, bump BACI_VERSION to the version CEPII publishes
# (see https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37) and
# keep BACI_VERSION in sync with scripts/normalize_for_dashboard.py. Everything
# else (URL, ZIP path, country-code file) is derived from it.
BACI_VERSION = "HS92_V202601"
BACI_URL  = f"https://www.cepii.fr/DATA_DOWNLOAD/baci/data/BACI_{BACI_VERSION}.zip"
YEARS     = list(range(2010, 2025))  # clipped to 2010-2024 downstream; latest year may be absent upstream

ROOT_DIR  = Path(__file__).parent.parent
RAW_DIR   = ROOT_DIR / "data" / "raw"
BACI_DIR  = RAW_DIR / "baci"
ZIP_PATH  = BACI_DIR / f"BACI_{BACI_VERSION}.zip"
CKPT_PATH = BACI_DIR / "checkpoint.json"
OUT_PATH  = RAW_DIR / "baci_imports.csv"
EXPORTS_OUT_PATH = RAW_DIR / "baci_exports.csv"

BACI_DIR.mkdir(parents=True, exist_ok=True)

# Pacific island M49 codes we care about (importer = j column in BACI)
PACIFIC_M49 = {
    "16": "AS",  "90": "SB",  "184": "CK", "242": "FJ",  "258": "PF",
    "296": "KI", "316": "GU", "520": "NR", "548": "VU",  "570": "NU",
    "580": "MP", "583": "FM", "584": "MH", "585": "PW",  "598": "PG",
    "776": "TO", "772": "TK", "798": "TV", "876": "WF",  "882": "WS",
}

PACIFIC_NAMES = {
    "AS": "American Samoa", "SB": "Solomon Islands", "CK": "Cook Islands",
    "FJ": "Fiji",           "PF": "French Polynesia","KI": "Kiribati",
    "GU": "Guam",           "NR": "Nauru",           "VU": "Vanuatu",
    "NU": "Niue",           "MP": "Northern Mariana Islands",
    "FM": "Micronesia",     "MH": "Marshall Islands","PW": "Palau",
    "PG": "Papua New Guinea","TO": "Tonga",          "TK": "Tokelau",
    "TV": "Tuvalu",         "WF": "Wallis and Futuna","WS": "Samoa",
}

HS1_NAMES = {
    "0": "Animal and vegetable products",
    "1": "Foodstuffs",
    "2": "Mineral products",
    "3": "Chemicals and allied industries",
    "4": "Plastics and rubber",
    "5": "Raw hides, skins, leather and wood",
    "6": "Textiles and footwear",
    "7": "Stone, glass and metals",
    "8": "Machinery and electrical",
    "9": "Miscellaneous manufactured goods",
}

M49_TO_NAME = {
    "4": "Afghanistan", "8": "Albania", "12": "Algeria", "16": "American Samoa",
    "24": "Angola", "32": "Argentina", "36": "Australia", "40": "Austria",
    "50": "Bangladesh", "56": "Belgium", "68": "Bolivia", "76": "Brazil",
    "90": "Solomon Islands", "100": "Bulgaria", "104": "Myanmar", "116": "Cambodia",
    "124": "Canada", "144": "Sri Lanka", "152": "Chile", "156": "China",
    "158": "Taiwan", "170": "Colombia", "184": "Cook Islands", "188": "Costa Rica",
    "191": "Croatia", "196": "Cyprus", "203": "Czechia", "208": "Denmark",
    "214": "Dominican Republic", "218": "Ecuador", "222": "El Salvador",
    "233": "Estonia", "242": "Fiji", "246": "Finland", "250": "France",
    "258": "French Polynesia", "276": "Germany", "288": "Ghana", "296": "Kiribati",
    "300": "Greece", "316": "Guam", "320": "Guatemala", "324": "Guinea",
    "332": "Haiti", "340": "Honduras", "344": "Hong Kong", "348": "Hungary",
    "356": "India", "360": "Indonesia", "364": "Iran", "368": "Iraq",
    "372": "Ireland", "376": "Israel", "380": "Italy", "384": "Cote d'Ivoire",
    "388": "Jamaica", "392": "Japan", "398": "Kazakhstan", "400": "Jordan",
    "404": "Kenya", "410": "South Korea", "414": "Kuwait", "418": "Laos",
    "422": "Lebanon", "426": "Lesotho", "428": "Latvia", "430": "Liberia",
    "440": "Lithuania", "442": "Luxembourg", "450": "Madagascar", "454": "Malawi",
    "458": "Malaysia", "466": "Mali", "478": "Mauritania", "480": "Mauritius",
    "484": "Mexico", "496": "Mongolia", "504": "Morocco", "508": "Mozambique",
    "516": "Namibia", "520": "Nauru", "524": "Nepal", "528": "Netherlands",
    "548": "Vanuatu", "554": "New Zealand", "558": "Nicaragua", "562": "Niger",
    "566": "Nigeria", "570": "Niue", "578": "Norway", "580": "Northern Mariana Islands",
    "583": "Micronesia", "584": "Marshall Islands", "585": "Palau", "586": "Pakistan",
    "591": "Panama", "598": "Papua New Guinea", "604": "Peru", "608": "Philippines",
    "616": "Poland", "620": "Portugal", "630": "Puerto Rico", "634": "Qatar",
    "642": "Romania", "643": "Russia", "682": "Saudi Arabia", "686": "Senegal",
    "703": "Slovakia", "705": "Slovenia", "710": "South Africa", "716": "Zimbabwe",
    "724": "Spain", "752": "Sweden", "756": "Switzerland", "764": "Thailand",
    "772": "Tokelau", "776": "Tonga", "784": "United Arab Emirates", "788": "Tunisia",
    "792": "Turkey", "798": "Tuvalu", "800": "Uganda", "804": "Ukraine",
    "826": "United Kingdom", "834": "Tanzania", "840": "United States",
    "858": "Uruguay", "860": "Uzbekistan", "862": "Venezuela", "876": "Wallis and Futuna",
    "882": "Samoa", "887": "Yemen", "894": "Zambia",
}

# Comprehensive M49→ISO2 for trade partners (extend as needed)
M49_TO_ISO2 = {
    "4": "AF",   "8": "AL",   "12": "DZ",  "24": "AO",  "32": "AR",
    "36": "AU",  "40": "AT",  "50": "BD",  "56": "BE",  "68": "BO",
    "76": "BR",  "100": "BG", "104": "MM", "116": "KH", "124": "CA",
    "144": "LK", "152": "CL", "156": "CN", "158": "TW", "170": "CO",
    "188": "CR", "191": "HR", "196": "CY", "203": "CZ", "208": "DK",
    "214": "DO", "218": "EC", "818": "EG", "222": "SV", "233": "EE",
    "246": "FI", "250": "FR", "276": "DE", "288": "GH", "300": "GR",
    "320": "GT", "332": "HT", "340": "HN", "344": "HK", "348": "HU",
    "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE",
    "376": "IL", "380": "IT", "388": "JM", "392": "JP", "400": "JO",
    "398": "KZ", "404": "KE", "410": "KR", "414": "KW", "418": "LA",
    "422": "LB", "428": "LV", "440": "LT", "442": "LU", "458": "MY",
    "484": "MX", "504": "MA", "528": "NL", "554": "NZ", "566": "NG",
    "578": "NO", "586": "PK", "591": "PA", "604": "PE", "608": "PH",
    "616": "PL", "620": "PT", "630": "PR", "634": "QA", "642": "RO",
    "643": "RU", "682": "SA", "686": "SN", "703": "SK", "705": "SI",
    "710": "ZA", "724": "ES", "752": "SE", "756": "CH", "764": "TH",
    "788": "TN", "792": "TR", "784": "AE", "804": "UA", "826": "GB",
    "840": "US", "858": "UY", "862": "VE", "704": "VN", "887": "YE",
    "716": "ZW", "894": "ZM", "454": "MW", "466": "ML", "478": "MR",
    "508": "MZ", "516": "NA", "524": "NP", "558": "NI", "562": "NE",
    "288": "GH", "324": "GN", "384": "CI", "426": "LS", "430": "LR",
    "450": "MG", "480": "MU", "496": "MN", "800": "UG", "834": "TZ",
    "860": "UZ", "112": "BY", "756": "CH", "191": "HR",
    # Pacific islands themselves (as exporters in some flows)
    **PACIFIC_M49,
}

# ---------------------------------------------------------------------------
# Checkpoint helpers
# ---------------------------------------------------------------------------

def load_ckpt():
    if CKPT_PATH.exists():
        return json.loads(CKPT_PATH.read_text())
    return {"download_done": False, "extracted_years": [], "combine_done": False}

def save_ckpt(ckpt):
    CKPT_PATH.write_text(json.dumps(ckpt, indent=2))


def supplier_name_for(i_m49, supplier_iso2):
    if supplier_iso2 in PACIFIC_NAMES:
        return PACIFIC_NAMES[supplier_iso2]
    return M49_TO_NAME.get(i_m49, supplier_iso2 or i_m49)


def load_baci_country_codes():
    """Return BACI's authoritative numeric-code to ISO2/name mapping."""
    # Country-code file is named with the release suffix, e.g. country_codes_V202601.csv
    cc_name = f"country_codes_{BACI_VERSION.split('_')[-1]}.csv"
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        with zf.open(cc_name) as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))
            return {
                row["country_code"].strip(): {
                    "iso2": row["country_iso2"].strip(),
                    "name": row["country_name"].strip(),
                }
                for row in reader
            }


def process_year(year):
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        names = zf.namelist()
        candidates = [n for n in names if f"_Y{year}_" in n and n.endswith(".csv")]
        if not candidates:
            return {"year": year, "status": "missing", "rows_written": 0}

        fname = candidates[0]
        out_path = BACI_DIR / f"filtered_{year}.csv"
        rows_written = 0

        with zf.open(fname) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8")
            reader = csv.DictReader(text)
            with open(out_path, "w", newline="", encoding="utf-8") as fout:
                writer = csv.writer(fout)
                writer.writerow(["year", "importer_m49", "exporter_m49", "hs1_code", "hs1_name", "value_usd"])
                agg = {}
                for row in reader:
                    j = row["j"].strip()
                    if j not in PACIFIC_M49:
                        continue
                    i = row["i"].strip()
                    hs6 = row["k"].strip().zfill(6)
                    hs1 = hs6[0]
                    val = float(row["v"] or 0) * 1000
                    key = (j, i, hs1)
                    agg[key] = agg.get(key, 0) + val

                for (j, i, hs1), val in sorted(agg.items()):
                    writer.writerow([year, j, i, hs1, HS1_NAMES.get(hs1, hs1), round(val, 2)])
                    rows_written += 1

        return {
            "year": year, "status": "ok", "rows_written": rows_written,
            "file": fname,
        }

# ---------------------------------------------------------------------------
# Phase 1: Download
# ---------------------------------------------------------------------------

def phase_download():
    ckpt = load_ckpt()
    if ckpt.get("download_done"):
        print("Phase 1: ZIP already downloaded, skipping.")
        return

    print(f"Phase 1: Downloading {BACI_URL}")
    print(f"  → {ZIP_PATH}")

    existing = ZIP_PATH.stat().st_size if ZIP_PATH.exists() else 0
    headers  = {"Range": f"bytes={existing}-"} if existing else {}

    with requests.get(BACI_URL, headers=headers, stream=True, timeout=60) as r:
        total = int(r.headers.get("Content-Length", 0)) + existing
        mode  = "ab" if existing else "wb"
        downloaded = existing

        with open(ZIP_PATH, mode) as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    pct = downloaded / total * 100 if total else 0
                    print(f"\r  {downloaded/1e6:.1f} MB / {total/1e6:.1f} MB  ({pct:.1f}%)", end="", flush=True)

    print(f"\n  Done. {ZIP_PATH.stat().st_size/1e6:.1f} MB")
    ckpt["download_done"] = True
    save_ckpt(ckpt)

# ---------------------------------------------------------------------------
# Phase 2: Extract & filter to Pacific islands
# ---------------------------------------------------------------------------

def phase_extract(force=False):
    ckpt = load_ckpt()
    if not ckpt.get("download_done"):
        sys.exit("Phase 2: ZIP not downloaded yet. Run --phase download first.")

    done_years = set() if force else set(ckpt.get("extracted_years", []))
    todo = [y for y in YEARS if y not in done_years]
    if not todo:
        print("Phase 2: All years already extracted, skipping.")
        return

    workers = min(max(1, (os.cpu_count() or 2) - 1), len(todo))
    print(f"Phase 2: Extracting years {todo} from ZIP with {workers} workers...")

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_year, year): year for year in todo}
        for future in as_completed(futures):
            result = future.result()
            year = result["year"]
            if result["status"] == "missing":
                print(f"  {year}: not found in ZIP, skipping")
            else:
                print(f"  {year}: {result['rows_written']} HS1 rows")
            done_years.add(year)
            ckpt["extracted_years"] = sorted(done_years)
            save_ckpt(ckpt)

    print("Phase 2: Done.")

# ---------------------------------------------------------------------------
# Phase 3: Combine into final CSV
# ---------------------------------------------------------------------------

def phase_combine():
    ckpt = load_ckpt()
    missing = [y for y in YEARS if y not in ckpt.get("extracted_years", [])]
    if missing:
        print(f"Warning: years {missing} not yet extracted — they will be absent from output.")

    print(f"Phase 3: Combining into {OUT_PATH} ...")

    fieldnames = [
        "reporter_code", "reporter_name", "supplier_code", "supplier_name",
        "year", "hs1_code", "hs1_name", "value_usd",
    ]
    total_rows = 0
    skipped_non_country_rows = 0
    country_codes = load_baci_country_codes()

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as fout:
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        for year in YEARS:
            fpath = BACI_DIR / f"filtered_{year}.csv"
            if not fpath.exists():
                continue
            for row in csv.DictReader(open(fpath, encoding="utf-8")):
                j_m49 = row["importer_m49"]
                i_m49 = row["exporter_m49"]
                reporter_iso2 = PACIFIC_M49.get(j_m49, "")
                supplier = country_codes.get(i_m49, {})
                supplier_iso2 = supplier.get("iso2", "")
                if not reporter_iso2:
                    continue
                if not supplier_iso2:
                    skipped_non_country_rows += 1
                    continue
                writer.writerow({
                    "reporter_code": reporter_iso2,
                    "reporter_name": PACIFIC_NAMES.get(reporter_iso2, reporter_iso2),
                    "supplier_code": supplier_iso2 or i_m49,
                    "supplier_name": PACIFIC_NAMES.get(supplier_iso2, supplier.get("name", supplier_iso2)),
                    "year":          row["year"],
                    "hs1_code":      row["hs1_code"],
                    "hs1_name":      row["hs1_name"],
                    "value_usd":     row["value_usd"],
                })
                total_rows += 1

    print(f"  {total_rows} rows written to {OUT_PATH}")
    print(f"  {skipped_non_country_rows} non-country aggregate rows omitted")
    ckpt["combine_done"] = True
    save_ckpt(ckpt)
    print("Phase 3: Done.")


def phase_exports():
    ckpt = load_ckpt()
    if not ckpt.get("download_done"):
        sys.exit("Exports: ZIP not downloaded yet. Run --phase download first.")

    print(f"Exports: Building {EXPORTS_OUT_PATH} ...")
    country_codes = load_baci_country_codes()
    fieldnames = [
        "reporter_code", "reporter_name", "destination_code", "destination_name",
        "year", "hs1_code", "hs1_name", "value_usd",
    ]
    total_rows = 0
    skipped_non_country_rows = 0

    with open(EXPORTS_OUT_PATH, "w", newline="", encoding="utf-8") as fout:
        writer = csv.DictWriter(fout, fieldnames=fieldnames)
        writer.writeheader()

        with zipfile.ZipFile(ZIP_PATH, "r") as zf:
            names = zf.namelist()
            for year in YEARS:
                candidates = [n for n in names if f"_Y{year}_" in n and n.endswith(".csv")]
                if not candidates:
                    continue

                agg = {}
                fname = candidates[0]
                with zf.open(fname) as raw:
                    text = io.TextIOWrapper(raw, encoding="utf-8")
                    reader = csv.DictReader(text)
                    for row in reader:
                        i = row["i"].strip()
                        if i not in PACIFIC_M49:
                            continue
                        j = row["j"].strip()
                        hs6 = row["k"].strip().zfill(6)
                        hs1 = hs6[0]
                        val = float(row["v"] or 0) * 1000
                        key = (i, j, hs1)
                        agg[key] = agg.get(key, 0) + val

                for (i, j, hs1), val in sorted(agg.items()):
                    pacific_iso2 = PACIFIC_M49.get(i, "")
                    destination = country_codes.get(j, {})
                    destination_iso2 = destination.get("iso2", "")
                    if not pacific_iso2:
                        continue
                    if not destination_iso2:
                        skipped_non_country_rows += 1
                        continue
                    writer.writerow({
                        "reporter_code": pacific_iso2,
                        "reporter_name": PACIFIC_NAMES.get(pacific_iso2, pacific_iso2),
                        "destination_code": destination_iso2,
                        "destination_name": PACIFIC_NAMES.get(destination_iso2, destination.get("name", destination_iso2)),
                        "year": year,
                        "hs1_code": hs1,
                        "hs1_name": HS1_NAMES.get(hs1, hs1),
                        "value_usd": round(val, 2),
                    })
                    total_rows += 1

                print(f"  {year}: {len(agg)} HS1 export rows")

    print(f"  {total_rows} rows written to {EXPORTS_OUT_PATH}")
    print(f"  {skipped_non_country_rows} non-country aggregate rows omitted")
    ckpt["exports_done"] = True
    save_ckpt(ckpt)
    print("Exports: Done.")

# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=["download", "extract", "combine", "exports"], default=None)
    parser.add_argument("--force", action="store_true", help="reprocess completed extraction years")
    args = parser.parse_args()

    if args.phase == "download" or args.phase is None:
        phase_download()
    if args.phase == "extract" or args.phase is None:
        phase_extract(force=args.force)
    if args.phase == "combine" or args.phase is None:
        phase_combine()
    if args.phase == "exports" or args.phase is None:
        phase_exports()
