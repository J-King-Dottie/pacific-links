"""Merge saved IDS debt country part files into the main debt CSV."""

import csv
from pathlib import Path

ROOT = Path(__file__).parent.parent
MAIN = ROOT / "data" / "processed" / "debt_by_creditor_year.csv"
PARTS = ROOT / "data" / "processed" / "ids_debt_parts"

FIELDNAMES = [
    "recipient_code", "recipient_name", "creditor_code", "creditor_name",
    "ids_debtor_code", "ids_creditor_code", "year", "value_usd", "pct_gdp",
]


def read_rows(path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    rows = read_rows(MAIN)
    if PARTS.exists():
        for part in sorted(PARTS.glob("*.csv")):
            part_rows = read_rows(part)
            if not part_rows:
                continue
            debtor = part.stem
            rows = [r for r in rows if r["ids_debtor_code"] != debtor] + part_rows

    rows.sort(key=lambda r: (r["recipient_code"], r["creditor_name"], int(r["year"])))
    MAIN.parent.mkdir(parents=True, exist_ok=True)
    with open(MAIN, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} rows -> {MAIN}")


if __name__ == "__main__":
    main()
