# Audit Log

This file tracks substantial audits completed on Pacific Links so we do not repeat the same checks without reason.

## 2026-06-27 - Data-to-UI integrity audit

**Status:** Passed

**Command:**

```bash
.venv/bin/python scripts/audit_data_ui_integrity.py
```

**Scope:**

- Public dashboard CSVs load into the same relationship shape the UI expects.
- Latest mode uses each Pacific-country/partner relationship's latest available year.
- Grouped parent rows match detail rows for imports, exports, security assistance, and security arms.
- Toggle pairs are distinct and not accidentally stuck on the same values.
- Excel tabs match the public CSV aggregates.
- Outside-partner footprints were checked for Australia, New Zealand, China, and the United States.

**Result summary:**

- CSVs, latest-mode aggregates, grouped details, toggles, and Excel tabs are internally consistent.
- Sparse metrics remain visible in latest mode: security arms latest rows span 2017-2024, remittances span 2010-2021, and relationship-level latest years are preserved.
- Australia toggle sanity checks were distinct:
  - Aid spent vs promised: $803.96M vs $981.12M.
  - Imports vs exports: $2.35B vs $2.96B.
  - Security assistance vs arms: $6.43M vs $46.29 arms transfer volume.
  - FDI vs portfolio: $17.06B vs $90.13M.

**Follow-up:**

- Keep `scripts/audit_data_ui_integrity.py` as the repeatable check after future metric additions or loader/table changes.

## 2026-06-27 - Directionality and plain-language audit

**Status:** Passed after copy updates

**Scope:**

- Left-pane questions for default Pacific ranking, selected Pacific country, selected outside partner, and comparison views.
- Methodology/info tooltip copy for all metrics.
- Download metadata generated from `scripts/normalize_for_dashboard.py`.

**Result summary:**

- Pacific-country views now describe the partner relationship from the Pacific side, for example who sells to Vanuatu, buys from Vanuatu, lends to Vanuatu, or invests in Vanuatu.
- Outside-partner views now describe the selected partner's Pacific footprint, for example where Australia sells goods, buys goods, funds security assistance, lends money, or has investment.
- Methodology text was simplified by replacing jargon such as stock/flow, bilateral flow, and purpose-code family with plainer wording.

**Follow-up:**

- Re-run the language audit whenever a new metric is added or a relationship direction changes.

## 2026-06-27 - Coverage and missingness audit

**Status:** Passed

**Command:**

```bash
.venv/bin/python scripts/audit_coverage_missingness.py
```

**Scope:**

- Public metric CSVs were checked for required columns, valid 2010-2024 years, expected Pacific-country coverage, partner counts, and duplicate relationship/detail/year keys.
- Known sparse datasets were checked against explicit expectations rather than treated as full-coverage datasets.

**Result summary:**

- Core broad metrics cover all 14 Pacific countries: aid spent, aid promised, imports, exports, security assistance, migration, students, and FDI.
- Expected sparse metrics were confirmed: debt covers 6 World Bank IDS reporting Pacific countries with public positive rows; security arms covers 5 Pacific countries; remittances covers 11; portfolio covers 13.
- Trade files have the widest partner coverage: imports cover 224 partners and exports cover 217 partners.
- The audit passed with no duplicate relationship/detail/year keys.

**Follow-up:**

- Re-run after source refreshes, new metric additions, or changes to filtering rules.

## 2026-06-27 - Provenance and reproducibility audit

**Status:** Passed

**Command:**

```bash
.venv/bin/python scripts/audit_provenance_reproducibility.py
```

**Scope:**

- Checked every published metric against the normalizer metadata used by the app and Excel export.
- Confirmed each metric has a public CSV, processed CSV, dashboard metadata entry, Excel tab, About-sheet source citation, release/pulled date, and repository documentation.
- Checked richer processed metadata files where the source build pipeline writes them, and checked file-backed source vintage for BACI trade and IDS debt.

**Result summary:**

- All published metrics have aligned source metadata, public CSVs, Excel tabs, About-sheet citations, and repo documentation.
- The audit caught one documentation drift issue: README used a shortened migration source label. It now uses the full source name, `UN International Migrant Stock 2024`, matching the app and pipeline.

**Follow-up:**

- Re-run after source metadata edits, Excel download changes, documentation changes, or new metric additions.

## 2026-06-27 - Denominator and unit audit

**Status:** Passed

**Command:**

```bash
.venv/bin/python scripts/audit_denominators_units.py
```

**Scope:**

- Recomputed every `% of GDP` and `% of population` field from the published value and `data/raw/worldbank_gdp_pop.csv`.
- Checked that money metrics use `value_usd`, people metrics use `value_people`, and SIPRI arms transfers use `value_tiv` without a percentage denominator.
- Checked negative-value handling, allowing it only for FDI where the methodology already explains negative investment positions.

**Result summary:**

- All percentage columns recompute from the published values and denominator table.
- No percentage values were missing in metrics that should have them.
- Expected denominator fallbacks were observed where the exact GDP year is unavailable, including trade, aid, debt, security assistance, and FDI rows.
- FDI has 74 negative rows; these recompute correctly and remain allowed because negative FDI positions are valid source records.

**Follow-up:**

- Re-run after denominator updates, source refreshes, or any change to percentage calculations.

## 2026-06-27 - Coded directionality and methodology audit

**Status:** Passed after copy updates

**Command:**

```bash
.venv/bin/python scripts/audit_directionality_methodology.py
```

**Scope:**

- Checked user-facing left-pane questions for plain-language directionality.
- Checked app methodology copy and download metadata for each metric.
- Required known caveats to be present for trade, FDI, portfolio investment, migration, students, security arms, remittances, aid commitments, and debt coverage.

**Result summary:**

- The audit caught and fixed a debt coverage mismatch: IDS has seven Pacific debtor countries in scope, but the current published positive creditor-level rows cover six.
- The audit strengthened caveats for trade transshipment, aid values in very small economies, portfolio investment distortions, and security-assistance scope.
- The final audit passed: questions and methodology explain directionality and known source-data weirdness in plain language.

**Follow-up:**

- Re-run after any wording, methodology, metric-direction, or UI question changes.

## 2026-06-27 - Outlier and weirdness audit

**Status:** Passed after caveat updates

**Command:**

```bash
.venv/bin/python scripts/audit_outliers_weirdness.py
```

**Scope:**

- Listed top values, top percentage-of-GDP/population rows, and largest jumps between consecutive observed years for every metric.
- Checked that extreme values are numerically valid and that the relevant caveats are disclosed in user-facing methodology.
- Treated outliers as source-data features to explain, not as errors to hide.

**Result summary:**

- Confirmed extreme trade, FDI, portfolio, migration, and aid-commitment values are present and documented.
- Portfolio methodology now explains why Marshall Islands values can be far above GDP because of ship registry, corporate, and financial structures.
- Aid methodology now explains why large projects or commitments can look very large as a share of GDP for very small economies.

**Follow-up:**

- Re-run after source refreshes, methodology edits, or any change to outlier handling.

## 2026-06-27 - Source trace audit

**Status:** Passed

**Command:**

```bash
.venv/bin/python scripts/audit_source_trace_samples.py
```

**Scope:**

- Checked every processed dashboard CSV is byte-identical to its public CSV.
- Traced all local row-compatible BACI import/export rows into public trade rows.
- Traced saved IDS debt part rows into public debt rows.
- Traced mapped World Bank/KNOMAD remittance benchmark rows into public remittance rows.

**Result summary:**

- Processed and public CSVs are synchronized for all published metrics.
- BACI imports traced 64,357 raw rows to 64,357 public rows.
- BACI exports traced 48,015 raw rows to 48,015 public rows.
- Remittance benchmark rows traced 943 mapped rows to 943 public rows.
- IDS part files traced 331 saved part rows into public debt rows.

**Follow-up:**

- Re-run after any source refresh, normalizer change, or public data export change.

## 2026-06-27 - Full audit suite

**Status:** Passed

**Command:**

```bash
.venv/bin/python scripts/run_audits.py
```

**Scope:**

- Runs the seven repeatable audits covering data-to-UI integrity, coverage/missingness, provenance, denominators/units, directionality/methodology, outliers/weirdness, and source traceability.

**Result summary:**

- The current data layer, download, UI copy, methodology, and documented caveats pass the full audit suite.

**Follow-up:**

- Run this command before release and after any new metric, source refresh, methodology edit, or UI table/map behavior change.
