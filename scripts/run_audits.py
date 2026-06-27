#!/usr/bin/env python3
"""Run the Pacific Links audit suite."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

AUDITS = [
    "audit_data_ui_integrity.py",
    "audit_coverage_missingness.py",
    "audit_provenance_reproducibility.py",
    "audit_denominators_units.py",
    "audit_directionality_methodology.py",
    "audit_outliers_weirdness.py",
    "audit_source_trace_samples.py",
]


def main() -> int:
    python = sys.executable
    for audit in AUDITS:
        path = ROOT / "scripts" / audit
        print(f"\n=== {audit} ===")
        result = subprocess.run([python, str(path)], cwd=ROOT)
        if result.returncode:
            return result.returncode
    print("\nAll audits passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
