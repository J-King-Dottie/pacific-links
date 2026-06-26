import urllib.request, json

PACIFIC_ISO2 = ["FJ", "PG", "SB", "VU", "WS", "TO", "TV", "CK", "NU", "KI", "FM", "MH", "PW", "NR"]

country_str = ";".join(PACIFIC_ISO2)
url = f"https://api.worldbank.org/v2/country/{country_str}/indicator/NY.GDP.MKTP.CD?format=json&date=2010:2024&per_page=1000"
with urllib.request.urlopen(url, timeout=30) as r:
    raw = r.read()
data = json.loads(raw)
print('type:', type(data), 'len:', len(data))
print('data[0]:', data[0])
