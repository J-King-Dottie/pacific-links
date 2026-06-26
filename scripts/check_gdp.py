import csv
rows = list(csv.DictReader(open('data/raw/worldbank_gdp_pop.csv')))
by_country = {}
for r in rows:
    by_country.setdefault(r['iso2'], []).append(r)
for iso2, rr in sorted(by_country.items()):
    latest = max(rr, key=lambda r: r['year'])
    print(f"{iso2}: {latest['country_name']} — GDP={latest.get('gdp_usd','?')} pop={latest.get('population','?')}")
