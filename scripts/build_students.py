"""
Build bilateral Pacific tertiary student mobility data from UNESCO UIS OPRI.

The UIS OPRI bulk archive encodes "inbound internationally mobile tertiary
students from [origin]" as one indicator per origin country. Each national data
row is a host/destination country. We extract the 14 Pacific origins used by
Pacific Links and write a compact country-to-country CSV.
"""

import csv
import io
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "processed"

UIS_OPRI_URL = "https://download.uis.unesco.org/bdds/202602/OPRI.zip"

PACIFIC_ORIGIN_INDICATORS = {
    "26618": {"code": "CK", "iso3": "COK", "name": "Cook Islands"},
    "26619": {"code": "FJ", "iso3": "FJI", "name": "Fiji"},
    "26620": {"code": "KI", "iso3": "KIR", "name": "Kiribati"},
    "26622": {"code": "NU", "iso3": "NIU", "name": "Niue"},
    "26623": {"code": "PW", "iso3": "PLW", "name": "Palau"},
    "26624": {"code": "PG", "iso3": "PNG", "name": "Papua New Guinea"},
    "26625": {"code": "WS", "iso3": "WSM", "name": "Samoa"},
    "26626": {"code": "SB", "iso3": "SLB", "name": "Solomon Islands"},
    "26627": {"code": "TO", "iso3": "TON", "name": "Tonga"},
    "26628": {"code": "TV", "iso3": "TUV", "name": "Tuvalu"},
    "26629": {"code": "VU", "iso3": "VUT", "name": "Vanuatu"},
    "26644": {"code": "MH", "iso3": "MHL", "name": "Marshall Islands"},
    "26645": {"code": "FM", "iso3": "FSM", "name": "Micronesia (FSM)"},
    "26646": {"code": "NR", "iso3": "NRU", "name": "Nauru"},
}


def read_csv_from_zip(zf, name):
    return csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="utf-8-sig"))


def download_zip(url):
    with urllib.request.urlopen(url, timeout=180) as response:
        return response.read()


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading UNESCO UIS OPRI archive: {UIS_OPRI_URL}")
    blob = download_zip(UIS_OPRI_URL)
    zf = zipfile.ZipFile(io.BytesIO(blob))

    country_name = {
        row["COUNTRY_ID"]: row["COUNTRY_NAME_EN"]
        for row in read_csv_from_zip(zf, "OPRI_COUNTRY.csv")
    }

    rows = []
    skipped_self = 0
    for row in read_csv_from_zip(zf, "OPRI_DATA_NATIONAL.csv"):
        origin = PACIFIC_ORIGIN_INDICATORS.get(row["INDICATOR_ID"])
        if not origin:
            continue
        host_iso3 = row["COUNTRY_ID"]
        if host_iso3 == origin["iso3"]:
            skipped_self += 1
            continue
        try:
            value = float(row["VALUE"])
        except (TypeError, ValueError):
            continue
        if value <= 0:
            continue

        rows.append({
            "pacific_code": origin["code"],
            "pacific_name": origin["name"],
            "host_code": host_iso3,
            "host_name": country_name.get(host_iso3, host_iso3),
            "year": int(row["YEAR"]),
            "value_people": round(value, 2),
            "qualifier": row.get("QUALIFIER", ""),
        })

    rows.sort(key=lambda r: (r["pacific_code"], r["host_code"], r["year"]))

    out_path = DATA_DIR / "students_by_destination_year.csv"
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["pacific_code", "pacific_name", "host_code", "host_name", "year", "value_people", "qualifier"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)

    metadata = {
        "source": "UNESCO UIS Other Policy Relevant Indicators (OPRI)",
        "source_url": UIS_OPRI_URL,
        "release": "February 2026",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "origin_count": len({r["pacific_code"] for r in rows}),
        "host_count": len({r["host_code"] for r in rows}),
        "year_min": min(r["year"] for r in rows) if rows else None,
        "year_max": max(r["year"] for r in rows) if rows else None,
        "skipped_self_rows": skipped_self,
        "note": "Extracts inbound internationally mobile tertiary students by Pacific origin and host country. Self-country rows are removed.",
    }
    (DATA_DIR / "students_by_destination_year.metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(rows)} rows to {out_path}")
    print(f"Origins: {metadata['origin_count']}; hosts: {metadata['host_count']}; years: {metadata['year_min']}-{metadata['year_max']}")
    print(f"Skipped self-country rows: {skipped_self}")


if __name__ == "__main__":
    main()
