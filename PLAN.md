# Pacific Economic Exposure Map

## Purpose

Build a comparable dataset showing how each Pacific country is economically exposed to external countries through five channels:

- Aid inflows by source country
- Trade by partner country
- Tourism by origin country
- Remittances by origin country
- Foreign direct investment (FDI) by source country

The first phase is data discovery, collection, normalization, and validation. Dashboard design comes after the dataset is credible.

## Initial scope decisions

Before collecting data, define:

### Canonical Pacific scope

Always test source coverage against these 22 Pacific Island countries and territories:

- **Melanesia:** Fiji, New Caledonia, Papua New Guinea, Solomon Islands, Vanuatu
- **Micronesia:** Federated States of Micronesia, Guam, Kiribati, Marshall Islands, Nauru, Northern Mariana Islands, Palau, American Samoa
- **Polynesia:** Cook Islands, Niue, French Polynesia, Pitcairn Islands, Samoa, Tokelau, Tonga, Tuvalu, Wallis and Futuna

Processed datasets should include every available member and document unavailable members rather than silently reducing the project scope.

1. **Pacific country list** — decide whether this means Pacific Island Countries and Territories, Pacific Islands Forum members, or another explicit set.
2. **Time coverage** — target annual observations and identify a common range supported by all five channels.
3. **Exposure measures** — preserve raw values, then derive shares of each recipient country's total and normalized measures such as value per capita or share of GDP where useful.
4. **Partner treatment** — retain individual source/partner countries; separately label aggregates, regions, multilateral institutions, and unknown origins.
5. **Currency and prices** — retain reported values and units, while producing a comparable USD series with a clearly documented conversion method.

## Proposed canonical data model

Use a long-form table as the core output:

| Field | Meaning |
|---|---|
| `recipient_iso3` | Pacific recipient/destination country |
| `partner_iso3` | Donor, trade partner, tourist origin, remittance origin, or FDI source |
| `channel` | `aid`, `trade_exports`, `trade_imports`, `tourism`, `remittances`, or `fdi` |
| `year` | Observation year |
| `value` | Normalized numeric value |
| `unit` | USD, persons/arrivals, percentage, etc. |
| `value_type` | Flow, stock, commitment, disbursement, arrivals, expenditure, etc. |
| `source` | Publishing organization or dataset |
| `source_url` | Dataset/API reference |
| `retrieved_at` | Retrieval date |
| `quality_flag` | Missing, estimated, aggregate partner, conflicting source, etc. |
| `notes` | Methodological qualifications |

Keep raw source extracts unchanged and transform them into this canonical table through reproducible scripts later.

## Data-source investigation

Candidate source families to assess, without committing until coverage is tested:

### Pacific Data Hub access

This project includes a small reusable client for SPC's public PDH.stat SDMX API at
`https://stats-sdmx-disseminate.pacificdata.org/rest`. It does not require credentials.
Install `requirements.txt`, then search the live catalogue with:

```bash
python -m scripts.search_pdh "trade imports exports"
python -m scripts.search_pdh "aid development finance"
python -m scripts.search_pdh "tourism arrivals origin"
python -m scripts.search_pdh "remittances bilateral"
python -m scripts.search_pdh "foreign direct investment"
```

The catalogue is cached under `runtime/cache/` for one day. Once a dataflow is selected,
use `get_metadata()` before `retrieve_data()` because SDMX dimension order varies by dataset.

Generate the processed aid time series with:

```bash
python -m scripts.build_aid_timeseries
```

This writes `data/processed/aid_by_donor_year.csv` with separate spent and committed columns, plus accompanying metadata.

Generate annual merchandise imports by supplier, with all commodities combined:

```bash
python -m scripts.build_trade_imports
```

Generate IMF bilateral inward direct-investment positions with:

```bash
python -m scripts.build_fdi_positions
```

Generate the sparse World Bank/KNOMAD bilateral remittance series with:

```bash
python -m scripts.build_remittance_timeseries
```

- **Aid:** OECD development finance data, IATI, and donor-specific reporting where smaller Pacific recipients are missing.
- **Trade:** UN Comtrade and related international trade datasets; national statistics for gaps.
- **Tourism:** national statistics offices, tourism authorities, and regional/international tourism datasets.
- **Remittances:** bilateral remittance matrices and central-bank or national reporting. Origin-country detail is likely to be one of the hardest fields.
- **FDI:** IMF coordinated direct investment data, UNCTAD, and national statistics. Source-country suppression and inconsistent flow/stock definitions are expected constraints.

## Work plan

### Phase 1 — Scope and feasibility

- Finalize the recipient-country list.
- Create a source-coverage matrix: country × channel × year × source.
- Select a primary and fallback source for each channel.
- Record licensing, API, download, and citation requirements.
- Identify channels where bilateral detail is unavailable or methodologically weak.

### Phase 2 — Data pipeline

- Establish folders for raw, interim, processed, metadata, and scripts.
- Download source data reproducibly and preserve raw files.
- Standardize country identifiers using ISO codes plus a controlled mapping for territories and aggregates.
- Normalize years, currencies, units, and bilateral partner labels.
- Produce the canonical long-form dataset and channel-specific validation reports.

### Phase 3 — Quality assurance

- Compare bilateral sums with published recipient totals.
- Detect duplicates, missing years, abrupt breaks, negative values, and unit changes.
- Separate reported zeros from missing observations.
- Document estimation or allocation methods; do not silently fill gaps.
- Assign confidence/coverage indicators by country, channel, and year.

### Phase 4 — Analysis outputs

- Calculate partner shares within each channel.
- Calculate concentration metrics and largest-partner dependence.
- Create cross-channel exposure profiles without combining unlike units prematurely.
- Export dashboard-ready tables and geographic metadata.

### Phase 5 — Dashboard design

Potential views include a Pacific map, country profiles, partner network flows, channel comparisons, time trends, and data-quality indicators. Dashboard choices should follow the actual coverage and reliability found in Phase 1.

## Key methodological risks

- Bilateral remittance and FDI data may be sparse, modeled, confidential, or available only for selected years.
- Aid can refer to commitments or disbursements and may include regional projects that cannot be cleanly allocated.
- Trade requires separate treatment of imports and exports and consistent reporter/partner orientation.
- Tourism may report arrivals, visitors, nights, or expenditure, which are not interchangeable.
- Territories and freely associated states may not map cleanly to standard country codes across sources.
- A single composite “exposure score” could conceal incompatible units and data quality; defer it until the component data is understood.

## First concrete deliverable

A coverage matrix and short source assessment that answers: for every proposed Pacific country and each of the five channels, what bilateral data exists, for which years, at what quality, and under what definition?
