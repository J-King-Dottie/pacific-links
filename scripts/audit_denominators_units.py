#!/usr/bin/env python3
"""
Audit denominator-derived columns and unit consistency.

This checks that published percentage columns are computed from the published
value and the denominator table:
- pct_gdp = value_usd / GDP * 100
- pct_population = value_people / population * 100

It also checks basic unit expectations, including that arms transfer volume is
not accidentally treated as USD and that negative values only appear where the
methodology allows them.
"""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "dashboard" / "public" / "data"
RAW = ROOT / "data" / "raw"


@dataclass(frozen=True)
class MetricDef:
    name: str
    csv_name: str
    value_col: str
    pct_col: str | None
    denominator: str | None
    allow_negative: bool = False


METRICS = [
    MetricDef("Aid spent", "aid_by_donor_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Aid promised", "aid_committed_by_donor_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Imports", "imports_by_supplier_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Exports", "exports_by_destination_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Debt", "debt_by_creditor_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Security assistance", "security_assistance_by_provider_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Security arms", "security_arms_by_supplier_year.csv", "value_tiv", None, None),
    MetricDef("Remittances", "remittances_by_source_year.csv", "value_usd", "pct_gdp", "gdp"),
    MetricDef("Migration", "migrants_abroad_by_destination_year.csv", "value_people", "pct_population", "population"),
    MetricDef("Students", "students_by_destination_year.csv", "value_people", "pct_population", "population"),
    MetricDef("FDI", "fdi_positions_by_investor_year.csv", "value_usd", "pct_gdp", "gdp", allow_negative=True),
    MetricDef("Portfolio", "portfolio_positions_by_holder_year.csv", "value_usd", "pct_gdp", "gdp"),
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def fnum(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def load_denominators() -> dict[str, dict[int, dict[str, float | None]]]:
    out: dict[str, dict[int, dict[str, float | None]]] = {}
    for r in read_csv(RAW / "worldbank_gdp_pop.csv"):
        iso2 = r["iso2"]
        year = int(r["year"])
        out.setdefault(iso2, {})[year] = {
            "gdp": fnum(r.get("gdp_usd")),
            "population": fnum(r.get("population")),
        }
    return out


def best_denominator(denoms: dict[str, dict[int, dict[str, float | None]]], iso2: str, year: int, kind: str) -> tuple[float | None, int | None]:
    country = denoms.get(iso2, {})
    if country.get(year, {}).get(kind):
        return country[year][kind], year
    for delta in range(1, 4):
        for candidate in (year - delta, year + delta):
            if country.get(candidate, {}).get(kind):
                return country[candidate][kind], candidate
    return None, None


def audit_metric(metric: MetricDef, denoms: dict[str, dict[int, dict[str, float | None]]]) -> tuple[list[str], str]:
    issues: list[str] = []
    rows = read_csv(PUBLIC / metric.csv_name)
    checked_pct = 0
    missing_pct = 0
    missing_denominator = 0
    pct_mismatches = 0
    negative_values = 0
    fallback_denominator_years = 0

    for i, r in enumerate(rows, start=2):
        value = fnum(r.get(metric.value_col))
        if value is None:
            issues.append(f"{metric.name}: row {i} has non-numeric {metric.value_col}")
            continue
        if value < 0:
            negative_values += 1
            if not metric.allow_negative:
                issues.append(f"{metric.name}: row {i} has unexpected negative value {value}")
                if len(issues) > 20:
                    break

        if not metric.pct_col:
            if any(k.startswith("pct_") and str(v).strip() for k, v in r.items()):
                issues.append(f"{metric.name}: row {i} has a percentage column despite no denominator metric")
                if len(issues) > 20:
                    break
            continue

        pct = fnum(r.get(metric.pct_col))
        if pct is None:
            missing_pct += 1
            continue

        year = int(r["year"])
        denom, denom_year = best_denominator(denoms, r["pacific_code"], year, metric.denominator or "")
        if not denom:
            missing_denominator += 1
            continue
        if denom_year != year:
            fallback_denominator_years += 1

        expected = round(value / denom * 100, 4)
        checked_pct += 1
        if abs(pct - expected) > 0.00015:
            pct_mismatches += 1
            if pct_mismatches <= 10:
                issues.append(
                    f"{metric.name}: row {i} {r['pacific_code']} {year} {metric.pct_col} {pct} != recomputed {expected}"
                )

    if pct_mismatches > 10:
        issues.append(f"{metric.name}: {pct_mismatches} total percentage mismatches")
    if missing_denominator:
        issues.append(f"{metric.name}: {missing_denominator} rows could not find a denominator within +/-3 years")
    if metric.pct_col and checked_pct == 0:
        issues.append(f"{metric.name}: no percentage rows were checked")

    summary = (
        f"- {metric.name}: {len(rows):,} rows; checked {checked_pct:,} percentages; "
        f"missing pct {missing_pct:,}; denominator fallbacks {fallback_denominator_years:,}; "
        f"negative values {negative_values:,}"
    )
    return issues, summary


def main() -> int:
    denoms = load_denominators()
    all_issues: list[str] = []
    summaries: list[str] = []

    for metric in METRICS:
        issues, summary = audit_metric(metric, denoms)
        all_issues.extend(issues)
        summaries.append(summary)

    print("# Denominator and Unit Audit")
    print()
    print("## Summary")
    print("\n".join(summaries))
    print()
    print("## Result")
    if all_issues:
        for issue in all_issues[:60]:
            print(f"- FAIL: {issue}")
        if len(all_issues) > 60:
            print(f"- FAIL: {len(all_issues) - 60} additional issues omitted")
        return 1
    print("- PASS: percentage columns recompute from the published values and denominator table; unit expectations are consistent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
