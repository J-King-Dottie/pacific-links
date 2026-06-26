"""
Fetch World Bank International Debt Statistics creditor-level public debt.

Output:
  data/processed/debt_by_creditor_year.csv

Metric definition:
  External debt stocks, public and publicly guaranteed (PPG), current US$.

IDS coverage is partial for our Pacific set. As of this script, IDS has debtor
coverage for FJ, FM, PG, SB, TO, VU, and WS. Other Pacific countries need local
source extraction if we want a complete debt layer.
"""

import csv
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import wbgapi as wb

try:
    import pycountry
except ImportError:  # pragma: no cover - optional fallback
    pycountry = None

ROOT = Path(__file__).parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_PATH = ROOT / "data" / "processed" / "debt_by_creditor_year.csv"
PARTS_DIR = ROOT / "data" / "processed" / "ids_debt_parts"

IDS_DB = 6
PPG_STOCK = "DT.DOD.DPPG.CD"
YEARS = range(2010, 2025)

DEBTORS = {
    "FJI": ("FJ", "Fiji"),
    "FSM": ("FM", "Micronesia (FSM)"),
    "PNG": ("PG", "Papua New Guinea"),
    "SLB": ("SB", "Solomon Islands"),
    "TON": ("TO", "Tonga"),
    "VUT": ("VU", "Vanuatu"),
    "WSM": ("WS", "Samoa"),
}

FOCUSED_COUNTERPARTS = {
    "730": "China",
    "701": "Japan",
    "801": "Australia",
    "820": "New Zealand",
    "302": "United States",
    "004": "France",
    "905": "World Bank-IDA",
    "901": "World Bank-IBRD",
    "915": "Asian Dev. Bank",
    "907": "International Monetary Fund",
    "919": "European Investment Bank",
}

# World Bank IDS counterpart names are not always modern ISO names, so keep
# explicit mappings for important Pacific creditors and common variants.
COUNTERPART_ISO2_OVERRIDES = {
    "Australia": "AU",
    "China": "CN",
    "Fiji": "FJ",
    "Japan": "JP",
    "New Zealand": "NZ",
    "United States": "US",
    "United Kingdom": "GB",
    "Germany, Fed. Rep. of": "DE",
    "Korea, Republic of": "KR",
    "Korea, D.P.R. of": "KP",
    "Russian Federation": "RU",
    "Micronesia Fed Sts": "FM",
    "Papua New Guinea": "PG",
    "Solomon Islands": "SB",
    "Tonga": "TO",
    "Samoa": "WS",
    "Vanuatu": "VU",
}

NON_COUNTRY_HINTS = (
    "bank", "fund", "association", "organization", "programme", "commission",
    "community", "union", "facility", "bondholders", "multiple lenders",
    "world", "imf", "ida", "ibrd", "ifc", "adb",
)

FIELDNAMES = [
    "recipient_code", "recipient_name", "creditor_code", "creditor_name",
    "ids_debtor_code", "ids_creditor_code", "year", "value_usd", "pct_gdp",
]


def load_gdp():
    path = RAW_DIR / "worldbank_gdp_pop.csv"
    lookup = {}
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("gdp_usd"):
                lookup[(row["iso2"], int(row["year"]))] = float(row["gdp_usd"])
    return lookup


def best_gdp(gdp, iso2, year):
    if (iso2, year) in gdp:
        return gdp[(iso2, year)]
    for delta in range(1, 4):
        for candidate in (year - delta, year + delta):
            if (iso2, candidate) in gdp:
                return gdp[(iso2, candidate)]
    return None


def get_counterparts(focused=True):
    if focused:
        return list(FOCUSED_COUNTERPARTS.items())

    url = "https://api.worldbank.org/v2/sources/6/counterpart-area/all?per_page=500&format=json"
    with urllib.request.urlopen(url, timeout=30) as response:
        data = json.loads(response.read())
    variables = data["source"][0]["concept"][0]["variable"]
    return [(v["id"], v["value"].strip()) for v in variables if v["id"] != "WLD"]


def clean_name(name):
    return re.sub(r"\s+", " ", name).strip()


def iso2_for_counterpart(name):
    name = clean_name(name)
    if name in COUNTERPART_ISO2_OVERRIDES:
        return COUNTERPART_ISO2_OVERRIDES[name]
    lowered = name.lower()
    if any(hint in lowered for hint in NON_COUNTRY_HINTS):
        return None
    if not pycountry:
        return None
    try:
        country = pycountry.countries.lookup(name)
        return country.alpha_2
    except LookupError:
        return None


def fetch_chunk(debtor, counterpart_ids, attempt=1):
    try:
        return wb.data.DataFrame(
            {PPG_STOCK: "debt_stock_usd"},
            economy=[debtor],
            counterpart_area=counterpart_ids,
            time=YEARS,
            db=IDS_DB,
            labels=True,
        ).reset_index()
    except Exception:
        if attempt < 3:
            time.sleep(1.5 * attempt)
            return fetch_chunk(debtor, counterpart_ids, attempt + 1)
        if len(counterpart_ids) == 1:
            return None
        rows = []
        for cid in counterpart_ids:
            df = fetch_chunk(debtor, [cid], attempt=1)
            if df is not None:
                rows.append(df)
        if not rows:
            return None
        import pandas as pd
        return pd.concat(rows, ignore_index=True)


def load_existing_rows():
    if not OUT_PATH.exists():
        return []
    with open(OUT_PATH, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_rows(rows):
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(rows, key=lambda r: (
        r["recipient_code"],
        r["creditor_name"],
        int(r["year"]),
    ))
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def write_part(debtor_iso3, rows):
    PARTS_DIR.mkdir(parents=True, exist_ok=True)
    part_path = PARTS_DIR / f"{debtor_iso3}.csv"
    with open(part_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda r: (r["creditor_name"], int(r["year"]))))
    return part_path


def fetch_debtor(debtor_iso3, debtor_iso2, debtor_name, gdp, counterparts, counterpart_names):
    rows = []
    print(f"  Fetching {debtor_name}...")
    for start in range(0, len(counterparts), 25):
        chunk = [cid for cid, _ in counterparts[start:start + 25]]
        df = fetch_chunk(debtor_iso3, chunk)
        if df is None:
            continue

        year_cols = [col for col in df.columns if col.startswith("YR")]
        for _, record in df.iterrows():
            cid = str(record["counterpart_area"])
            cname = clean_name(record.get("Counterpart-Area") or counterpart_names.get(cid, cid))
            counterpart_code = iso2_for_counterpart(cname) or f"IDS_{cid}"

            for year_col in year_cols:
                value = record.get(year_col)
                if value is None or value != value or float(value) <= 0:
                    continue
                year = int(year_col.replace("YR", ""))
                denom = best_gdp(gdp, debtor_iso2, year)
                pct_gdp = round(float(value) / denom * 100, 4) if denom else None
                rows.append({
                    "recipient_code": debtor_iso2,
                    "recipient_name": debtor_name,
                    "creditor_code": counterpart_code,
                    "creditor_name": cname,
                    "ids_debtor_code": debtor_iso3,
                    "ids_creditor_code": cid,
                    "year": year,
                    "value_usd": round(float(value), 2),
                    "pct_gdp": pct_gdp,
                })
        part_path = write_part(debtor_iso3, rows)
        print(f"    chunk {start // 25 + 1}/{(len(counterparts) + 24) // 25}: {len(rows)} rows saved -> {part_path.name}")
    return rows


def main():
    use_all_creditors = "--all-creditors" in sys.argv[1:]
    requested = {arg.upper() for arg in sys.argv[1:] if not arg.startswith("--")}
    single_country_mode = len(requested) == 1
    gdp = load_gdp()
    counterparts = get_counterparts(focused=not use_all_creditors)
    counterpart_names = dict(counterparts)
    all_rows = load_existing_rows()

    completed = {r["ids_debtor_code"] for r in all_rows}
    if completed:
        print(f"  Resuming with completed debtors: {', '.join(sorted(completed))}")

    for debtor_iso3, (debtor_iso2, debtor_name) in DEBTORS.items():
        if requested and debtor_iso3 not in requested and debtor_iso2 not in requested:
            continue
        if debtor_iso3 in completed:
            print(f"  Skipping {debtor_name}; already saved")
            continue
        debtor_rows = fetch_debtor(debtor_iso3, debtor_iso2, debtor_name, gdp, counterparts, counterpart_names)
        if not debtor_rows:
            print(f"  No rows returned for {debtor_name}")
            continue
        if single_country_mode:
            part_path = write_part(debtor_iso3, debtor_rows)
            print(f"  Saved country part -> {part_path}")
            return
        all_rows = [r for r in all_rows if r["ids_debtor_code"] != debtor_iso3] + debtor_rows
        write_rows(all_rows)
        print(f"  Saved {len(debtor_rows)} {debtor_name} rows; total saved rows: {len(all_rows)}")


if __name__ == "__main__":
    print("Fetching World Bank IDS public debt by creditor...")
    main()
    print("Done.")
