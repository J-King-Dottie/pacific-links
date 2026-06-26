# Pacific Exposure Map Data Coverage

| Metric | Bilateral data available? | Current coverage |
|---|---|---|
| Aid inflows by source country | Yes | Pacific Aid Map / PDH-derived. `14` Pacific recipients. Historical annual series, broadly `2011-2022/2023` depending on country and donor records. Dashboard values use `spent/disbursed` aid only; committed aid is not used as a fallback. |
| Trade by partner country | Yes | **UN Comtrade mirror data** (exporter-reported exports to each Pacific island). `20` Pacific recipients, `2010–2023`. Mirror used because most Pacific islands do not report to Comtrade directly; origin-based exporter accounting avoids transshipment-hub distortion (PDH IMTS consignment data inflated Singapore ~3× for Vanuatu vs Comtrade mirror). |
| Tourism by origin country | No consolidated bilateral source found yet | No cross-Pacific bilateral dataset loaded. Would likely require country-by-country tourism authority/statistics sources or a different specialist source. |
| Remittances by origin country | Yes | World Bank/KNOMAD bilateral remittance matrices. `13` Pacific recipients. Benchmark years only: `2010`, `2017`, `2018`, `2021`. Modelled bilateral estimates, not full annual observed series. |
| FDI by source country | Yes | IMF Direct Investment Positions by Counterpart Economy. `21` Pacific hosts in current extract. Annual series `2009-2024` where published. This is bilateral `stock/position`, not bilateral `new inflow`. |

## Quick read

- Strongest bilateral coverage: `trade`, `FDI`
- Good but narrower: `aid`
- Usable but patchy: `remittances`
- Still missing: `tourism`

## GDP & population denominators

Flows are normalised to `% of GDP` (aid, trade, remittances) and `% of population`
(migration). GDP/population come from the World Bank API for most countries, with
four Pacific territories not covered by the World Bank handled manually. Full
sourcing and per-year values live in `scripts/fetch_worldbank_gdp_pop.py`; summary
of method below.

| Country | GDP source | Population source | Notes |
|---|---|---|---|
| 17 WB-covered countries | World Bank `NY.GDP.MKTP.CD` (current USD) | World Bank `SP.POP.TOTL` | Annual `2010-2024`; nearest-year fallback (±3 yrs) where a year is missing. |
| Cook Islands (`CK`) | UN SNAAMA total GDP, current USD (data.un.org, grID:101, pcFlag:0, crID:184). **2019-2024 direct**; **2010-2018 reconstructed** = UN per-capita GDP × 16,000 resident pop. | UN-implied resident pop: 16,129→14,222 for 2019-2023, held 16,000 pre-2019, 14,222 for 2024. | Not in WB API. UN per-capita × the *demographic* POP table was rejected — different population universes, overstated GDP up to 50%. 2018→2019 join is smooth ($380M→$391M). |
| Niue (`NU`) | Niue Statistics Office, *National Accounts Estimates of Niue 2024* (NZD current prices), converted to USD at annual avg NZD/USD. | Same Niue Statistics Office publication, per year. | Not in WB API, and **not in UN SNAAMA** (0 records) nor practically in ADB — the Niue Stats Office *is* the primary source. Years before 2015 use 2015. |
| Tokelau (`TK`) | Flat placeholder USD 12M (CIA Factbook / SPC per-capita × pop). | Flat 2,424 (2023 census). | No national accounts exist anywhere. **Zero rows in the dashboard datasets** — never affects a displayed figure. |
| Wallis & Futuna (`WF`) | Flat placeholder USD 212M (Banque de France / ISPF 2019 survey). | Flat 11,151 (2023 census). | GDP estimated only ~every 15 yrs. **Zero rows in the dashboard datasets** — inert. |
