"""
Fetch GDP (current USD) and population from World Bank API for Pacific countries.
Saves to data/raw/worldbank_gdp_pop.csv

Indicators:
  NY.GDP.MKTP.CD  — GDP, current USD
  SP.POP.TOTL     — Population, total

Pacific ISO2 codes covered (World Bank uses ISO2):
  FJ PG SB VU KI FM MH PW NR TV CK NU WF WS TO AS PF TK GU MP NC
"""

import urllib.request
import json
import csv
from pathlib import Path

PACIFIC_ISO2 = [
    "FJ", "PG", "SB", "VU",       # Melanesia
    "WS", "TO", "TV",              # Polynesia (WB members)
    "KI", "FM", "MH", "PW", "NR", # Micronesia
    # territories with WB data
    "AS",
    # CK, NU not in WB — hardcoded below
]

# Cook Islands — not in World Bank API.
# GDP: UN SNAAMA "GDP at current prices - US dollars" TOTAL series
#   (data.un.org, d=SNAAMA, grID:101, pcFlag:0, crID:184; accessed 2026-06).
#   2019-2024 are taken directly from UN. 2010-2018 are not reachable via the
#   paginated UN page, so they are reconstructed as UN per-capita GDP (pcFlag:1,
#   reliable for all years) × resident population 16,000. That 16,000 is the
#   population UN's own accounts imply: dividing the direct totals by per-capita
#   for 2019-2023 yields 16,129 / 15,643 / 15,182 / 14,723 / 14,222 — a stable
#   ~15-16k de jure resident base. The 2018→2019 join is smooth ($380M → $391M).
#   NOTE: do NOT multiply per-capita by the demographic POP table (de facto, 18-22k,
#   includes visitors) — that mixes population universes and overstates GDP by up to 50%.
_CK_GDP_TOTAL = {  # USD, directly from UN SNAAMA
    2019: 391063400, 2020: 267801798, 2021: 256025338,
    2022: 289369804, 2023: 366211548, 2024: 414081783,
}
_CK_GDPPC = {  # USD per capita, UN SNAAMA — used to reconstruct 2010-2018
    2010: 15694, 2011: 17201, 2012: 18413, 2013: 17956, 2014: 20044,
    2015: 18322, 2016: 18393, 2017: 20931, 2018: 23780,
}
# Resident population (de jure basis, consistent with the national-accounts GDP).
# 2019-2023 are the UN-implied figures above; 2024 held at 2023; pre-2019 held at
# 16,000 (the level the implied series sits at and the basis used to reconstruct GDP).
_CK_POP = {
    2010: 16000, 2011: 16000, 2012: 16000, 2013: 16000, 2014: 16000,
    2015: 16000, 2016: 16000, 2017: 16000, 2018: 16000,
    2019: 16129, 2020: 15643, 2021: 15182, 2022: 14723, 2023: 14222, 2024: 14222,
}

# Niue: GDP at current prices in NZD thousands from Niue Statistics Office,
# National Accounts Estimates of Niue 2024 (niuestatistics.nu, accessed 2026-06).
# Converted to USD using annual average NZD/USD exchange rates (Reserve Bank of NZ / RBNZ).
# Population per year also from same Niue Statistics Office publication.
# 2024 is provisional (P). Years before 2015: use 2015 as nearest available.
_NU_NZD_K = {
    2015: 29733, 2016: 30239, 2017: 32414, 2018: 38736, 2019: 39751,
    2020: 39828, 2021: 35830, 2022: 36119, 2023: 42166, 2024: 49751,
}
_NU_NZDUSD = {
    # Annual average NZD/USD (source: RBNZ / xe.com historical averages)
    2015: 0.677, 2016: 0.696, 2017: 0.718, 2018: 0.696, 2019: 0.654,
    2020: 0.650, 2021: 0.712, 2022: 0.627, 2023: 0.609, 2024: 0.600,
}
_NU_POP = {
    2015: 1465, 2016: 1499, 2017: 1522, 2018: 1545, 2019: 1545,
    2020: 1562, 2021: 1655, 2022: 1618, 2023: 1640, 2024: 1640,
}


def _ck_row(year):
    pop = _CK_POP.get(year) or _CK_POP[2023]
    if year in _CK_GDP_TOTAL:                       # direct UN total (2019-2024)
        gdp = _CK_GDP_TOTAL[year]
    else:                                           # reconstruct 2010-2018
        gdp = _CK_GDPPC[year] * pop
    return {"country_name": "Cook Islands", "gdp_usd": gdp, "population": pop}


def _nu_row(year):
    y = year if year in _NU_NZD_K else (2015 if year < 2015 else 2024)
    gdp = _NU_NZD_K[y] * 1000 * _NU_NZDUSD[y]
    pop = _NU_POP.get(year) or _NU_POP.get(y, 1640)
    return {"country_name": "Niue", "gdp_usd": gdp, "population": pop}


# Flat-value fallbacks for territories with no annual series and no data in CSVs.
HARDCODED_FLAT = {
    "TK": {
        # Source: CIA World Factbook 2022 / SPC — GDP per capita ~USD 4,962 (2021) × 2,424 pop.
        # No formal annual series. TK has no rows in any processed CSV — placeholder only.
        "country_name": "Tokelau",
        "gdp_usd": 1.2e7,
        "population": 2424,
    },
    "WF": {
        # Source: Banque de France / INSEE / ISPF 2019 survey — USD 212M.
        # GDP estimated ~every 15 years; no annual series available.
        # WF has no rows in any processed CSV — placeholder only.
        "country_name": "Wallis and Futuna",
        "gdp_usd": 2.12e8,
        "population": 11151,
    },
}

INDICATORS = {
    "NY.GDP.MKTP.CD": "gdp_usd",
    "SP.POP.TOTL":    "population",
}

OUT_PATH = Path(__file__).parent.parent / "data" / "raw" / "worldbank_gdp_pop.csv"


def fetch_wb(indicator, countries, year_start=2010, year_end=2024):
    all_rows = []
    for iso2 in countries:
        url = (
            f"https://api.worldbank.org/v2/country/{iso2}/indicator/{indicator}"
            f"?format=json&date={year_start}:{year_end}&per_page=1000"
        )
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
            if len(data) > 1 and data[1]:
                all_rows.extend(data[1])
        except Exception:
            pass
    return all_rows


def main():
    # Collect {(iso2, year): {gdp_usd: ..., population: ...}}
    records = {}

    for indicator, col in INDICATORS.items():
        print(f"  Fetching {indicator}...")
        rows = fetch_wb(indicator, PACIFIC_ISO2)
        for row in rows:
            if row["value"] is None:
                continue
            iso2 = row["country"]["id"]    # ISO2
            year = int(row["date"])
            key = (iso2, year)
            if key not in records:
                records[key] = {"iso2": iso2, "country_name": row["country"]["value"], "year": year}
            records[key][col] = row["value"]

    # Add per-year rows for CK and NU using annual series
    for year in range(2010, 2025):
        for iso2, fn in [("CK", _ck_row), ("NU", _nu_row)]:
            h = fn(year)
            records[(iso2, year)] = {"iso2": iso2, "year": year, **h}

    # Flat-value rows for TK and WF (no annual series; no data in CSVs)
    for iso2, h in HARDCODED_FLAT.items():
        for year in range(2010, 2025):
            records[(iso2, year)] = {"iso2": iso2, "year": year, **h}

    rows_out = sorted(records.values(), key=lambda r: (r["iso2"], r["year"]))

    fieldnames = ["iso2", "country_name", "year", "gdp_usd", "population"]
    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows_out)

    print(f"  Saved {len(rows_out)} rows → {OUT_PATH}")


if __name__ == "__main__":
    print("Fetching World Bank GDP + population...")
    main()
    print("Done.")
