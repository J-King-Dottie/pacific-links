# Pacific Links

Pacific Links is an **interactive Pacific Islands data map and open dataset**. It brings together aid, trade, debt, security, remittances, migration, international students, and investment data for **14 Pacific Island Countries, 2010–2024**. Explore each country's connections with other countries and organisations, one metric at a time.

The public figures come from different publishers, with different units and coverage. Pacific Links harmonises them for exploration while keeping those differences visible.

**Live map:** https://pacific-links.onrender.com/

Built by [Dottie AI Studio](https://dottieaistudio.com.au/). Inspired by the [Lowy Pacific Aid Map](https://pacificaidmap.lowyinstitute.org/).

## What the map covers

| Metric | Source | What it shows |
| --- | --- | --- |
| Aid | Lowy Pacific Aid Map | Spent and committed aid by donor, shown separately |
| Trade | CEPII BACI | Merchandise imports and exports by partner |
| Debt | World Bank IDS | External public and publicly guaranteed debt by creditor |
| Security | OECD CRS; SIPRI | Security assistance and major arms transfers |
| Remittances | World Bank / KNOMAD | Modelled bilateral remittance flows |
| Migration | UN International Migrant Stock | People living abroad by destination |
| Students | UNESCO UIS | Overseas higher education students by destination |
| Investment | IMF DIP and PIP | Foreign direct and portfolio investment positions |

Some series use benchmark years, and gaps remain in Pacific Islands bilateral data. The [data pipeline guide](DATA_PIPELINE.md) explains each source, its units, coverage, and limits.

## Data and code

- [`dashboard/`](dashboard/) is the React, MapLibre, and deck.gl map.
- [`dashboard/public/data/`](dashboard/public/data/) holds the published CSVs and [Excel download](dashboard/public/data/pacific_links_data.xlsx).
- [`data/processed/`](data/processed/) holds harmonised outputs; [`scripts/`](scripts/) and [`pacific_data/`](pacific_data/) rebuild them.

For coding agents, start with [`DATA_PIPELINE.md`](DATA_PIPELINE.md) for source and refresh rules, then [`AUDIT_LOG.md`](AUDIT_LOG.md) for checks and known issues. The app reads the published local data files.

## Run locally

```bash
cd dashboard
npm install
npm run dev
```

## Refresh and check the data

From the repository root:

```bash
pip install -r requirements.txt
python3 scripts/refresh_all.py
python3 scripts/run_audits.py
```

The refresh pulls automatable sources, including a large CEPII BACI trade download. Use `--skip-baci` to skip that download. Remittances, migration, and direct investment need occasional manual source files; see [`DATA_PIPELINE.md`](DATA_PIPELINE.md).

## Use and attribution

You may use the harmonised dataset with credit to Pacific Links / Dottie AI Studio and the original publishers. Their source data remains subject to their own terms. For country-level detail, check official national publications.
