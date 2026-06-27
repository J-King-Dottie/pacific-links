#!/usr/bin/env python3
"""
Audit outliers and source-data weirdness disclosures.

This audit deliberately does not fail just because source data has extreme
values. Pacific bilateral data can be weird. It fails when extreme values are
present but the user-facing methodology does not explain the relevant caveat.
"""

from __future__ import annotations

import csv
import math
import runpy
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "dashboard" / "public" / "data"
SIDE_PANEL = ROOT / "dashboard" / "src" / "components" / "SidePanel.jsx"
NORMALIZER = ROOT / "scripts" / "normalize_for_dashboard.py"


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    csv_name: str
    value_col: str
    pct_col: str | None
    high_pct_threshold: float | None = None
    disclosure_terms: tuple[str, ...] = ()
    allow_negative: bool = False


METRICS = [
    MetricDef("aid", "Aid spent", "aid_by_donor_year.csv", "value_usd", "pct_gdp", 75, ("very small economies", "share of GDP")),
    MetricDef("aid_committed", "Aid promised", "aid_committed_by_donor_year.csv", "value_usd", "pct_gdp", 75, ("very small economies", "commitment", "share of GDP")),
    MetricDef("trade", "Imports", "imports_by_supplier_year.csv", "value_usd", "pct_gdp", 100, ("recorded goods trade", "ship registry", "bunkering", "transshipment")),
    MetricDef("exports", "Exports", "exports_by_destination_year.csv", "value_usd", "pct_gdp", 100, ("recorded goods trade", "ship registry", "bunkering")),
    MetricDef("debt", "Debt", "debt_by_creditor_year.csv", "value_usd", "pct_gdp"),
    MetricDef("security", "Security assistance", "security_assistance_by_provider_year.csv", "value_usd", "pct_gdp"),
    MetricDef("security_arms", "Security arms", "security_arms_by_supplier_year.csv", "value_tiv", None, None, ("not US dollars", "arms transfer volume")),
    MetricDef("remittances", "Remittances", "remittances_by_source_year.csv", "value_usd", "pct_gdp"),
    MetricDef("migration", "Migration", "migrants_abroad_by_destination_year.csv", "value_people", "pct_population", 100, ("over 100%", "not annual moves")),
    MetricDef("students", "Students", "students_by_destination_year.csv", "value_people", "pct_population"),
    MetricDef("fdi", "FDI", "fdi_positions_by_investor_year.csv", "value_usd", "pct_gdp", 100, ("Marshall Islands", "ship registry", "corporate structures"), True),
    MetricDef("portfolio", "Portfolio", "portfolio_positions_by_holder_year.csv", "value_usd", "pct_gdp", 100, ("Marshall Islands", "ship registry", "financial structures")),
]


METRIC_NAME_MAP = {
    "Aid": "aid",
    "Aid committed": "aid_committed",
    "Imports": "trade",
    "Exports": "exports",
    "Debt": "debt",
    "Security assistance": "security",
    "Security arms": "security_arms",
    "Remittances": "remittances",
    "Migration": "migration",
    "Students": "students",
    "FDI": "fdi",
    "Portfolio": "portfolio",
}


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


def methodology_text() -> dict[str, str]:
    text = SIDE_PANEL.read_text(encoding="utf-8")
    ctx = runpy.run_path(str(NORMALIZER))
    out: dict[str, str] = defaultdict(str)
    for source_name, key in METRIC_NAME_MAP.items():
        marker = f"  {key}: {{"
        start = text.find(marker)
        if start >= 0:
            end_match = text.find("\n  " + ("aid_committed" if key == "aid" else "__never__") + ": {", start + len(marker))
            next_match = None
            import re
            m = re.search(r"\n  [a-z_]+: \{", text[start + len(marker):])
            if m:
                next_match = start + len(marker) + m.start()
            block_end = next_match if next_match else text.find("\n}\nconst PAC_NAMES", start)
            out[key] += " " + text[start:block_end]
        for item in ctx["METRIC_META"]:
            if item["metric"] == source_name:
                out[key] += " " + " ".join(str(v) for v in item.values() if not isinstance(v, list))
    return out


def row_label(row: dict[str, str], value_col: str, pct_col: str | None) -> str:
    detail = row.get("hs1_name") or row.get("sector_name") or row.get("weapon_designation") or ""
    pct = f", {pct_col}={row.get(pct_col)}" if pct_col else ""
    return (
        f"{row.get('pacific_code')}->{row.get('counterpart_code')} {row.get('year')} "
        f"{value_col}={row.get(value_col)}{pct}" + (f" ({detail})" if detail else "")
    )


def largest_yoy_jump(rows: list[dict[str, str]], metric: MetricDef) -> str:
    by_pair: dict[tuple[str, str], dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for r in rows:
        value = fnum(r.get(metric.value_col))
        if value is None or value <= 0:
            continue
        by_pair[(r.get("pacific_code", ""), r.get("counterpart_code", ""))][int(r["year"])] += value

    best: tuple[float, str] | None = None
    for (pac, cp), years in by_pair.items():
        ordered = sorted(years)
        for prev, curr in zip(ordered, ordered[1:]):
            before = years[prev]
            after = years[curr]
            if before <= 0 or after <= 0:
                continue
            ratio = max(after / before, before / after)
            if ratio < 10:
                continue
            label = f"{pac}->{cp} observed years {prev}-{curr}: {before:,.2f} to {after:,.2f} ({ratio:.1f}x)"
            if best is None or ratio > best[0]:
                best = (ratio, label)
    return best[1] if best else "no >10x jump between consecutive observed years"


def main() -> int:
    method = methodology_text()
    issues: list[str] = []
    summary: list[str] = []

    for metric in METRICS:
        rows = read_csv(PUBLIC / metric.csv_name)
        numeric = [(fnum(r.get(metric.value_col)), fnum(r.get(metric.pct_col)) if metric.pct_col else None, r) for r in rows]
        numeric = [(v, p, r) for v, p, r in numeric if v is not None]
        if not numeric:
            issues.append(f"{metric.label}: no numeric values")
            continue

        negatives = [(v, r) for v, _, r in numeric if v < 0]
        if negatives and not metric.allow_negative:
            issues.append(f"{metric.label}: unexpected negative values, first {row_label(negatives[0][1], metric.value_col, metric.pct_col)}")

        top_value = max(numeric, key=lambda x: x[0])
        pct_rows = [(v, p, r) for v, p, r in numeric if p is not None]
        top_pct = max(pct_rows, key=lambda x: x[1]) if pct_rows else None

        if metric.pct_col and metric.high_pct_threshold is not None:
            high = [x for x in pct_rows if x[1] > metric.high_pct_threshold]
            if high:
                missing = [term for term in metric.disclosure_terms if term.lower() not in method[metric.key].lower()]
                if missing:
                    issues.append(f"{metric.label}: {len(high)} high-percentage rows but missing disclosure terms {missing}")

        if metric.key == "security_arms":
            if "value_usd" in rows[0] or "pct_gdp" in rows[0] or "pct_population" in rows[0]:
                issues.append("Security arms: arms transfer volume should not expose USD or percentage columns")
            missing = [term for term in metric.disclosure_terms if term.lower() not in method[metric.key].lower()]
            if missing:
                issues.append(f"Security arms: missing arms-volume disclosure terms {missing}")

        pct_text = row_label(top_pct[2], metric.value_col, metric.pct_col) if top_pct else "no percentage column"
        summary.append(
            f"- {metric.label}: top value {row_label(top_value[2], metric.value_col, metric.pct_col)}; "
            f"top percentage {pct_text}; YoY check {largest_yoy_jump(rows, metric)}"
        )

    print("# Outlier and Weirdness Audit")
    print()
    print("## Summary")
    print("\n".join(summary))
    print()
    print("## Result")
    if issues:
        for issue in issues:
            print(f"- FAIL: {issue}")
        return 1
    print("- PASS: extreme values are numerically valid and the relevant source-data weirdness is disclosed in user-facing methodology.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
