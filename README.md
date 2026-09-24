# Pacific Links

**Explore the connections shaping the Pacific.** Pacific Links brings together aid, trade, debt, security, remittances, migration, international students, and investment data for **14 Pacific Island Countries, 2010–2024**. The interactive map and downloadable dataset put scattered public sources into a common format.

**Live map:** https://pacific-links.onrender.com/

Built by [Dottie AI Studio](https://dottieaistudio.com.au/). Inspired by the [Lowy Pacific Aid Map](https://pacificaidmap.lowyinstitute.org/).

## Explore the data

- [`dashboard/`](dashboard/) contains the React, MapLibre, and deck.gl map.
- [`dashboard/public/data/`](dashboard/public/data/) contains the published CSVs and Excel download.
- [`scripts/`](scripts/) and [`pacific_data/`](pacific_data/) fetch, harmonise, and rebuild the data.

Sources include the Lowy Pacific Aid Map, CEPII BACI, World Bank, KNOMAD, OECD, SIPRI, UN, UNESCO, and IMF. Each metric has its own coverage and units; see [`DATA_PIPELINE.md`](DATA_PIPELINE.md) for sources, definitions, gaps, and refresh steps. [`AUDIT_LOG.md`](AUDIT_LOG.md) records the data checks. These are the starting points for coding agents working on the pipeline.

## Run locally

```bash
cd dashboard
npm install
npm run dev
```

To refresh the dataset from the repository root, install `requirements.txt` and run `python3 scripts/refresh_all.py`. Some sources require manual downloads; the command and `DATA_PIPELINE.md` explain which ones. Run `python3 scripts/run_audits.py` before publishing data changes.

## Use and attribution

You may use the harmonised dataset with credit to Pacific Links / Dottie AI Studio and the original data publishers. Source data remains subject to each publisher's terms. For country-level detail, check the relevant official national source.
