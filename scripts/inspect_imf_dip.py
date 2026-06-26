import csv
import collections
import time

TARGETS = {
    "Cook Islands", "Fiji", "Micronesia, Federated States of", "Kiribati",
    "Marshall Islands", "Nauru", "Niue", "Papua New Guinea", "Palau",
    "Solomon Islands", "Tonga", "Tuvalu", "Vanuatu", "Samoa",
}

started = time.time()
total = 0
summary = collections.defaultdict(lambda: {
    "rows": 0, "inward": 0, "counterparts": set(), "years": set(),
    "data_types": set(), "indicators": collections.Counter(),
})
with open("data/raw/imf_dip.csv", encoding="utf-8-sig", newline="") as handle:
    reader = csv.DictReader(handle)
    year_fields = [field for field in reader.fieldnames or [] if field.isdigit()]
    for row in reader:
        total += 1
        country = row["COUNTRY"]
        if country not in TARGETS:
            continue
        item = summary[country]
        item["rows"] += 1
        if row["DI_DIRECTION"] != "Inward":
            continue
        item["inward"] += 1
        item["counterparts"].add(row["COUNTERPART_COUNTRY"])
        item["data_types"].add(row["DV_TYPE"])
        item["indicators"][row["INDICATOR"]] += 1
        for year in year_fields:
            if row.get(year, "").strip():
                item["years"].add(int(year))

print(f"Scanned {total:,} rows in {time.time() - started:.1f}s")
for country in sorted(TARGETS):
    item = summary[country]
    year_range = (
        f"{min(item['years'])}-{max(item['years'])} ({len(item['years'])} years)"
        if item["years"] else "none"
    )
    print(f"{country}: rows={item['rows']}, inward={item['inward']}, counterparts={len(item['counterparts'])}, years={year_range}")
    print(f"  data_types={sorted(item['data_types'])}")
    print(f"  indicators={item['indicators'].most_common(5)}")
