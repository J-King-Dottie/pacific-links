// Canonical Pacific country list, grouped by subregion.
// These are the countries that appear as recipients/origins in our datasets.
// Used to distinguish "Pacific country" from "external country" on map click.
//
// Excluded territories (not independent states — data is absent or too sparse to be meaningful):
//   GU  Guam                — US territory
//   MP  Northern Mariana Is — US territory
//   AS  American Samoa      — US territory
//   PF  French Polynesia    — French collectivity (no bilateral data)
//   WF  Wallis & Futuna     — French collectivity (no bilateral data)
//   TK  Tokelau             — NZ territory (no bilateral data)
//
// Cook Islands (CK) and Niue (NU) are retained: self-governing in free association with NZ,
// recognised as independent states in international datasets.

export const PACIFIC_COUNTRIES = {
  melanesia: [
    { code: 'FJ', name: 'Fiji' },
    { code: 'PG', name: 'Papua New Guinea' },
    { code: 'SB', name: 'Solomon Islands' },
    { code: 'VU', name: 'Vanuatu' },
  ],
  polynesia: [
    { code: 'CK', name: 'Cook Islands' },
    { code: 'NU', name: 'Niue' },
    { code: 'TO', name: 'Tonga' },
    { code: 'TV', name: 'Tuvalu' },
    { code: 'WS', name: 'Samoa' },
  ],
  micronesia: [
    { code: 'FM', name: 'Micronesia (FSM)' },
    { code: 'KI', name: 'Kiribati' },
    { code: 'MH', name: 'Marshall Islands' },
    { code: 'NR', name: 'Nauru' },
    { code: 'PW', name: 'Palau' },
  ],
}

// Flat set of ISO2 codes for quick lookup
export const PACIFIC_CODES = new Set(
  Object.values(PACIFIC_COUNTRIES).flat().map(c => c.code)
)

// Flat array for iteration
export const PACIFIC_LIST = Object.values(PACIFIC_COUNTRIES).flat()

export function isPacific(iso2) {
  return PACIFIC_CODES.has(iso2)
}

export function getPacificName(iso2) {
  return PACIFIC_LIST.find(c => c.code === iso2)?.name ?? iso2
}
