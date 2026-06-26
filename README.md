# Pacific Links

**Explore the connections shaping the Pacific.**

Pacific Links brings together aid, trade (imports), remittances, migration, and debt
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

## The five metrics and their sources

| Metric | Source | Notes |
|--------|--------|-------|
| **Aid** | [Lowy Pacific Aid Map](https://pacificdata.org/data/dataset/pacific-aid-and-development-finance-data-from-the-lowy-institute-df-pam) via Pacific Data Hub | Spent/disbursed aid only, by donor |
| **Imports** | [CEPII BACI](https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37) | Reconciled bilateral merchandise imports, by supplier |
| **Remittances** | [World Bank / KNOMAD](https://www.knomad.org/data/remittances) | Modelled bilateral matrices, benchmark years |
| **Migration** | [UN Migrant Stock 2024](https://www.un.org/development/desa/pd/content/international-migrant-stock) | Migrant stock (people), benchmark years |
| **Debt** | [World Bank IDS](https://databank.worldbank.org/source/international-debt-statistics) | External PPG debt stock, by creditor |

Denominators for the `% of GDP` / `% of population` columns come from the
[World Bank](https://data.worldbank.org/indicator/NY.GDP.MKTP.CD), with UN SNAAMA and
the Niue Statistics Office filling gaps for Cook Islands and Niue.

## Harmonised data schema

Every published CSV shares the same columns:

```
pacific_code, pacific_name, counterpart_code, counterpart_name, year, value_usd, pct_gdp
```

- **Imports** also carries `hs1_code, hs1_name` (one row per HS1 product category).
- **Migration** uses `value_people` and `pct_population` instead of `value_usd` / `pct_gdp`.

All datasets are clipped to the stated **2010–2024** scope. Values inside that window
are the source figures unchanged, apart from a small set of documented, intentional
adjustments (e.g. removing ship-registry/bunkering flows from imports). See
[`DATA_PIPELINE.md`](DATA_PIPELINE.md) for the full per-metric methodology.

## Refreshing the data

```bash
pip install -r requirements.txt
python3 scripts/refresh_all.py              # auto sources + harmonise/rebuild
python3 scripts/refresh_all.py --skip-baci  # skip the large BACI download
python3 scripts/refresh_all.py --only-normalize  # just re-harmonise existing CSVs
```

Aid, debt, and imports refresh automatically (live APIs / public download).
Remittances and migration are benchmark-year workbooks you download manually — the
runner prints a reminder and [`DATA_PIPELINE.md`](DATA_PIPELINE.md) has the URLs.

The raw source files are **not** committed (they're large and third-party); the
scripts re-fetch them. The harmonised outputs and the Excel are committed.

## Running the dashboard

```bash
cd dashboard
npm install
npm run dev
```

Then open the printed local URL. On Windows/WSL you can use `./start-dev.ps1` from the
repo root, which launches the dev server and prints a URL that works from Windows.

## Repository layout

```
dashboard/          React + Vite app (MapLibre map, deck.gl flows, side panel)
  public/data/      Harmonised CSVs + pacific_links_data.xlsx (what the app serves)
  src/              Components, data loaders, scoring
scripts/            Per-source build scripts + refresh_all.py + normalize_for_dashboard.py
pacific_data/       Pacific Data Hub SDMX client
data/processed/     Canonical harmonised CSVs + per-source metadata
DATA_PIPELINE.md    How each dataset goes from source to harmonised CSV
DATA_COVERAGE.md    What's covered and what's missing
```

## Data & attribution

Use the harmonised dataset freely — please credit Pacific Links / Dottie AI Studio, and
cite the original publishers when you use their figures (Lowy Institute, CEPII, World
Bank, KNOMAD, UN, SPC). The underlying sources remain the property of those publishers
under their own terms.

Gaps exist in Pacific Islands bilateral data. For granular detail on specific
countries, official national publications remain the authoritative source.

Suggested citation:

> Pacific Links, Dottie AI Studio (2026). Harmonised Pacific aid, trade, remittance,
> migration and debt dataset.
