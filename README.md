# Pacific Links

**Explore the connections shaping the Pacific.**

Pacific Links brings together aid, trade, debt, security, remittances, migration, students, and investment
data for 14 Pacific Island Countries, from 2010 to 2024. All of this data already
exists — but it's spread across different sources, each using different codes,
currencies, and years. The hard part is cleaning it and pulling it together. This
project does that, and presents it as an interactive map plus a single downloadable
dataset.

Built in the open by [Dottie AI Studio](https://dottieaistudio.com.au/). Inspired by
the [Lowy Pacific Aid Map](https://pacificaidmap.lowyinstitute.org).

---

## What's here

- **Interactive dashboard** (`dashboard/`) — a MapLibre + deck.gl map of the Pacific
  with a side panel of ranked counterpart relationships per metric.
- **Data pipeline** (`scripts/`, `pacific_data/`) — Python scripts that pull each
  source, harmonise it to one schema, and rebuild the published dataset.
- **Published data** (`dashboard/public/data/`) — the harmonised CSVs the app reads,
  plus `pacific_links_data.xlsx` (one tab per metric + an About tab) for download.
- **Audit trail** (`AUDIT_LOG.md`, `scripts/audit_*.py`) — repeatable checks covering
  data integrity, coverage, provenance, denominator calculations, methodology copy,
  outliers, and source traceability.

## The eight metrics and their sources

| Metric | Source | Notes |
|--------|--------|-------|
| **Aid** | [Lowy Pacific Aid Map](https://pacificdata.org/data/dataset/pacific-aid-and-development-finance-data-from-the-lowy-institute-df-pam) via Pacific Data Hub | Spent/disbursed and committed aid, by donor |
| **Trade** | [CEPII BACI](https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37) | Reconciled bilateral merchandise imports and exports |
| **Debt** | [World Bank IDS](https://databank.worldbank.org/source/international-debt-statistics) | External PPG debt stock, by creditor |
| **Security** | [OECD CRS](https://sdmx.oecd.org/dcd-public/rest/dataflow/OECD.DCD.FSD/DSD_CRS@DF_CRS/1.6) and [SIPRI Arms Transfers](https://armstransfers.sipri.org/ArmsTransfer/TransferRegister) | Security assistance spending and major conventional arms transfer volume |
| **Remittances** | [World Bank / KNOMAD](https://www.knomad.org/data/remittances) | Modelled bilateral matrices, benchmark years |
| **Migration** | [UN International Migrant Stock 2024](https://www.un.org/development/desa/pd/content/international-migrant-stock) | Migrant stock (people), benchmark years |
| **Students** | [UNESCO UIS OPRI](https://databrowser.uis.unesco.org/resources/bulk) | Recorded overseas higher-education students, by destination |
| **Investment** | [IMF Direct Investment Positions](https://data.imf.org/en/datasets/IMF.STA:DIP) and [IMF Portfolio Investment Positions](https://data.imf.org/en/datasets/IMF.STA:PIP) | FDI business stakes and overseas money invested in Pacific shares and bonds |

Denominators for the `% of GDP` / `% of population` columns come from the
[World Bank](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD), with UN SNAAMA and
the Niue Statistics Office filling gaps for Cook Islands and Niue.

## Harmonised data schema

Every published CSV shares the same columns:

```
pacific_code, pacific_name, counterpart_code, counterpart_name, year, value_usd, pct_gdp
```

- **Imports** also carries `hs1_code, hs1_name` (one row per HS1 product category).
- **Migration** and **Students** use `value_people` and `pct_population` instead of `value_usd` / `pct_gdp`.
- **Security assistance** carries `sector_code, sector_name`; **Security arms** shows delivered unit counts first and carries `value_tiv`, SIPRI's non-dollar trend-indicator value, as a secondary equipment-weight measure.
- **Investment** has separate **FDI** and **Portfolio** tabs in the download. Portfolio means reported overseas money invested in Pacific shares and bonds.

All datasets are clipped to the stated **2010–2024** scope. Values inside that window
are the source figures unchanged, with trade shown as BACI records it after HS1
grouping. See [`DATA_PIPELINE.md`](DATA_PIPELINE.md) for the full per-metric
methodology.

## Refreshing the data

```bash
pip install -r requirements.txt
python3 scripts/refresh_all.py              # auto sources + harmonise/rebuild
python3 scripts/refresh_all.py --skip-baci  # skip the large BACI download
python3 scripts/refresh_all.py --only-normalize  # just re-harmonise existing CSVs
```

Aid, debt, trade, students, security, and portfolio investment refresh automatically (live APIs / public downloads).
Remittances, FDI, and migration are source files you download manually — the
runner prints a reminder and [`DATA_PIPELINE.md`](DATA_PIPELINE.md) has the URLs.

The raw source files are **not** committed (they're large and third-party); the
scripts re-fetch them. The harmonised outputs and the Excel are committed.

## Auditing the data

Before release, run the full audit suite:

```bash
python3 scripts/run_audits.py
```

The suite checks that the app, public CSVs, Excel download, source metadata,
methodology copy, denominator calculations, and row-compatible source files agree.
See [`AUDIT_LOG.md`](AUDIT_LOG.md) for the audit history and what each audit covers.

## Running the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Then open the printed local URL.

On Windows/WSL, the project path contains spaces, so the safest local launcher is:

```bash
bash "/home/projects/Pacific Exposure Map/dashboard/start-vite-dev.sh"
```

To leave it running in the background from Codex or a non-interactive shell:

```bash
setsid bash "/home/projects/Pacific Exposure Map/dashboard/start-vite-dev.sh" > "/home/projects/Pacific Exposure Map/dashboard/vite-dev.log" 2>&1 < /dev/null &
```

The default Vite URL is <http://localhost:5173>.

## Repository layout

```
dashboard/          React + Vite app (MapLibre map, deck.gl flows, side panel)
  public/data/      Harmonised CSVs + pacific_links_data.xlsx (what the app serves)
  src/              Components, data loaders, scoring
scripts/            Per-source build scripts + refresh_all.py + normalize_for_dashboard.py
pacific_data/       Pacific Data Hub SDMX client
data/processed/     Canonical harmonised CSVs + per-source metadata
DATA_PIPELINE.md    How each dataset goes from source to harmonised CSV
AUDIT_LOG.md        Audit history and verification commands
```

## Data & attribution

Use the harmonised dataset freely — please credit Pacific Links / Dottie AI Studio, and
cite the original publishers when you use their figures (Lowy Institute, CEPII, World
Bank, KNOMAD, UN, UNESCO, OECD, SIPRI, IMF, SPC). The underlying sources remain the property of those publishers
under their own terms.

Gaps exist in Pacific Islands bilateral data. For granular detail on specific
countries, official national publications remain the authoritative source.
