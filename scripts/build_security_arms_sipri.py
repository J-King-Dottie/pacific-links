"""
Build Pacific major arms transfer data from SIPRI.

The SIPRI Arms Transfers Database records transfers of major conventional
weapons. This script queries delivered transfers to the 14 Pacific countries
for 2010-2024 and keeps equipment-level rows for dashboard expansion.
"""

import base64
import csv
import io
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "processed"

SIPRI_BASE = "https://atbackend.sipri.org/api/p"
SIPRI_SOURCE_URL = "https://armstransfers.sipri.org/ArmsTransfer/TransferRegister"

PACIFIC = {
    "CK": {"sipri_id": 1150535, "name": "Cook Islands"},
    "FJ": {"sipri_id": 1150600, "name": "Fiji"},
    "KI": {"sipri_id": 1150567, "name": "Kiribati"},
    "MH": {"sipri_id": 1150602, "name": "Marshall Islands"},
    "FM": {"sipri_id": 1150624, "name": "Micronesia (FSM)"},
    "NR": {"sipri_id": 1150697, "name": "Nauru"},
    "NU": {"sipri_id": 1150694, "name": "Niue"},
    "PW": {"sipri_id": 1150685, "name": "Palau"},
    "PG": {"sipri_id": 1150640, "name": "Papua New Guinea"},
    "WS": {"sipri_id": 1150695, "name": "Samoa"},
    "SB": {"sipri_id": 1150682, "name": "Solomon Islands"},
    "TO": {"sipri_id": 1150665, "name": "Tonga"},
    "TV": {"sipri_id": 1150723, "name": "Tuvalu"},
    "VU": {"sipri_id": 1150707, "name": "Vanuatu"},
}

SUPPLIER_ISO2 = {
    "Australia": "AU",
    "China": "CN",
    "New Zealand": "NZ",
    "United States": "US",
    "France": "FR",
}


def post_json(endpoint, payload):
    request = urllib.request.Request(
        f"{SIPRI_BASE}{endpoint}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"User-Agent": "pacific-links/0.1", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def fetch_transfer_register(sipri_id):
    payload = {
        "filters": [
            {"field": "Delivery year", "oldField": "", "condition": "contains", "value1": 2010, "value2": 2024, "listData": []},
            {"field": "Recipient", "oldField": "", "condition": "contains", "value1": "", "value2": "", "listData": [sipri_id]},
            {"field": "opendeals", "oldField": "", "condition": "", "value1": "", "value2": "", "listData": []},
        ],
        "logic": "AND",
    }
    data = post_json("/trades/trade-register-csv/", payload)
    csv_blob = base64.b64decode(data.get("bytes", "")).decode("utf-8-sig", errors="replace")
    lines = csv_blob.splitlines()
    header_index = next((i for i, line in enumerate(lines) if line.startswith("Recipient,Supplier,")), None)
    if header_index is None:
        return []
    return list(csv.DictReader(lines[header_index:]))


def clean_float(value):
    text = (value or "").replace("?", "").strip()
    if not text:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def delivery_years(value):
    years = [int(y) for y in re.findall(r"\b(20[1-2][0-9])\b", value or "")]
    return sorted(y for y in set(years) if 2010 <= y <= 2024)


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows = []

    for pac_code, pac in PACIFIC.items():
        for r in fetch_transfer_register(pac["sipri_id"]):
            if not r.get("Recipient"):
                continue
            years = delivery_years(r.get("Year(s) of delivery", ""))
            if not years:
                continue
            supplier = r.get("Supplier", "").strip()
            tiv_total = clean_float(r.get("SIPRI TIV of delivered weapons"))
            deliveries_total = clean_float(r.get("Deliveries in the Year Range"))
            tiv_per_year = (tiv_total / len(years)) if tiv_total is not None and years else None
            deliveries_per_year = (deliveries_total / len(years)) if deliveries_total is not None and years else None

            for year in years:
                rows.append({
                    "pacific_code": pac_code,
                    "pacific_name": pac["name"],
                    "supplier_code": SUPPLIER_ISO2.get(supplier, f"SIPRI_{supplier.upper().replace(' ', '_')}"),
                    "supplier_name": supplier,
                    "year": year,
                    "order_year": r.get("Year of order", "").strip(),
                    "number_ordered": r.get("Number ordered", "").strip(),
                    "weapon_designation": r.get("Weapon designation", "").strip(),
                    "weapon_description": r.get("Weapon description", "").strip(),
                    "deliveries": round(deliveries_per_year, 4) if deliveries_per_year is not None else "",
                    "delivery_years": r.get("Year(s) of delivery", "").strip(),
                    "status": r.get("status", "").strip(),
                    "comments": r.get("Comments", "").strip(),
                    "tiv_per_unit": r.get("SIPRI TIV per unit", "").strip(),
                    "tiv_total_order": r.get("SIPRI TIV for total order", "").strip(),
                    "value_tiv": round(tiv_per_year, 4) if tiv_per_year is not None else "",
                })

    rows.sort(key=lambda r: (r["pacific_code"], r["supplier_code"], r["year"], r["weapon_designation"]))

    out_path = DATA_DIR / "security_arms_by_supplier_year.csv"
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "pacific_code", "pacific_name", "supplier_code", "supplier_name", "year",
            "order_year", "number_ordered", "weapon_designation", "weapon_description",
            "deliveries", "delivery_years", "status", "comments", "tiv_per_unit",
            "tiv_total_order", "value_tiv",
        ], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    metadata = {
        "source": "SIPRI Arms Transfers Database",
        "source_url": SIPRI_SOURCE_URL,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "recipient_count": len({r["pacific_code"] for r in rows}),
        "supplier_count": len({r["supplier_code"] for r in rows}),
        "year_min": min((r["year"] for r in rows), default=None),
        "year_max": max((r["year"] for r in rows), default=None),
        "note": "Delivered major conventional arms transfers. Values are SIPRI trend-indicator values, labelled in the dashboard as arms transfer volume, not USD. Multi-year delivery rows are split evenly across listed delivery years for annual display.",
    }
    (DATA_DIR / "security_arms_by_supplier_year.metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(rows)} rows to {out_path}")
    print(f"Recipients: {metadata['recipient_count']}; suppliers: {metadata['supplier_count']}; years: {metadata['year_min']}-{metadata['year_max']}")


if __name__ == "__main__":
    main()
