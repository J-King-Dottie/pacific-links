import csv

def read(path):
    return list(csv.DictReader(open(path, encoding='utf-8')))

aid   = read('data/processed/aid_by_donor_year.csv')
trade = read('data/processed/imports_by_supplier_year.csv')
remit = read('data/processed/remittances_by_source_year.csv')
migr  = read('data/processed/migrants_abroad_by_destination_year.csv')

def sum_latest_pct(rows, pac_field, cp_field, pct_field):
    latest = {}
    for r in rows:
        if r[pac_field] != 'VU':
            continue
        pct = r.get(pct_field)
        if not pct:
            continue
        cp = r[cp_field]
        yr = int(r['year'])
        if cp not in latest or yr > latest[cp][0]:
            latest[cp] = (yr, float(pct))
    total = sum(v for _, v in latest.values())
    return total, len(latest)

a, na = sum_latest_pct(aid,   'recipient_code', 'donor_code',       'pct_gdp')
t, nt = sum_latest_pct(trade, 'reporter_code',  'supplier_code',    'pct_gdp')
r, nr = sum_latest_pct(remit, 'recipient_code', 'source_iso2',      'pct_gdp')
m, nm = sum_latest_pct(migr,  'origin_code',    'destination_iso2', 'pct_population')

print("Vanuatu exposure breakdown:")
print(f"  Aid:          {a:.1f}% of GDP  ({na} donors)")
print(f"  Trade:        {t:.1f}% of GDP  ({nt} suppliers)")
print(f"  Remittances:  {r:.1f}% of GDP  ({nr} sources)")
print(f"  Migration:    {m:.1f}% of population abroad ({nm} destinations)")
print(f"\n  Average (4 metrics): {(a+t+r+m)/4:.1f}%")
