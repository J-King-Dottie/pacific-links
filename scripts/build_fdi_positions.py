from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

RAW_PATH = Path("data/raw/imf_dip.csv")
OUTPUT_DIR = Path("data/processed")
CSV_PATH = OUTPUT_DIR / "fdi_positions_by_investor_year.csv"
METADATA_PATH = OUTPUT_DIR / "fdi_positions_by_investor_year.metadata.json"

PACIFIC = {
    "ASM": ("AS", "American Samoa"),
    "COK": ("CK", "Cook Islands"),
    "FJI": ("FJ", "Fiji"),
    "PYF": ("PF", "French Polynesia"),
    "FSM": ("FM", "Micronesia, Federated States of"),
    "GUM": ("GU", "Guam"),
    "KIR": ("KI", "Kiribati"),
    "MHL": ("MH", "Marshall Islands"),
    "NRU": ("NR", "Nauru"),
    "NCL": ("NC", "New Caledonia"),
    "NIU": ("NU", "Niue"),
    "MNP": ("MP", "Northern Mariana Islands"),
    "PNG": ("PG", "Papua New Guinea"),
    "PLW": ("PW", "Palau"),
    "SLB": ("SB", "Solomon Islands"),
    "TKL": ("TK", "Tokelau"),
    "TON": ("TO", "Tonga"),
    "TUV": ("TV", "Tuvalu"),
    "VUT": ("VU", "Vanuatu"),
    "WLF": ("WF", "Wallis and Futuna"),
    "WSM": ("WS", "Samoa"),
}

TARGET = {
    "OBS_MEASURE": "OBS_VALUE",
    "FREQUENCY": "Annual",
    "DI_DIRECTION": "Inward",
    "FUNCTIONAL_CAT": "Direct investment",
    "INSTR_ASSET": "All financial instruments",
    "DI_ENTITY": "All entities",
    "ACCOUNTING_ENTRY": "Net (liabilities less assets)",
    "UNIT": "US dollar",
}


def numeric(value: str) -> float | None:
    cleaned = value.strip().replace(",", "")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def main() -> None:
    chosen: dict[tuple[str, str, int], dict[str, object]] = {}
    with RAW_PATH.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        years = [field for field in reader.fieldnames or [] if field.isdigit()]
        for source in reader:
            series_parts = source["SERIES_CODE"].split(".")
            recipient_iso3 = series_parts[0]
            if recipient_iso3 not in PACIFIC or any(source.get(k) != v for k, v in TARGET.items()):
                continue
            if str(source.get("GROUP_FLAG", "")).strip().lower() == "true":
                continue
            investor_code = series_parts[-2] if len(series_parts) >= 2 else ""
            investor_name = source["COUNTERPART_COUNTRY"].strip()
            if len(investor_code) != 3 or not investor_code.isalpha() or not investor_name:
                continue
            scale = source.get("SCALE", "").strip()
            multiplier = 1_000_000 if scale == "Millions" else 1
            is_official = source["DV_TYPE"] == "Reported official data"
            recipient_code, recipient_name = PACIFIC[recipient_iso3]
            for year_field in years:
                value = numeric(source.get(year_field, ""))
                if value is None:
                    continue
                key = (recipient_code, investor_code, int(year_field))
                candidate = {
                    "recipient_code": recipient_code,
                    "recipient_name": recipient_name,
                    "investor_code": investor_code,
                    "investor_name": investor_name,
                    "year": int(year_field),
                    "fdi_position_usd": round(value * multiplier, 2),
                    "data_type": source["DV_TYPE"],
                    "is_official": is_official,
                }
                existing = chosen.get(key)
                if existing is None or (is_official and not existing["is_official"]):
                    chosen[key] = candidate

    rows = sorted(chosen.values(), key=lambda row: (row["recipient_code"], row["year"], row["investor_code"]))
    if not rows:
        raise RuntimeError("No matching Pacific inward FDI observations found")
    for row in rows:
        row.pop("is_official")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    coverage = {}
    for code in sorted({str(row["recipient_code"]) for row in rows}):
        subset = [row for row in rows if row["recipient_code"] == code]
        years = sorted({int(row["year"]) for row in subset})
        coverage[code] = {
            "start": years[0],
            "end": years[-1],
            "year_count": len(years),
            "investor_count": len({str(row["investor_code"]) for row in subset}),
            "official_rows": sum(row["data_type"] == "Reported official data" for row in subset),
            "mirror_rows": sum(row["data_type"] == "Derived using counterparty information" for row in subset),
        }
    metadata = {
        "title": "Pacific inward direct investment positions by immediate investor economy and year",
        "dataset": "IMF.STA:DIP(12.0.1)",
        "source": "IMF Direct Investment Positions by Counterpart Economy",
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "row_count": len(rows),
        "recipient_count": len(coverage),
        "investor_count": len({str(row["investor_code"]) for row in rows}),
        "year_min": min(int(row["year"]) for row in rows),
        "year_max": max(int(row["year"]) for row in rows),
        "coverage": coverage,
        "filters": TARGET,
        "notes": [
            "Positions are year-end stocks, not annual FDI flows.",
            "Values are normalized from USD millions to USD.",
            "Reported official data take priority; counterparty-derived mirror data fill missing recipient observations.",
            "Regional and other aggregate counterpart groups are excluded.",
            "Negative positions are valid under the net liabilities-less-assets definition.",
            "Missing observations are not zero.",
        ],
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
