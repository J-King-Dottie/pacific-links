"""
Build Pacific security assistance from OECD CRS.

This extracts the CRS 152xx "Conflict, peace and security" purpose-code
family for the 14 Pacific countries, using disbursements in current USD.
Rows are kept at donor-recipient-sector-year level so the dashboard can show
donor totals with expandable purpose-code details.
"""

import csv
import io
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data" / "processed"

CRS_DATA_URL = "https://sdmx.oecd.org/dcd-public/rest/data/OECD.DCD.FSD,DSD_CRS@DF_CRS,1.6"
CRS_FLOW_URL = "https://sdmx.oecd.org/dcd-public/rest/dataflow/OECD.DCD.FSD/DSD_CRS@DF_CRS/1.6"

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

SECTOR_LABELS = {
    "15210": "Security system management and reform",
    "15220": "Civilian peace-building, conflict prevention and resolution",
    "15230": "Participation in international peacekeeping operations",
    "15240": "Reintegration and SALW control",
    "15250": "Removal of land mines and explosive remnants of war",
    "15261": "Child soldiers prevention and demobilisation",
}

DONOR_ISO2 = {
    "AUS": "AU",
    "AUT": "AT",
    "BEL": "BE",
    "CAN": "CA",
    "CZE": "CZ",
    "DEU": "DE",
    "FRA": "FR",
    "GBR": "GB",
    "IRL": "IE",
    "JPN": "JP",
    "KOR": "KR",
    "NZL": "NZ",
    "USA": "US",
}

DONOR_NAMES = {
    "1UN0": "United Nations",
    "1UN011": "UNDP",
    "1UN014": "UNICEF",
    "1UN019": "UN Peacebuilding Fund",
    "4EU001": "European Union institutions",
    "AUS": "Australia",
    "AUT": "Austria",
    "BEL": "Belgium",
    "CAN": "Canada",
    "CZE": "Czechia",
    "DEU": "Germany",
    "FRA": "France",
    "GBR": "United Kingdom",
    "IRL": "Ireland",
    "JPN": "Japan",
    "KOR": "South Korea",
    "NZL": "New Zealand",
    "USA": "United States",
}

AGGREGATE_DONORS = {
    "DAC", "DAC_EC", "DACEU", "DACEU_EC", "ALLD", "ALLM", "G7", "EU00",
    "9OTH0", "9OTH011",
}


def fetch_csv():
    recipients = "+".join(PACIFIC)
    sectors = "+".join(SECTOR_LABELS)
    # Dimensions:
    # DONOR.RECIPIENT.SECTOR.MEASURE.CHANNEL.MODALITY.FLOW_TYPE.PRICE_BASE.MD_DIM.MD_ID
    # MEASURE=100, FLOW_TYPE=D, PRICE_BASE=Q, UNIT=USD. Empty DONOR returns all providers.
    key = f".{recipients}.{sectors}.100._T._T.D.Q._T.."
    params = urllib.parse.urlencode({
        "startPeriod": "2010",
        "endPeriod": "2024",
        "dimensionAtObservation": "AllDimensions",
    })
    url = f"{CRS_DATA_URL}/{key}?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": "pacific-links/0.1", "Accept": "text/csv"})
    with urllib.request.urlopen(request, timeout=180) as response:
        return response.read().decode("utf-8-sig"), url


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    text, url = fetch_csv()

    rows = []
    for r in csv.DictReader(io.StringIO(text)):
        donor = (r.get("DONOR") or "").strip()
        recipient = (r.get("RECIPIENT") or "").strip()
        sector = (r.get("SECTOR") or "").strip()
        if donor in AGGREGATE_DONORS or donor.startswith("9OTH"):
            continue
        if recipient not in PACIFIC or sector not in SECTOR_LABELS:
            continue
        try:
            value_millions = float(r.get("OBS_VALUE") or 0)
        except ValueError:
            continue
        if value_millions <= 0:
            continue

        pac_code, pac_name = PACIFIC[recipient]
        rows.append({
            "pacific_code": pac_code,
            "pacific_name": pac_name,
            "donor_code": DONOR_ISO2.get(donor, f"CRS_{donor}"),
            "donor_name": DONOR_NAMES.get(donor, donor),
            "donor_raw_code": donor,
            "year": int(r["TIME_PERIOD"]),
            "sector_code": sector,
            "sector_name": SECTOR_LABELS[sector],
            "value_usd": round(value_millions * 1_000_000, 2),
            "obs_status": r.get("OBS_STATUS", ""),
            "base_period": r.get("BASE_PER", ""),
        })

    rows.sort(key=lambda r: (r["pacific_code"], r["donor_code"], r["year"], r["sector_code"]))

    out_path = DATA_DIR / "security_assistance_by_provider_year.csv"
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "pacific_code", "pacific_name", "donor_code", "donor_name", "donor_raw_code",
            "year", "sector_code", "sector_name", "value_usd", "obs_status", "base_period",
        ], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    metadata = {
        "source": "OECD CRS: Creditor Reporting System (flows)",
        "source_url": CRS_FLOW_URL,
        "retrieval_url": url,
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "row_count": len(rows),
        "recipient_count": len({r["pacific_code"] for r in rows}),
        "provider_count": len({r["donor_code"] for r in rows}),
        "year_min": min((r["year"] for r in rows), default=None),
        "year_max": max((r["year"] for r in rows), default=None),
        "sectors": SECTOR_LABELS,
        "excluded_aggregate_donors": sorted(AGGREGATE_DONORS),
        "note": "CRS 152xx conflict, peace and security purpose-code family. Values are disbursements in current USD.",
    }
    (DATA_DIR / "security_assistance_by_provider_year.metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Wrote {len(rows)} rows to {out_path}")
    print(f"Recipients: {metadata['recipient_count']}; providers: {metadata['provider_count']}; years: {metadata['year_min']}-{metadata['year_max']}")


if __name__ == "__main__":
    main()
