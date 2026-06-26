import csv

pac = {'FJ','PG','SB','VU','WS','TO','TV','CK','NU','KI','FM','MH','PW','NR','AS','PF','TK','GU','MP','WF'}

print("=== TRADE ===")
rows = list(csv.DictReader(open('data/processed/imports_by_supplier_year.csv')))
intra = [r for r in rows if r['reporter_code'] in pac and r['supplier_code'] in pac]
print(f"Intra-Pacific trade rows: {len(intra)}")
for r in sorted(intra, key=lambda x: -float(x['value_usd']))[:10]:
    print(f"  {r['reporter_name']} <- {r['supplier_name']}: ${float(r['value_usd'])/1e6:.1f}M ({r['year']})")

print("\n=== MIGRATION ===")
rows = list(csv.DictReader(open('data/processed/migrants_abroad_by_destination_year.csv')))
intra = [r for r in rows if r['origin_code'] in pac and r['destination_iso2'] in pac]
print(f"Intra-Pacific migration rows: {len(intra)}")
for r in sorted(intra, key=lambda x: -float(x['value']))[:10]:
    print(f"  {r['origin_name']} -> {r['destination_name']}: {int(float(r['value']))} people ({r['year']})")

print("\n=== REMITTANCES ===")
rows = list(csv.DictReader(open('data/processed/remittances_by_source_year.csv')))
intra = [r for r in rows if r['recipient_code'] in pac and r['source_iso2'] in pac]
print(f"Intra-Pacific remittance rows: {len(intra)}")
