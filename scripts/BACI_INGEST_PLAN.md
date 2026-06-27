# BACI Trade Data Ingest Plan

## Goal
Replace UN Comtrade mirror trade data with BACI (CEPII) reconciled bilateral trade data.
BACI is pre-reconciled from both importer- and exporter-reported Comtrade data, eliminating
outliers and transshipment distortions. Free, no registration. HS92 covers 1995–2024.

## Download URL
https://www.cepii.fr/DATA_DOWNLOAD/baci/data/BACI_HS92_V202601.zip

## BACI file format (per-year CSVs inside the ZIP)
- `t` = year
- `i` = exporter ISO numeric (= M49)
- `j` = importer ISO numeric (= M49)
- `k` = HS6 product code
- `v` = trade value (thousands USD)
- `q` = quantity (metric tons)

## Pacific island M49 codes (importer = `j`)
FJ=242, PG=598, SB=90, VU=548, WS=882, TO=776, TV=798, CK=184, NU=570,
PF=258, WF=876, TK=772, AS=16, KI=296, FM=583, MH=584, PW=585, NR=520, GU=316, MP=580

## Steps

### Step 1 — Download ZIP (scripts/fetch_baci_trade.py, phase 1)
- Stream-download BACI_HS92_V202601.zip to data/raw/baci/BACI_HS92_V202601.zip
- Show progress, resume if partial (check Content-Length vs existing file size)
- Checkpoint: zip file presence + correct size

### Step 2 — Extract & filter to Pacific islands (phase 2)

The output preserves BACI's reconciled merchandise trade flows, including
re-exports, bunkering, vessel-registration effects, and other reporting-
convention artefacts where they are present in the source data.
- Stream-extract ZIP entry by entry (each file = one year, e.g. BACI_HS92_Y2023_V202601.csv)
- For each year file, read rows where `j` is in our Pacific M49 set
- Aggregate: sum `v` (×1000 for USD) grouped by (j, i, t) — total imports from each exporter
- Write filtered rows to data/raw/baci/filtered_{year}.csv as each year is processed
- Checkpoint: JSON tracking which years are extracted

### Step 3 — Build final combined CSV (phase 3)
- Concatenate all filtered_{year}.csv into data/raw/baci_imports.csv
- Columns: reporter_code (iso2), reporter_name, supplier_code (iso2), supplier_name, year, value_usd
- Use M49→ISO2 lookup (same as normalize_for_dashboard.py) for both j and i
- Checkpoint: presence of baci_imports.csv

### Step 4 — Update normalize_for_dashboard.py
- In normalize_trade(), prefer baci_imports.csv over comtrade_mirror_imports.csv over pdh fallback
- No outlier removal needed — BACI is pre-reconciled

## M49→ISO2 lookup needed
Extend existing M49_TO_ISO2 in normalize_for_dashboard.py to cover all common trade partners.
BACI uses ISO numeric = M49 for reporters/partners.

## Files created
- data/raw/baci/BACI_HS92_V202601.zip  (large, ~500MB)
- data/raw/baci/filtered_{year}.csv     (one per year, 2010–2023)
- data/raw/baci/checkpoint.json         (tracks progress)
- data/raw/baci_imports.csv             (final output, replaces comtrade_mirror_imports.csv)

## Script location
scripts/fetch_baci_trade.py — run phases independently:
  python fetch_baci_trade.py --phase download
  python fetch_baci_trade.py --phase extract
  python fetch_baci_trade.py --phase combine
  python fetch_baci_trade.py  (runs all phases sequentially)
