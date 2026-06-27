#!/usr/bin/env python3
"""
Audit metric coverage and missingness.

This is not a correctness audit of source data. It checks whether the dashboard
files honestly cover the expected Pacific countries, years and relationship
shapes after processing.
"""

from __future__ import annotations

import csv
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "dashboard" / "public" / "data"
YEAR_MIN = 2010
YEAR_MAX = 2024

PACIFIC = {
    "CK", "FJ", "KI", "MH", "FM", "NR", "NU",
    "PW", "PG", "WS", "SB", "TO", "TV", "VU",
}


@dataclass(frozen=True)
class MetricDef:
    name: str
    csv_name: str
    value_col: str
    pct_col: str | None
    expected_min_pacific: int
    detail_cols: tuple[str, ...] = ()
    note: str = ""


METRICS = [
    MetricDef("Aid spent", "aid_by_donor_year.csv", "value_usd", "pct_gdp", 14),
    MetricDef("Aid promised", "aid_committed_by_donor_year.csv", "value_usd", "pct_gdp", 14),
    MetricDef("Imports", "imports_by_supplier_year.csv", "value_usd", "pct_gdp", 14, ("hs1_code",), "detail rows by product group"),
    MetricDef("Exports", "exports_by_destination_year.csv", "value_usd", "pct_gdp", 14, ("hs1_code",), "detail rows by product group"),
    MetricDef("Debt", "debt_by_creditor_year.csv", "value_usd", "pct_gdp", 6, note="World Bank IDS reporting countries with public positive rows only"),
    MetricDef("Security assistance", "security_assistance_by_provider_year.csv", "value_usd", "pct_gdp", 14, ("sector_code",), "detail rows by security category"),
    MetricDef("Security arms", "security_arms_by_supplier_year.csv", "value_tiv", None, 1, ("weapon_designation", "delivery_years", "status"), "sparse event data"),
    MetricDef("Remittances", "remittances_by_source_year.csv", "value_usd", "pct_gdp", 10, note="benchmark years only"),
    MetricDef("Migration", "migrants_abroad_by_destination_year.csv", "value_people", "pct_population", 14, note="benchmark years only"),
    MetricDef("Students", "students_by_destination_year.csv", "value_people", "pct_population", 14),
    MetricDef("FDI", "fdi_positions_by_investor_year.csv", "value_usd", "pct_gdp", 14),
    MetricDef("Portfolio", "portfolio_positions_by_holder_year.csv", "value_usd", "pct_gdp", 13, note="source has positive rows for 13 Pacific countries"),
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def fnum(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def audit_metric(metric: MetricDef) -> tuple[list[str], list[str]]:
    rows = read_csv(PUBLIC / metric.csv_name)
    issues: list[str] = []
    summary: list[str] = []

    if not rows:
        return [f"{metric.name}: file has no rows"], []

    fieldnames = set(rows[0].keys())
    required = {"pacific_code", "pacific_name", "counterpart_code", "counterpart_name", "year", metric.value_col}
    if metric.pct_col:
        required.add(metric.pct_col)
    missing_cols = sorted(required - fieldnames)
    if missing_cols:
        issues.append(f"{metric.name}: missing columns {missing_cols}")

    invalid_years = []
    invalid_values = 0
    duplicate_keys = Counter()
    pac_years: dict[str, set[int]] = defaultdict(set)
    pac_partners: dict[str, set[str]] = defaultdict(set)
    partner_set = set()
    year_set = set()

    for r in rows:
        pac = r.get("pacific_code", "")
        cp = r.get("counterpart_code", "")
        try:
            year = int(r.get("year") or 0)
        except ValueError:
            year = 0

        value = fnum(r.get(metric.value_col))
        if value is None:
            invalid_values += 1
        if not (YEAR_MIN <= year <= YEAR_MAX):
            invalid_years.append(str(year))
        if pac and cp and YEAR_MIN <= year <= YEAR_MAX:
            pac_years[pac].add(year)
            pac_partners[pac].add(cp)
            partner_set.add(cp)
            year_set.add(year)

        key = (
            r.get("pacific_code", ""),
            r.get("counterpart_code", ""),
            r.get("year", ""),
            *[r.get(col, "") for col in metric.detail_cols],
        )
        duplicate_keys[key] += 1

    pac_codes = set(pac_years)
    unexpected_pacific = sorted(pac_codes - PACIFIC)
    missing_pacific = sorted(PACIFIC - pac_codes)
    duplicate_count = sum(1 for count in duplicate_keys.values() if count > 1)

    if unexpected_pacific:
        issues.append(f"{metric.name}: unexpected Pacific codes {unexpected_pacific}")
    if len(pac_codes) < metric.expected_min_pacific:
        issues.append(
            f"{metric.name}: expected at least {metric.expected_min_pacific} Pacific countries, found {len(pac_codes)}; missing {missing_pacific}"
        )
    if invalid_years:
        issues.append(f"{metric.name}: years outside {YEAR_MIN}-{YEAR_MAX}: {sorted(set(invalid_years))}")
    if invalid_values:
        issues.append(f"{metric.name}: {invalid_values} rows have non-numeric {metric.value_col}")
    if duplicate_count:
        issues.append(f"{metric.name}: {duplicate_count} duplicate relationship/detail/year keys")

    sparse = sorted((pac, len(years), len(pac_partners[pac])) for pac, years in pac_years.items())
    sparsest = ", ".join(f"{pac} {years}y/{partners}p" for pac, years, partners in sorted(sparse, key=lambda x: (x[1], x[2]))[:4])
    missing_text = f"; missing {', '.join(missing_pacific)}" if missing_pacific else ""
    note = f"; {metric.note}" if metric.note else ""
    summary.append(
        f"- {metric.name}: {len(rows):,} rows; {len(pac_codes)} Pacific countries{missing_text}; "
        f"{len(partner_set)} partners; years {min(year_set)}-{max(year_set)}; sparsest {sparsest}{note}"
    )
    return issues, summary


def main() -> int:
    all_issues: list[str] = []
    summaries: list[str] = []

    for metric in METRICS:
        issues, summary = audit_metric(metric)
        all_issues.extend(issues)
        summaries.extend(summary)

    print("# Coverage and Missingness Audit")
    print()
    print("## Summary")
    print("\n".join(summaries))
    print()
    print("## Result")
    if all_issues:
        for issue in all_issues:
            print(f"- FAIL: {issue}")
        return 1
    print("- PASS: metric files have expected columns, valid years, expected Pacific coverage, and no duplicate relationship/detail/year keys.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
