#!/usr/bin/env python3
"""
Audit source-to-public traceability where local source/intermediate files exist.

Checks:
- every processed dashboard CSV is byte-identical to its public CSV
- BACI raw import/export rows trace into public trade rows
- IDS saved debt part rows trace into public debt rows
- KNOMAD/World Bank remittance benchmark rows trace into public remittance rows

Other metrics are covered by processed/public sync plus their build metadata,
because their local raw source format is either a downloaded bulk extract or
not retained in a simple row-compatible intermediate file.
"""

from __future__ import annotations

import csv
import filecmp
import math
import runpy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "dashboard" / "public" / "data"
PROCESSED = ROOT / "data" / "processed"
RAW = ROOT / "data" / "raw"
NORMALIZER = ROOT / "scripts" / "normalize_for_dashboard.py"

PUBLIC_CSVS = [
    "aid_by_donor_year.csv",
    "aid_committed_by_donor_year.csv",
    "imports_by_supplier_year.csv",
    "exports_by_destination_year.csv",
    "debt_by_creditor_year.csv",
    "security_assistance_by_provider_year.csv",
    "security_arms_by_supplier_year.csv",
    "remittances_by_source_year.csv",
    "migrants_abroad_by_destination_year.csv",
    "students_by_destination_year.csv",
    "fdi_positions_by_investor_year.csv",
    "portfolio_positions_by_holder_year.csv",
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


def assert_close(label: str, got: float | None, expected: float | None, issues: list[str], tolerance: float = 0.05) -> None:
    if got is None or expected is None:
        issues.append(f"{label}: missing numeric value got={got} expected={expected}")
    elif abs(got - expected) > tolerance:
        issues.append(f"{label}: {got} != {expected}")


def audit_processed_public_sync() -> tuple[list[str], list[str]]:
    issues: list[str] = []
    summary: list[str] = []
    for name in PUBLIC_CSVS:
        processed = PROCESSED / name
        public = PUBLIC / name
        if not processed.exists():
            issues.append(f"{name}: missing processed CSV")
            continue
        if not public.exists():
            issues.append(f"{name}: missing public CSV")
            continue
        if not filecmp.cmp(processed, public, shallow=False):
            issues.append(f"{name}: processed and public CSV differ")
        summary.append(f"- {name}: processed/public byte sync checked")
    return issues, summary


def key_trade(row: dict[str, str], flow: str) -> tuple[str, str, int, str]:
    cp_col = "supplier_code" if flow == "imports" else "destination_code"
    return (row["reporter_code"], row[cp_col], int(row["year"]), row["hs1_code"])


def key_public_trade(row: dict[str, str]) -> tuple[str, str, int, str]:
    return (row["pacific_code"], row["counterpart_code"], int(row["year"]), row["hs1_code"])


def audit_baci(flow: str, public_name: str, raw_name: str, pacific_scope: set[str]) -> tuple[list[str], str]:
    issues: list[str] = []
    raw_rows = read_csv(RAW / raw_name)
    public_rows = read_csv(PUBLIC / public_name)
    raw_map = {
        key_trade(r, flow): fnum(r["value_usd"])
        for r in raw_rows
        if r.get("reporter_code") in pacific_scope and fnum(r.get("value_usd")) and fnum(r.get("value_usd")) > 0
    }
    public_map = {key_public_trade(r): fnum(r["value_usd"]) for r in public_rows}

    missing = set(raw_map) - set(public_map)
    extra = set(public_map) - set(raw_map)
    if missing:
        issues.append(f"{flow}: {len(missing)} raw BACI rows missing from public output; first {sorted(missing)[0]}")
    if extra:
        issues.append(f"{flow}: {len(extra)} public rows not found in raw BACI; first {sorted(extra)[0]}")

    for key in sorted(set(raw_map) & set(public_map))[:200]:
        assert_close(f"{flow} {key}", public_map[key], raw_map[key], issues)
        if len(issues) > 20:
            break
    top_key = max(raw_map, key=lambda k: raw_map[k] or 0)
    assert_close(f"{flow} top row {top_key}", public_map.get(top_key), raw_map[top_key], issues)
    return issues, f"- {flow}: traced {len(raw_map):,} raw BACI rows to {len(public_map):,} public rows; top row {top_key}"


def audit_debt_parts() -> tuple[list[str], str]:
    issues: list[str] = []
    public = {
        (r["pacific_code"], r["counterpart_code"], int(r["year"])): fnum(r["value_usd"])
        for r in read_csv(PUBLIC / "debt_by_creditor_year.csv")
    }
    checked = 0
    for part in sorted((PROCESSED / "ids_debt_parts").glob("*.csv")):
        for r in read_csv(part):
            key = (r["recipient_code"], r["creditor_code"], int(r["year"]))
            if key not in public:
                issues.append(f"debt part {part.name}: missing public row {key}")
                continue
            assert_close(f"debt part {part.name} {key}", public[key], fnum(r["value_usd"]), issues)
            checked += 1
            if len(issues) > 20:
                break
    return issues, f"- debt: traced {checked:,} IDS part rows into public debt rows"


def audit_remittance_benchmarks(ctx: dict[str, object]) -> tuple[list[str], str]:
    issues: list[str] = []
    iso3_to_iso2: dict[str, str] = ctx["ISO3_TO_ISO2"]
    pacific_scope: set[str] = ctx["PACIFIC_SCOPE"]
    skip_codes: set[str] = ctx["REMITTANCE_SKIP_CODES"]
    skip_name_bits: list[str] = ctx["REMITTANCE_SKIP_NAME_SUBSTRINGS"]
    public = {
        (r["pacific_code"], r["counterpart_code"], int(r["year"])): fnum(r["value_usd"])
        for r in read_csv(PUBLIC / "remittances_by_source_year.csv")
    }
    expected: dict[tuple[str, str, int], float] = {}
    for bench in sorted((PROCESSED / "remittance_benchmarks").glob("*.csv")):
        for r in read_csv(bench):
            pac = r["recipient_code"]
            raw_code = r["source_code"].strip()
            name = r["source_name"].strip().lower()
            if pac not in pacific_scope:
                continue
            if raw_code in skip_codes or any(bit in name for bit in skip_name_bits):
                continue
            cp = iso3_to_iso2.get(raw_code, raw_code if len(raw_code) == 2 else "")
            if not cp:
                continue
            value = fnum(r["remittance_estimate_usd"])
            if value is None or value <= 0:
                continue
            expected[(pac, cp, int(r["year"]))] = value

    missing = set(expected) - set(public)
    extra = set(public) - set(expected)
    if missing:
        issues.append(f"remittances: {len(missing)} benchmark rows missing from public output; first {sorted(missing)[0]}")
    if extra:
        issues.append(f"remittances: {len(extra)} public rows not found in benchmark files; first {sorted(extra)[0]}")
    for key in sorted(set(expected) & set(public))[:200]:
        assert_close(f"remittances {key}", public[key], expected[key], issues)
        if len(issues) > 20:
            break
    top_key = max(expected, key=lambda k: expected[k])
    assert_close(f"remittances top row {top_key}", public.get(top_key), expected[top_key], issues)
    return issues, f"- remittances: traced {len(expected):,} benchmark rows to {len(public):,} public rows; top row {top_key}"


def main() -> int:
    ctx = runpy.run_path(str(NORMALIZER))
    issues, summary = audit_processed_public_sync()

    for flow, public_name, raw_name in (
        ("imports", "imports_by_supplier_year.csv", "baci_imports.csv"),
        ("exports", "exports_by_destination_year.csv", "baci_exports.csv"),
    ):
        flow_issues, flow_summary = audit_baci(flow, public_name, raw_name, ctx["PACIFIC_SCOPE"])
        issues.extend(flow_issues)
        summary.append(flow_summary)

    debt_issues, debt_summary = audit_debt_parts()
    issues.extend(debt_issues)
    summary.append(debt_summary)

    remit_issues, remit_summary = audit_remittance_benchmarks(ctx)
    issues.extend(remit_issues)
    summary.append(remit_summary)

    print("# Source Trace Audit")
    print()
    print("## Summary")
    print("\n".join(summary))
    print()
    print("## Result")
    if issues:
        for issue in issues[:60]:
            print(f"- FAIL: {issue}")
        if len(issues) > 60:
            print(f"- FAIL: {len(issues) - 60} additional issues omitted")
        return 1
    print("- PASS: public CSVs are synchronized with processed outputs, and local row-compatible source/intermediate files trace into public rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
