from __future__ import annotations

import csv
import json
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

from pacific_data.pdh_client import AGENCY_ID, BASE_URL, PDHError, retrieve_data

OUTPUT_DIR = Path("data/processed")
CSV_PATH = OUTPUT_DIR / "imports_by_supplier_year.csv"
METADATA_PATH = OUTPUT_DIR / "imports_by_supplier_year.metadata.json"
REPORTERS = ["AS", "CK", "FJ", "FM", "GU", "KI", "MH", "MP", "NR", "NU", "PF", "PG", "PW", "SB", "TK", "TO", "TV", "VU", "WF", "WS"]
SPECIAL_SUPPLIERS = {"TW_U", "_U", "OTH"}
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
        name = next((x for x in names if x.attrib.get("{http://www.w3.org/XML/1998/namespace}lang") == "en"), names[0] if names else None)
        result[code.attrib["id"]] = "".join(name.itertext()).strip() if name is not None else code.attrib["id"]
    return result


def is_supplier(code: str) -> bool:
    return (len(code) == 2 and code.isalpha()) or code in SPECIAL_SUPPLIERS


def normalized_usd(value: str, unit_mult: str) -> float:
    exponent = int(unit_mult) if str(unit_mult).strip() else 0
    return float(value) * (10 ** exponent)


def main() -> None:
    geography = codelist("CL_COM_GEO_AREA")
    filters = {
        "FREQ": "A",
        "INDICATOR": "AMT",
        "TRADE_FLOW": "M",
        "COMMODITY": "_T",
        "TRANSPORT": "_T",
        "CURRENCY": "USD",
    }
    rows = []
    reported_totals: dict[tuple[str, int], float] = {}
    source_urls = []
    unavailable = []
    for reporter in REPORTERS:
        try:
            payload = retrieve_data("DF_IMTS", country=reporter, filters=filters)
        except PDHError:
            unavailable.append(reporter)
            continue
        source_urls.append(payload["retrieval_url"])
        for source in payload["rows"]:
            if not str(source.get("OBS_VALUE", "")).strip():
                continue
            supplier = source["COUNTERPART"]
            value = normalized_usd(source["OBS_VALUE"], source.get("UNIT_MULT", ""))
            if supplier == "_T":
                reported_totals[(reporter, int(source["TIME_PERIOD"]))] = value
                continue
            if not is_supplier(supplier):
                continue
            rows.append({
                "reporter_code": reporter,
                "reporter_name": geography.get(reporter, reporter),
                "supplier_code": supplier,
                "supplier_name": geography.get(supplier, supplier),
                "year": int(source["TIME_PERIOD"]),
                "import_value_usd": int(value) if value.is_integer() else value,
                "supplier_share_pct": "",
                "reported_total_imports_usd": "",
                "supplier_coverage_pct": "",
                "coverage_quality": "",
                "is_residual": False,
                "observation_status": source.get("OBS_STATUS", ""),
            })

    keys = [(r["reporter_code"], r["supplier_code"], r["year"]) for r in rows]
    if len(keys) != len(set(keys)):
        raise RuntimeError(f"Found {len(keys) - len(set(keys))} duplicate reporter-supplier-year rows")

    available_supplier_totals = defaultdict(float)
    for row in rows:
        available_supplier_totals[(row["reporter_code"], row["year"])] += float(row["import_value_usd"])

    residual_rows = []
    for key, reported_total in reported_totals.items():
        available_total = available_supplier_totals.get(key, 0.0)
        residual = reported_total - available_total
        if residual <= 0:
            continue
        reporter, year = key
        coverage = available_total / reported_total * 100 if reported_total else 0.0
        residual_rows.append({
            "reporter_code": reporter,
            "reporter_name": geography.get(reporter, reporter),
            "supplier_code": "RESIDUAL",
            "supplier_name": "Unallocated / residual",
            "year": year,
            "import_value_usd": int(residual) if residual.is_integer() else residual,
            "supplier_share_pct": round(residual / reported_total * 100, 6) if reported_total else "",
            "reported_total_imports_usd": int(reported_total) if reported_total.is_integer() else reported_total,
            "supplier_coverage_pct": round(coverage, 6),
            "coverage_quality": "complete" if coverage >= 99.5 else "partial",
            "is_residual": True,
            "observation_status": "derived",
        })

    for row in rows:
        key = (str(row["reporter_code"]), int(row["year"]))
        reported_total = reported_totals.get(key)
        available_total = available_supplier_totals[key]
        coverage = available_total / reported_total * 100 if reported_total else None
        row["reported_total_imports_usd"] = int(reported_total) if reported_total is not None and reported_total.is_integer() else (reported_total or "")
        row["supplier_share_pct"] = round(float(row["import_value_usd"]) / reported_total * 100, 6) if reported_total else ""
        row["supplier_coverage_pct"] = round(coverage, 6) if coverage is not None else ""
        row["coverage_quality"] = (
            "complete" if coverage is not None and 99.5 <= coverage <= 100.5
            else "partial" if coverage is not None and coverage < 99.5
            else "inconsistent" if coverage is not None
            else "missing_total"
        )

    rows.extend(residual_rows)

    rows.sort(key=lambda r: (r["reporter_code"], r["year"], r["supplier_code"]))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    coverage = {}
    for reporter in sorted({row["reporter_code"] for row in rows}):
        years = sorted({row["year"] for row in rows if row["reporter_code"] == reporter})
        coverage[reporter] = {"start": years[0], "end": years[-1], "year_count": len(years)}
    all_years = [row["year"] for row in rows]
    metadata = {
        "title": "Pacific merchandise imports by supplier and year",
        "dataflow": "SPC:DF_IMTS(4.0)",
        "source": "Pacific Data Hub International Merchandise Trade Statistics",
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "row_count": len(rows),
        "reporter_count": len(coverage),
        "supplier_count": len({row["supplier_code"] for row in rows}),
        "year_min": min(all_years),
        "year_max": max(all_years),
        "coverage": coverage,
        "unavailable_reporters": unavailable,
        "filters": filters,
        "notes": [
            "Values are annual merchandise imports in current USD, normalized using PDH UNIT_MULT.",
            "Regional and total counterpart aggregates are excluded to prevent double-counting.",
            "Taiwan, Other, and Unknown are retained as explicit supplier categories.",
            "Supplier shares use PDH's published all-partner total for each reporter-year.",
            "Supplier coverage compares the sum of available detailed supplier rows with that published total.",
            "When detailed suppliers sum below the reported total, a derived Unallocated / residual row closes the gap.",
            "No negative residual is created where detailed suppliers exceed the reported total.",
            "Complete means 99.5-100.5% reconciliation; partial is below 99.5%; inconsistent is above 100.5%.",
            "Missing rows are not zero and must not be imputed as zero.",
        ],
        "source_urls": source_urls,
    }
    METADATA_PATH.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in metadata.items() if k != "source_urls"}, indent=2))


if __name__ == "__main__":
    main()
