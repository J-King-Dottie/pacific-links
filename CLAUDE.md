# Working in this repo (for agents and contributors)

Pacific Links harmonises five Pacific datasets (aid, imports, remittances, migration,
debt) into one schema and serves them as an interactive map plus a downloadable Excel.

## Key commands

```bash
# Refresh data (auto sources + harmonise + rebuild Excel/CSVs/meta)
python3 scripts/refresh_all.py
python3 scripts/refresh_all.py --skip-baci       # skip the 2.4 GB BACI download
python3 scripts/refresh_all.py --only-normalize  # just re-harmonise existing CSVs

# Run the dashboard
cd dashboard && npm install && npm run dev
# Windows/WSL: ./start-dev.ps1 from the repo root prints a Windows-reachable URL
```

## Where things live

- `dashboard/src/` — React app. `data/loadData.js` reads the harmonised CSVs;
  `data/computeScores.js` builds the per-country indices and choropleth scores.
- `dashboard/public/data/` — the published CSVs + `pacific_links_data.xlsx` +
  `data_meta.json` (refresh date, read by the landing page). **Generated** — don't hand-edit.
- `scripts/` — one build script per source, plus:
  - `normalize_for_dashboard.py` — harmonises everything, clips to 2010–2024, writes
    CSVs to `data/processed/` and `dashboard/public/data/`, rebuilds the Excel and
    `data_meta.json`. **Always runs last.** Idempotent.
  - `refresh_all.py` — one-command orchestrator.
- `pacific_data/pdh_client.py` — Pacific Data Hub SDMX client (aid, used historically for trade).

## Rules that matter

- **Harmonised schema:** `pacific_code, pacific_name, counterpart_code, counterpart_name,
  year, value_usd, pct_gdp`. Imports adds `hs1_code, hs1_name`; migration uses
  `value_people` / `pct_population`.
- **Scope is 2010–2024.** `normalize_for_dashboard.py` clips every dataset to this; the
  dashboard and landing copy state it. Don't widen it without updating both.
- **Aid is spent/disbursed only** — never commitments, never add the two.
- **Intentional import exclusions** (ship registry / bunkering) live in
  `scripts/fetch_baci_trade.py` and are logged to `data/raw/baci/excluded_<year>.csv`.
- **Values trace to source.** Inside 2010–2024, `value_usd` / `value_people` equal the
  source figure apart from the documented adjustments. The `pct_*` columns are derived
  (value ÷ World Bank GDP/pop, nearest-year fallback within 3 years).
- **Newer trade release:** bump `BACI_VERSION` in `scripts/fetch_baci_trade.py` and keep
  the matching constant in `scripts/normalize_for_dashboard.py` in sync.

## Conventions

- Raw source files are gitignored (large, third-party). Scripts re-fetch them; URLs are
  in `DATA_PIPELINE.md`.
- After changing data scripts, run `refresh_all.py` (or at least `--only-normalize`) so
  the published CSVs, Excel, and `data_meta.json` stay in sync, then `npm run build` to
  confirm the dashboard compiles.
