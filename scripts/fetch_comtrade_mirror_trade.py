"""
Fetch UN Comtrade mirror trade data for Pacific islands.

Mirror approach: for each Pacific island, query ALL countries' reported exports
TO that island (flowCode=X, partnerCode=<pacific_M49>). No reporter filter —
the API returns every country that reported exports to that partner in that year.

Why mirror instead of PDH IMTS:
  PDH uses consignment/port attribution, inflating transit hubs (Singapore gets
  credited for re-exported fuel). Comtrade reporters use origin-based accounting,
  giving a truer picture of which countries actually supply Pacific imports.

API: UN Comtrade public preview — free, no key required.
  https://comtradeapi.un.org/public/v1/preview/C/A/HS

Saves incrementally: checkpoint JSON records completed island-year pairs so
restarts skip already-fetched data and append to the existing CSV.

Output: data/raw/comtrade_mirror_imports.csv
"""

import urllib.request
import json
import csv
import time
from pathlib import Path

BASE = Path(__file__).parent.parent
OUT_PATH        = BASE / "data" / "raw" / "comtrade_mirror_imports.csv"
CHECKPOINT_PATH = BASE / "data" / "raw" / "comtrade_mirror_imports.checkpoint.json"

API_URL = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"

YEARS = list(range(2010, 2024))  # 2010-2023

# Pacific ISO2 → (Comtrade M49 numeric, display name)
# M49 codes verified against UN Statistics Division M49 standard.
PACIFIC = {
    "FJ": (242, "Fiji"),
    "PG": (598, "Papua New Guinea"),
    "SB": (90,  "Solomon Islands"),
    "VU": (548, "Vanuatu"),
    "WS": (882, "Samoa"),
    "TO": (776, "Tonga"),
    "TV": (798, "Tuvalu"),
    "CK": (184, "Cook Islands"),
    "NU": (570, "Niue"),
    "PF": (258, "French Polynesia"),
    "WF": (876, "Wallis and Futuna"),
    "TK": (772, "Tokelau"),
    "AS": (16,  "American Samoa"),
    "KI": (296, "Kiribati"),
    "FM": (583, "Micronesia (FSM)"),
    "MH": (584, "Marshall Islands"),
    "PW": (585, "Palau"),
    "NR": (520, "Nauru"),
    "GU": (316, "Guam"),
    "MP": (580, "Northern Mariana Islands"),
}

# Comtrade M49 numeric → ISO2 + name.
# The preview API returns reporterISO/reporterDesc as null, so we map manually.
# Covers all reporters that appear in Pacific trade data; extend as needed.
M49_TO_ISO2 = {
    4:   ("AF", "Afghanistan"),
    8:   ("AL", "Albania"),
    12:  ("DZ", "Algeria"),
    24:  ("AO", "Angola"),
    32:  ("AR", "Argentina"),
    36:  ("AU", "Australia"),
    40:  ("AT", "Austria"),
    50:  ("BD", "Bangladesh"),
    56:  ("BE", "Belgium"),
    76:  ("BR", "Brazil"),
    100: ("BG", "Bulgaria"),
    116: ("KH", "Cambodia"),
    124: ("CA", "Canada"),
    152: ("CL", "Chile"),
    156: ("CN", "China"),
    170: ("CO", "Colombia"),
    191: ("HR", "Croatia"),
    196: ("CY", "Cyprus"),
    203: ("CZ", "Czechia"),
    208: ("DK", "Denmark"),
    218: ("EC", "Ecuador"),
    818: ("EG", "Egypt"),
    246: ("FI", "Finland"),
    251: ("FR", "France"),
    242: ("FJ", "Fiji"),
    276: ("DE", "Germany"),
    300: ("GR", "Greece"),
    344: ("HK", "Hong Kong"),
    348: ("HU", "Hungary"),
    356: ("IN", "India"),
    360: ("ID", "Indonesia"),
    364: ("IR", "Iran"),
    372: ("IE", "Ireland"),
    376: ("IL", "Israel"),
    380: ("IT", "Italy"),
    392: ("JP", "Japan"),
    400: ("JO", "Jordan"),
    398: ("KZ", "Kazakhstan"),
    404: ("KE", "Kenya"),
    410: ("KR", "Korea, Republic of"),
    414: ("KW", "Kuwait"),
    418: ("LA", "Lao PDR"),
    428: ("LV", "Latvia"),
    422: ("LB", "Lebanon"),
    440: ("LT", "Lithuania"),
    442: ("LU", "Luxembourg"),
    458: ("MY", "Malaysia"),
    484: ("MX", "Mexico"),
    504: ("MA", "Morocco"),
    516: ("NA", "Namibia"),
    528: ("NL", "Netherlands"),
    554: ("NZ", "New Zealand"),
    598: ("PG", "Papua New Guinea"),
    566: ("NG", "Nigeria"),
    578: ("NO", "Norway"),
    586: ("PK", "Pakistan"),
    608: ("PH", "Philippines"),
    616: ("PL", "Poland"),
    620: ("PT", "Portugal"),
    634: ("QA", "Qatar"),
    642: ("RO", "Romania"),
    643: ("RU", "Russia"),
    682: ("SA", "Saudi Arabia"),
    694: ("SL", "Sierra Leone"),
    703: ("SK", "Slovakia"),
    705: ("SI", "Slovenia"),
    90:  ("SB", "Solomon Islands"),
    710: ("ZA", "South Africa"),
    724: ("ES", "Spain"),
    144: ("LK", "Sri Lanka"),
    752: ("SE", "Sweden"),
    756: ("CH", "Switzerland"),
    702: ("SG", "Singapore"),
    158: ("TW", "Taiwan"),
    764: ("TH", "Thailand"),
    792: ("TR", "Turkey"),
    784: ("AE", "United Arab Emirates"),
    826: ("GB", "United Kingdom"),
    804: ("UA", "Ukraine"),
    842: ("US", "United States"),
    704: ("VN", "Viet Nam"),
    887: ("YE", "Yemen"),
    716: ("ZW", "Zimbabwe"),
    104: ("MM", "Myanmar"),
    524: ("NP", "Nepal"),
    52:  ("BB", "Barbados"),
    862: ("VE", "Venezuela"),
    499: ("ME", "Montenegro"),
    699: ("IN", "India"),   # Comtrade sometimes uses 699 for India
    490: ("TW", "Taiwan"),  # Comtrade sometimes uses 490 for Taiwan
}

FIELDNAMES = ["reporter_code", "reporter_name", "supplier_code", "supplier_name",
              "year", "import_value_usd"]


def load_checkpoint():
    if CHECKPOINT_PATH.exists():
        return set(json.loads(CHECKPOINT_PATH.read_text()))
    return set()


def save_checkpoint(done):
    CHECKPOINT_PATH.write_text(json.dumps(sorted(done)))


def fetch(partner_m49, year, retries=3):
    url = (
        f"{API_URL}?period={year}&flowCode=X"
        f"&partnerCode={partner_m49}&cmdCode=TOTAL"
        f"&motCode=0&customsCode=C00&partner2Code=0"
    )
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read())
        except Exception as e:
            if attempt == retries - 1:
                raise
            print(f"    retry {attempt+1} after error: {e}")
            time.sleep(2)


def main():
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    done = load_checkpoint()
    print(f"Checkpoint: {len(done)} island-year pairs already done")

    file_exists = OUT_PATH.exists() and OUT_PATH.stat().st_size > 0
    total = len(PACIFIC) * len(YEARS)
    n = 0

    with open(OUT_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        if not file_exists:
            writer.writeheader()

        for iso2, (m49, pac_name) in PACIFIC.items():
            for year in YEARS:
                n += 1
                key = f"{iso2}:{year}"
                if key in done:
                    print(f"  [{n}/{total}] {iso2} {year} — cached")
                    continue

                try:
                    data = fetch(m49, year)
                    rows = data.get("data", [])
                    written = 0
                    for row in rows:
                        rc = row.get("reporterCode")
                        val = row.get("primaryValue")
                        if rc is None or not val or rc == 0:
                            continue
                        iso2_sup, sup_name = M49_TO_ISO2.get(int(rc), (str(rc), f"M49:{rc}"))
                        writer.writerow({
                            "reporter_code":    iso2,
                            "reporter_name":    pac_name,
                            "supplier_code":    iso2_sup,
                            "supplier_name":    sup_name,
                            "year":             year,
                            "import_value_usd": val,
                        })
                        written += 1

                    f.flush()
                    done.add(key)
                    save_checkpoint(done)
                    print(f"  [{n}/{total}] {iso2} {year} — {written} suppliers (API count={data.get('count')})")

                except Exception as e:
                    print(f"  [{n}/{total}] {iso2} {year} — ERROR: {e}")

                time.sleep(0.35)

    print(f"\nDone. {OUT_PATH}")
    print(f"Rows written (approx): {sum(1 for _ in open(OUT_PATH)) - 1}")


if __name__ == "__main__":
    print("Fetching UN Comtrade mirror trade data for Pacific islands...")
    main()
