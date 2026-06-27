"""
Build Pacific portfolio investment positions from IMF PIP.

This extracts foreign holdings of portfolio investment securities issued by the
14 Pacific countries. In plain terms: which economies' investors hold Pacific
shares and bonds. The inverse direction is not built because the IMF PIP data
has almost no useful Pacific reporter coverage for outbound holdings.
"""

import csv
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "processed"

PIP_DATA_URL = "https://api.imf.org/external/sdmx/2.1/data/IMF.STA,PIP"
PIP_SOURCE_URL = "https://data.imf.org/en/datasets/IMF.STA:PIP"

PACIFIC = {
    "COK": ("CK", "Cook Islands"),
    "FJI": ("FJ", "Fiji"),
    "KIR": ("KI", "Kiribati"),
    "MHL": ("MH", "Marshall Islands"),
    "FSM": ("FM", "Micronesia (FSM)"),
    "NRU": ("NR", "Nauru"),
    "NIU": ("NU", "Niue"),
    "PLW": ("PW", "Palau"),
    "PNG": ("PG", "Papua New Guinea"),
    "WSM": ("WS", "Samoa"),
    "SLB": ("SB", "Solomon Islands"),
    "TON": ("TO", "Tonga"),
    "TUV": ("TV", "Tuvalu"),
    "VUT": ("VU", "Vanuatu"),
}

FIELDNAMES = [
    "pacific_code",
    "pacific_name",
    "holder_code",
    "holder_name",
    "holder_raw_code",
    "year",
    "value_usd",
    "obs_status",
]


def fetch_pacific_counterpart(counterpart_iso3):
    # Dimensions:
    # COUNTRY.ACCOUNTING_ENTRY.INDICATOR.SECTOR.COUNTERPART_SECTOR.COUNTERPART_COUNTRY.FREQUENCY
    # Empty COUNTRY returns all reporting economies. ACCOUNTING_ENTRY=A means
    # reporting-economy portfolio assets held in the Pacific counterpart.
    key = f".A.P_TOTINV_P_USD.S1.S1.{counterpart_iso3}.A"
    params = urllib.parse.urlencode({
        "startPeriod": "2010",
        "endPeriod": "2024",
    })
    url = f"{PIP_DATA_URL}/{key}?{params}"
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "pacific-links/0.1", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(response.read().decode("utf-8")), url


def parse_value(value):
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    retrieval_urls = {}

    for iso3, (pac_code, pac_name) in PACIFIC.items():
        data, url = fetch_pacific_counterpart(iso3)
        retrieval_urls[iso3] = url
        if not data.get("dataSets"):
            continue

        series_dimensions = data["structure"]["dimensions"]["series"]
        time_values = data["structure"]["dimensions"]["observation"][0]["values"]
        observation_attributes = data["structure"].get("attributes", {}).get("observation", [])

        for key, series in data["dataSets"][0].get("series", {}).items():
            indexes = [int(part) for part in key.split(":")]
            holder_value = series_dimensions[0]["values"][indexes[0]]
            holder = holder_value["id"]
            holder_name = holder_value.get("name", holder)

            for obs_index, obs in series.get("observations", {}).items():
                value = parse_value(obs[0] if obs else None)
                if value is None or value <= 0:
                    continue
                obs_status = ""
                # SDMX-JSON observation values are [value, attr0, attr1, ...].
                # STATUS is the third observation attribute in this dataset.
                for attr_offset, attr_value in enumerate(obs[1:], start=0):
                    if attr_value is None or attr_offset >= len(observation_attributes):
                        continue
                    attr = observation_attributes[attr_offset]
                    if attr.get("id") != "STATUS":
                        continue
                    values = attr.get("values", [])
                    if isinstance(attr_value, int) and attr_value < len(values):
                        obs_status = values[attr_value].get("id", "")
                year = int(time_values[int(obs_index)]["id"])
                rows.append({
                    "pacific_code": pac_code,
                    "pacific_name": pac_name,
                    "holder_code": holder,
                    "holder_name": holder_name,
                    "holder_raw_code": holder,
                    "year": year,
                    # IMF PIP's OBS_VALUE is already returned as a USD value.
                    # Do not multiply by SCALE=6; doing so would overstate values.
                    "value_usd": round(value, 2),
                    "obs_status": obs_status,
                })

    rows.sort(key=lambda r: (r["pacific_code"], r["holder_code"], r["year"]))
    out_path = DATA_DIR / "portfolio_positions_by_holder_year.csv"
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    coverage = {}
    for code in sorted({r["pacific_code"] for r in rows}):
        subset = [r for r in rows if r["pacific_code"] == code]
        years = sorted({r["year"] for r in subset})
        coverage[code] = {
            "start": years[0],
            "end": years[-1],
            "year_count": len(years),
            "holder_count": len({r["holder_code"] for r in subset}),
        }

    metadata = {
        "source": "IMF Portfolio Investment Positions by Counterpart Economy",
        "source_url": PIP_SOURCE_URL,
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "row_count": len(rows),
        "recipient_count": len(coverage),
        "holder_count": len({r["holder_code"] for r in rows}),
        "year_min": min((r["year"] for r in rows), default=None),
        "year_max": max((r["year"] for r in rows), default=None),
        "coverage": coverage,
        "retrieval_urls": retrieval_urls,
        "filters": {
            "ACCOUNTING_ENTRY": "Assets",
            "INDICATOR": "Portfolio investment, Total investment, Positions",
            "SECTOR": "Total economy",
            "COUNTERPART_SECTOR": "Total economy",
            "FREQUENCY": "Annual",
        },
        "notes": [
            "Rows show reporting economies' portfolio investment assets where the security issuer is a Pacific country.",
            "This is inbound portfolio investment into Pacific-issued shares and bonds, not Pacific residents' outbound investment.",
            "Values are positions/stocks, not annual flows.",
            "Missing observations are not zero.",
        ],
    }
    (DATA_DIR / "portfolio_positions_by_holder_year.metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(rows)} rows to {out_path}")
    print(f"Recipients: {metadata['recipient_count']}; holders: {metadata['holder_count']}; years: {metadata['year_min']}-{metadata['year_max']}")


if __name__ == "__main__":
    main()
