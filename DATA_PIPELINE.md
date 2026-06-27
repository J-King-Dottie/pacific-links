# Pacific Exposure Map — Data Pipeline

How to refresh each dataset from source to dashboard-ready processed CSV.

---

## One-command refresh

```
python3 scripts/refresh_all.py              # automatable sources + harmonize/rebuild
python3 scripts/refresh_all.py --skip-baci  # skip the ~2.4 GB BACI download
python3 scripts/refresh_all.py --only-normalize  # just re-harmonize existing CSVs
```

`refresh_all.py` runs every source that can be pulled automatically (aid, debt,
trade), then runs `normalize_for_dashboard.py` to harmonize and rebuild the
download. It prints a reminder for the two manual benchmark sources.

**Automatable (pulled fresh every run):**
- **Aid** — Lowy Pacific Aid Map, live SDMX API
- **Debt** — World Bank IDS, live API
- **Trade** — CEPII BACI (downloads the published version ZIP)

**Manual (benchmark years, update rarely):**
- **Remittances** — World Bank/KNOMAD bilateral matrices
- **FDI** — IMF Direct Investment Positions bulk export
- **Migration** — UN International Migrant Stock workbook

For a manual source, download the new workbook (see its section below), re-run its
build script, then run `python3 scripts/refresh_all.py --only-normalize`.

**Pulling a newer trade release:** bump `BACI_VERSION` in
`scripts/fetch_baci_trade.py` (and keep the matching constant in
`scripts/normalize_for_dashboard.py` in sync), then re-run.

## Full refresh order (manual, if not using refresh_all.py)

```
1. python3 scripts/build_aid_timeseries.py
2. python3 scripts/fetch_baci_trade.py              (download + extract + combine)
3. python3 scripts/build_remittance_timeseries.py   (run per-year first, then combined)
4. python3 scripts/build_fdi_positions.py
5. python3 scripts/build_migration_timeseries.py
6. python3 scripts/fetch_ids_debt.py
7. python3 scripts/merge_ids_debt_parts.py
8. python3 scripts/normalize_for_dashboard.py
```

The normalization step must always run last. It harmonizes every dataset to one
schema, clips to the 2010–2024 scope, copies CSVs to `dashboard/public/data/`,
and rebuilds three published artefacts:
- `pacific_links_data.xlsx` — one tab per metric plus an About tab
- `data_meta.json` — last-refreshed date and per-source vintage (read by the landing page)

### Harmonized output schema

Every dashboard CSV shares these columns:
`pacific_code, pacific_name, counterpart_code, counterpart_name, year, value_usd, pct_gdp`
- **Imports** also carries `hs1_code, hs1_name` (one row per HS1 category).
- **Migration** uses `value_people` and `pct_population` instead of `value_usd`/`pct_gdp`.

Aid dashboard rule: spent/disbursed aid is the default view; committed aid is a separate in-card view. Never add spent and committed values together.

---

## 1. Aid — `aid_by_donor_year.csv`

**Source:** Pacific Data Hub — Lowy Pacific Aid Map
**Dataflow:** `SPC:DF_PAM(1.0)`
**API:** Live SDMX REST API via `pacific_data.pdh_client`

**Script:** `scripts/build_aid_timeseries.py`

**What it does:**
- Calls the PDH SDMX API for the `DF_PAM` dataflow (all annual aid transactions)
- Filters to: annual frequency, TRVAL indicator, spent (SPE) and committed (COM) only, all flow types
- Excludes aggregate donor codes: `_T`, `DONOR_BIL`, `DONOR_MUL`, `DONOR_CSP`, `DONOR_PCS`
- Pivots spent and committed into separate columns per recipient-donor-year row
- Computes `spent_share_pct` and `committed_share_pct` separately (each as share of that recipient-year's total for that basis)
- Fetches donor and recipient name codelists from the PDH API

**Outputs:** `data/processed/aid_by_donor_year.csv`, `data/processed/aid_committed_by_donor_year.csv`, `aid_by_donor_year.metadata.json`

**Key notes:**
- Spent and committed are independent measures — never add them
- Some donors only report committed (multilaterals like GCF, GEF); others only spent
- Latest year is often partial

**Dashboard normalization adds:** harmonized column names plus `pct_gdp` for both aid views. The default `aid_by_donor_year.csv` is spent/disbursed aid; `aid_committed_by_donor_year.csv` is committed aid. The dashboard exposes them under one Aid metric with an in-card Spent/Committed toggle.

---

## 2. Imports — `imports_by_supplier_year.csv`

**Source:** CEPII BACI — reconciled bilateral trade (built from UN Comtrade)
**Release:** `BACI_HS92_V202601` (set by `BACI_VERSION` in the script)
**Download:** Public ZIP, no registration. ~2.4 GB.

**Script:** `scripts/fetch_baci_trade.py` (phases: download → extract → combine)

**What it does:**
- Downloads the BACI HS92 release ZIP (resumable).
- Extracts each year, keeps flows where the **importer** (`j`) is one of the 20 Pacific economies.
- BACI values are in thousands of USD; multiplied by 1000 to current USD.
- Aggregates HS6 → HS1 (first digit) per importer-supplier-year.
- Maps numeric M49 codes to ISO2 using BACI's own country-code table.

**Outputs:** `data/raw/baci_imports.csv` → normalized to `data/processed/imports_by_supplier_year.csv`

**Key notes:**
- One row per supplier **per HS1 category** per year. The dashboard and the Excel sum these to a supplier total; the raw CSV keeps the HS1 breakdown.
- BACI trade flows may include re-exports, bunkering, vessel-registration effects, and other reporting-convention artefacts where recorded in the source data.
- The latest year present depends on the BACI release (V202601 covers through 2023; 2024 fills in with newer releases).
- To pull a newer release: bump `BACI_VERSION` in `scripts/fetch_baci_trade.py` and the matching constant in `scripts/normalize_for_dashboard.py`.

---

## 3. FDI — `fdi_positions_by_investor_year.csv`

**Source:** IMF Direct Investment Positions by Counterpart Economy
**Dataset:** `IMF.STA:DIP(12.0.1)`
**Download:** Manual export from IMF website as `data/raw/imf_dip.csv`

**Script:** `scripts/build_fdi_positions.py`

**What it does:**
- Reads the raw IMF DIP export CSV (wide format: one row per series, year columns)
- Filters to: inward positions, all financial instruments, all entities, net liabilities-less-assets, annual, USD
- Matches Pacific recipient countries by ISO3 code (maps to ISO2 in output)
- Extracts investor ISO3 code from the series code field (`series_parts[-2]`)
- Normalises from USD millions to USD using `SCALE` column
- Where both official and mirror (counterparty-derived) data exist for the same key, official takes priority
- Outputs one row per recipient-investor-year

**Outputs:** `data/processed/fdi_positions_by_investor_year.csv`, `fdi_positions_by_investor_year.metadata.json`

**Key notes:**
- Values are year-end stocks (positions), not annual flows
- Negative positions are valid (net liabilities-less-assets definition)
- Most Pacific data is mirror/counterparty-derived, not officially reported
- `investor_code` in raw output is ISO3 — normalised to ISO2 in step 6

**To refresh:** Re-download the full DIP dataset from IMF and replace `data/raw/imf_dip.csv`. The IMF does not have a public REST API for this dataset — it requires a manual bulk export.

**Dashboard normalization adds:**
- `counterpart_code` — investor ISO3 mapped to ISO2
- `value_usd` — year-end inward direct investment position
- `pct_gdp` — position as a share of recipient GDP

Negative positions are retained in the CSV/Excel download. The dashboard loader shows positive inward positions only for map/table ranking.

---

## 4. Remittances — `remittances_by_source_year.csv`

**Source:** World Bank / KNOMAD Bilateral Remittance Matrices
**Benchmark years:** 2010, 2017, 2018, 2021
**Download:** Manual download of 4 Excel workbooks into `data/raw/`

**Script:** `scripts/build_remittance_timeseries.py`

**Workbooks:**
| Year | File | Notes |
|------|------|-------|
| 2010 | `world_bank_bilateral_remittances_2010.xlsx` | Retrieved from Internet Archive (original URL retired) |
| 2017 | `world_bank_bilateral_remittances_2017.xlsx` | Retrieved from Internet Archive (original URL retired) |
| 2018 | `world_bank_bilateral_remittances_2018.xlsx` | Has ISO3 codes in row 3 — used to build source code lookup |
| 2021 | `world_bank_knomad.xlsx` | Different format; uses `WB.KNOMAD.BRE` indicator, `Data` sheet |

**Two-step run:**
```
# Step 1: extract each year into staging
python3 scripts/build_remittance_timeseries.py --year 2010
python3 scripts/build_remittance_timeseries.py --year 2017
python3 scripts/build_remittance_timeseries.py --year 2018
python3 scripts/build_remittance_timeseries.py --year 2021

# Step 2: combine and compute shares
python3 scripts/build_remittance_timeseries.py
```

**What it does:**
- Reads each bilateral matrix Excel file
- Identifies Pacific recipient columns by name lookup against `PACIFIC` dict
- ISO3 source codes: 2018 workbook has them in row 3; 2010/2017 use the 2018 workbook's coded axes as a name→ISO3 lookup; 2021 has codes in a dedicated column
- Converts values from USD millions to USD
- Computes `source_share_pct` within each recipient-year from the values present in the matrix

**Outputs:** `data/processed/remittances_by_source_year.csv`, staging files in `data/processed/remittance_benchmarks/`

**Key notes:**
- These are modelled bilateral estimates, not observed totals
- The matrices only capture the largest source countries — shares sum to ~50–100% depending on recipient. This is expected: the remainder is genuinely unidentified sources.
- Only 4 benchmark years available; no interpolation between years
- `source_code` in raw output is ISO3

**Dashboard normalization (step 6) adds:**
- `source_iso2` — ISO3 to ISO2 mapping
- Drops 42 aggregate/non-country rows (`WORLD`, `Total Remittances`, `Unidentified*`, `Other South`)

---

## 5. Migration — `migrants_abroad_by_destination_year.csv`

**Source:** UN International Migrant Stock 2024: Destination and Origin
**Download:** Manual download of Excel workbook into `data/raw/un_migrant_stock_bilateral_2024.xlsx`

**Script:** `scripts/build_migration_timeseries.py`

**What it does:**
- Reads `Table 1` sheet from the UN bilateral migrant stock workbook (data starts row 12)
- Filters to Pacific-origin countries (21 countries matched by name against `PACIFIC_ORIGINS`)
- Excludes regional/aggregate destinations (destination codes ≥ 900)
- Extracts 8 benchmark years from fixed column positions: 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024
- Computes `destination_share_pct` within each origin-year
- Destination codes in output are UN M49 numeric (not ISO2)

**Outputs:** `data/processed/migrants_abroad_by_destination_year.csv`, `migrants_abroad_by_destination_year.metadata.json`

**Key notes:**
- Values are migrant stock (people living abroad), not annual migration flows
- Benchmark years only — no annual series
- Destination codes are UN M49 numeric; ISO2 is added in step 6
- Blank country-pair cells are treated as unreported source values, not confirmed zeroes. For example, the UN matrix is blank for Vanuatu-born people in New Zealand, although New Zealand census data records that community.

**To refresh:** Download the new UN migrant stock bilateral workbook and replace `data/raw/un_migrant_stock_bilateral_2024.xlsx`. Check that column positions for year data (`YEAR_COLUMNS` dict in the script) still match the new workbook layout — the UN occasionally shifts columns between releases.

**Dashboard normalization (step 6) adds:**
- `destination_iso2` — UN M49 numeric to ISO2 mapping (48 destinations, all resolved)

---

## 6. Public debt — `debt_by_creditor_year.csv`

**Source:** World Bank International Debt Statistics
**Database:** IDS source `6`
**Series:** `DT.DOD.DPPG.CD` external debt stocks, public and publicly guaranteed, current US$
**Creditor dimension:** IDS `counterpart-area`

**Scripts:**
- `scripts/fetch_ids_debt.py`
- `scripts/merge_ids_debt_parts.py`

**What it does:**
- Pulls creditor-level public and publicly guaranteed external debt from IDS.
- Uses the IDS debtor countries available for this project: Fiji, Micronesia (FSM), Papua New Guinea, Solomon Islands, Tonga, Vanuatu, and Samoa.
- Defaults to the focused creditor set used in the dashboard: China, Japan, Australia, New Zealand, United States, France, World Bank IDA, World Bank IBRD, Asian Development Bank, IMF, and European Investment Bank.
- Converts country creditors to ISO2 codes so they can draw map flows. Multilateral creditors are kept with stable `IDS_###` codes for table display.
- Computes `pct_gdp` using `data/raw/worldbank_gdp_pop.csv`, with nearest-year GDP fallback within three years.
- Saves one country part at a time in `data/processed/ids_debt_parts/`, then merges those parts into `data/processed/debt_by_creditor_year.csv`.

**Refresh commands:**
```
# Focused refresh, one IDS debtor country at a time.
python3 scripts/fetch_ids_debt.py FJI
python3 scripts/fetch_ids_debt.py PNG
python3 scripts/fetch_ids_debt.py SLB
python3 scripts/fetch_ids_debt.py TON
python3 scripts/fetch_ids_debt.py VUT
python3 scripts/fetch_ids_debt.py WSM
python3 scripts/fetch_ids_debt.py FSM

# Merge country parts into the dashboard-ready processed file.
python3 scripts/merge_ids_debt_parts.py

# Copy to dashboard public data after validation.
cp data/processed/debt_by_creditor_year.csv dashboard/public/data/debt_by_creditor_year.csv
```

**Current coverage:**
- Saved IDS rows are available for Fiji, Papua New Guinea, Samoa, Solomon Islands, Tonga, and Vanuatu.
- FSM is an IDS debtor country, but the direct focused creditor query returned no usable rows in this run.
- Cook Islands, Niue, Tuvalu, Kiribati, Marshall Islands, Nauru, and Palau are not available as IDS debtor countries. These need country-source extraction if a complete Pacific debt layer is required.

**To run a slower exploratory pull:** add `--all-creditors` to scan every IDS counterpart area for a country, for example `python3 scripts/fetch_ids_debt.py VUT --all-creditors`.

---

## 7. Harmonize + rebuild download — `normalize_for_dashboard.py`

**Script:** `scripts/normalize_for_dashboard.py`

**Always run this last, after all build scripts.** Idempotent — safe to re-run; it
reads whatever schema the processed CSVs are in (raw build output or already
harmonized) and rewrites them to the canonical schema.

What it does:
- Renames every dataset to the shared schema (`pacific_*`, `counterpart_*`, `value_usd`/`value_people`, `pct_gdp`/`pct_population`).
- Computes `pct_gdp` / `pct_population` from World Bank GDP/population (nearest-year fallback within 3 years; Cook Islands and Niue use national-accounts sources).
- Resolves all counterpart codes to ISO2; drops aggregate/non-country rows.
- Clips every dataset to the **2010–2024** scope.
- Writes harmonized CSVs to `data/processed/` and `dashboard/public/data/`.
- Rebuilds `pacific_links_data.xlsx` (per-metric tabs + About tab; the Imports tab sums HS1 rows to a supplier total).
- Writes `data_meta.json` (last-refreshed date + per-source vintage), read by the landing page and shown on the Excel About tab.
