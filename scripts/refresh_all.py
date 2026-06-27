"""
One-command refresh for the Pacific Links dataset.

Runs every automatable source in order, then harmonizes and rebuilds the
download. The two benchmark sources (remittances, migration) are manual Excel
downloads that only update every few years — the runner reminds you about them
but does not block on them.

Usage:
  python3 scripts/refresh_all.py                # auto sources + normalize
  python3 scripts/refresh_all.py --skip-baci    # skip the ~2.4 GB BACI download
  python3 scripts/refresh_all.py --only-normalize  # just re-harmonize existing CSVs

Automatable (pulled fresh every run):
  - Aid    — Lowy Pacific Aid Map, live SDMX API
  - Debt   — World Bank IDS, live API
  - Trade  — CEPII BACI (downloads the published version ZIP)

Manual (update rarely; download the workbook then re-run normalize):
  - Remittances — World Bank/KNOMAD bilateral matrices (benchmark years)
  - FDI         — IMF Direct Investment Positions bulk export
  - Migration   — UN International Migrant Stock (benchmark years)
  See DATA_PIPELINE.md for the exact files and URLs.
"""

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
PY = sys.executable


def run(label, args, optional=False):
    print(f"\n{'='*70}\n  {label}\n{'='*70}")
    result = subprocess.run([PY, *args], cwd=ROOT)
    if result.returncode != 0:
        msg = f"  ! {label} failed (exit {result.returncode})"
        if optional:
            print(f"{msg} — continuing.")
            return False
        sys.exit(msg)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-baci", action="store_true", help="skip the large BACI trade download")
    ap.add_argument("--only-normalize", action="store_true", help="just re-harmonize existing processed CSVs")
    args = ap.parse_args()

    if not args.only_normalize:
        run("Aid — Lowy Pacific Aid Map (live SDMX)", ["scripts/build_aid_timeseries.py"])
        run("Debt — World Bank IDS (live API)", ["scripts/fetch_ids_debt.py"])
        run("Debt — merge country parts", ["scripts/merge_ids_debt_parts.py"])

        if args.skip_baci:
            print("\n  Skipping BACI trade refresh (--skip-baci). Using existing data/raw/baci_imports.csv.")
        else:
            run("Imports — CEPII BACI (download + extract + combine)", ["scripts/fetch_baci_trade.py"])

        print("\n" + "-"*70)
        print("  MANUAL sources (benchmark years, update rarely):")
        print("    Remittances — World Bank/KNOMAD bilateral matrices")
        print("    FDI         — IMF Direct Investment Positions bulk export")
        print("    Migration   — UN International Migrant Stock workbook")
        print("    If a newer benchmark exists, download per DATA_PIPELINE.md, then re-run")
        print("    the matching build script before this normalize step.")
        print("-"*70)

    run("Harmonize + rebuild download (normalize)", ["scripts/normalize_for_dashboard.py"])

    print("\nRefresh complete. Harmonized CSVs, pacific_links_data.xlsx, and "
          "data_meta.json are updated in dashboard/public/data/.")


if __name__ == "__main__":
    main()
