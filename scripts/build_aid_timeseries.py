from __future__ import annotations

import csv
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import requests

from pacific_data.pdh_client import AGENCY_ID, BASE_URL, retrieve_data

OUTPUT_DIR = Path("data/processed")
CSV_PATH = OUTPUT_DIR / "aid_by_donor_year.csv"
METADATA_PATH = OUTPUT_DIR / "aid_by_donor_year.metadata.json"
AGGREGATE_DONORS = {"_T", "DONOR_BIL", "DONOR_MUL", "DONOR_CSP", "DONOR_PCS"}
NS = {
    "structure": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure",
    "common": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common",
}


def codelist(codelist_id: str) -> dict[str, str]:
    url = f"{BASE_URL}/codelist/{AGENCY_ID}/{codelist_id}/latest?detail=full"
    response = requests.get(url, headers={"User-Agent": "pacific-exposure-map/0.1"}, timeout=60)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    result = {}
    for code in root.findall(".//structure:Code", NS):
        names = code.findall("common:Name", NS)
        english = next(
            (name for name in names if name.attrib.get("{http://www.w3.org/XML/1998/namespace}lang") == "en"),
            names[0] if names else None,
        )
        result[code.attrib["id"]] = "".join(english.itertext()).strip() if english is not None else code.attrib["id"]
    return result


def main() -> None:
    payload = retrieve_data("DF_PAM")
    donor_names = codelist("CL_COM_DONOR")
    recipient_names = codelist("CL_COM_GEO_PICT")
    retrieved_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    selected = [
        row for row in payload["rows"]
        if row["FREQ"] == "A"
        and row["INDICATOR"] == "TRVAL"
        and row["COMMITTED_SPENT"] in {"SPE", "COM"}
        and row["FLOW_TYPE"] == "_T"
        and row["GEO_PICT"] != "_T"
        and row["DONOR"] not in AGGREGATE_DONORS
    ]
    selected.sort(key=lambda row: (row["GEO_PICT"], int(row["TIME_PERIOD"]), row["DONOR"]))

    pivoted: dict[tuple[str, str, int], dict[str, str | int]] = {}
    for row in selected:
        key = (row["GEO_PICT"], row["DONOR"], int(row["TIME_PERIOD"]))
        output = pivoted.setdefault(key, {
            "recipient_code": row["GEO_PICT"],
            "recipient_name": recipient_names.get(row["GEO_PICT"], row["GEO_PICT"]),
            "donor_code": row["DONOR"],
            "donor_name": donor_names.get(row["DONOR"], row["DONOR"]),
            "year": int(row["TIME_PERIOD"]),
            "aid_spent_usd": "",
            "aid_committed_usd": "",
            "spent_observation_status": "",
            "committed_observation_status": "",
        })
        if row["COMMITTED_SPENT"] == "SPE":
            output["aid_spent_usd"] = row["OBS_VALUE"]
            output["spent_observation_status"] = row.get("OBS_STATUS", "")
        else:
            output["aid_committed_usd"] = row["OBS_VALUE"]
            output["committed_observation_status"] = row.get("OBS_STATUS", "")

    output_rows = sorted(pivoted.values(), key=lambda row: (row["recipient_code"], row["year"], row["donor_code"]))

    annual_totals: dict[tuple[str, int], dict[str, float]] = {}
    for row in output_rows:
        key = (str(row["recipient_code"]), int(row["year"]))
        totals = annual_totals.setdefault(key, {"spent": 0.0, "committed": 0.0})
        if row["aid_spent_usd"] != "":
            totals["spent"] += float(row["aid_spent_usd"])
        if row["aid_committed_usd"] != "":
            totals["committed"] += float(row["aid_committed_usd"])

    for row in output_rows:
        totals = annual_totals[(str(row["recipient_code"]), int(row["year"]))]
        spent = row["aid_spent_usd"]
        committed = row["aid_committed_usd"]
        row["spent_share_pct"] = (
            round(float(spent) / totals["spent"] * 100, 6)
            if spent != "" and totals["spent"] else ""
        )
        row["committed_share_pct"] = (
            round(float(committed) / totals["committed"] * 100, 6)
            if committed != "" and totals["committed"] else ""
        )

    keys = [(row["recipient_code"], row["donor_code"], row["year"]) for row in output_rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError("Duplicate recipient-donor-year keys found")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)

    years = [row["year"] for row in output_rows]
    metadata = {
        "title": "Pacific aid spent and committed by recipient, donor, and year",
        "dataflow": "SPC:DF_PAM(1.0)",
        "source_dataset": "Pacific aid and development finance data from the Lowy Institute",
        "source_url": payload["retrieval_url"],
        "retrieved_at": retrieved_at,
        "row_count": len(output_rows),
        "rows_with_spent": sum(bool(row["aid_spent_usd"]) for row in output_rows),
        "rows_with_committed": sum(bool(row["aid_committed_usd"]) for row in output_rows),
        "recipient_count": len({row["recipient_code"] for row in output_rows}),
        "donor_count": len({row["donor_code"] for row in output_rows}),
        "year_min": min(years),
        "year_max": max(years),
        "filters": {
            "FREQ": "A (annual)",
            "INDICATOR": "TRVAL (value of transactions)",
            "COMMITTED_SPENT": "SPE (spent) and COM (committed), stored separately",
            "FLOW_TYPE": "_T (all flow types)",
        },
        "excluded_donor_aggregates": sorted(AGGREGATE_DONORS),
        "notes": [
            "Values are reported in USD by the source dataset.",
            "Spent and committed values are separate measures and must never be added together.",
            "Share columns are each donor's percentage of named donor-source totals for that recipient and calendar year.",
            "Multilateral institutions and other named non-country funders are retained as donor sources.",
            "The latest year may be partial and coverage differs by recipient and donor.",
            "Missing rows are not zero and must not be imputed as zero.",
        ],
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
