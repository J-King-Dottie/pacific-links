COUNTRY_CODES = {
    "american samoa": "AS", "cook islands": "CK", "fiji": "FJ",
    "french polynesia": "PF", "guam": "GU", "kiribati": "KI",
    "marshall islands": "MH", "micronesia": "FM",
    "federated states of micronesia": "FM", "nauru": "NR",
    "new caledonia": "NC", "niue": "NU", "palau": "PW",
    "papua new guinea": "PG", "png": "PG", "samoa": "WS",
    "solomon islands": "SB", "tokelau": "TK", "tonga": "TO",
    "tuvalu": "TV", "vanuatu": "VU", "wallis and futuna": "WF",
}


def country_code(country: str | None) -> str | None:
    if not country:
        return None
    cleaned = country.strip().lower()
    return cleaned.upper() if len(cleaned) == 2 and cleaned.isalpha() else COUNTRY_CODES.get(cleaned)

