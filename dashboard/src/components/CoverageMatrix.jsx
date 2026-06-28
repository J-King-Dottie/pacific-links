import { useMemo } from 'react'
import { PACIFIC_LIST } from '../data/pacificCountries.js'
import './CoverageMatrix.css'

const YEAR_MIN = 2010
const YEAR_MAX = 2024
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i)

// Metric blocks, in display order, with the brand colours used across the app.
const METRICS = [
  { key: 'aid', label: 'Aid', color: '#8a5c10', includes: ['aid', 'aid_committed'],
    sources: [{ text: 'Lowy', url: 'https://pacificdata.org/data/dataset/pacific-aid-and-development-finance-data-from-the-lowy-institute-df-pam' }] },
  { key: 'trade', label: 'Trade', color: '#1e666d', includes: ['trade', 'exports'],
    sources: [{ text: 'CEPII', url: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37' }] },
  { key: 'debt', label: 'Debt', color: '#507840',
    sources: [{ text: 'World Bank', url: 'https://databank.worldbank.org/source/international-debt-statistics' }] },
  { key: 'security', label: 'Security', color: '#3c6e71', includes: ['security', 'security_arms'],
    sources: [
      { text: 'OECD', url: 'https://sdmx.oecd.org/dcd-public/rest/dataflow/OECD.DCD.FSD/DSD_CRS@DF_CRS/1.6' },
      { text: 'SIPRI', url: 'https://armstransfers.sipri.org/ArmsTransfer/TransferRegister' },
    ] },
  { key: 'remittances', label: 'Remittances', color: '#a0442c',
    sources: [{ text: 'World Bank · KNOMAD', url: 'https://web.archive.org/web/20231119232039/https://www.knomad.org/data/remittances' }] },
  { key: 'migration', label: 'Migration', color: '#76516a',
    sources: [{ text: 'UN DESA', url: 'https://www.un.org/development/desa/pd/content/international-migrant-stock' }] },
  { key: 'students', label: 'Students', color: '#b45f06',
    sources: [{ text: 'UNESCO', url: 'https://databrowser.uis.unesco.org/resources/bulk' }] },
  { key: 'investment', label: 'Investment', color: '#2f5fb3', includes: ['fdi', 'portfolio'],
    sources: [
      { text: 'IMF CDIS', title: 'IMF Direct Investment Positions (CDIS) — FDI', url: 'https://data.imf.org/en/datasets/IMF.STA:DIP' },
      { text: 'IMF CPIS', title: 'IMF Portfolio Investment Positions (CPIS) — portfolio', url: 'https://data.imf.org/en/datasets/IMF.STA:PIP' },
    ] },
]

const METRIC_ROWS = [
  METRICS.slice(0, 4),
  METRICS.slice(4),
]

// Short row labels so the shared country axis stays narrow.
const SHORT_NAME = {
  FJ: 'Fiji', PG: 'PNG', SB: 'Solomon Is.', VU: 'Vanuatu',
  CK: 'Cook Is.', NU: 'Niue', TO: 'Tonga', TV: 'Tuvalu', WS: 'Samoa',
  FM: 'Micronesia', KI: 'Kiribati', MH: 'Marshall Is.', NR: 'Nauru', PW: 'Palau',
}

const SORTED_PACIFIC_LIST = [...PACIFIC_LIST].sort((a, b) =>
  (SHORT_NAME[a.code] ?? a.name).localeCompare(SHORT_NAME[b.code] ?? b.name)
)

// Build, per metric, the set of "pacificCode|year" cells that have data.
function buildPresence(rows) {
  const sets = Object.fromEntries(METRICS.map(m => [m.key, new Set()]))
  for (const r of rows) {
    const metric = METRICS.find(m => (m.includes ?? [m.key]).includes(r.metric))
    const set = metric ? sets[metric.key] : null
    if (set) set.add(`${r.pacificCode}|${r.year}`)
  }
  return sets
}

export default function CoverageMatrix({ rows }) {
  const presence = useMemo(() => buildPresence(rows ?? []), [rows])

  return (
    <div className="coverage-matrix" role="group"
      aria-label="Data coverage grid: 14 Pacific countries down the side, eight metrics across the top, each labelled with its linked source and showing years 2010 to 2024. Filled cells mark where bilateral data exists.">
      {METRIC_ROWS.map((metricRow, rowIndex) => (
        <div key={rowIndex} className="cov-row">
          <div className="cov-axis">
            <div className="cov-axis-head" />
            {SORTED_PACIFIC_LIST.map(c => (
              <div key={c.code} className="cov-row-label" title={c.name}>
                {SHORT_NAME[c.code] ?? c.name}
              </div>
            ))}
          </div>

          {metricRow.map(m => (
            <div key={m.key} className="cov-block">
              <div className="cov-block-head">
                <span className="cov-metric-name" style={{ color: m.color }}>{m.label}</span>
                <span className="cov-metric-source">
                  {m.sources.map((s, i) => (
                    <span key={s.url}>
                      {i > 0 && <span className="cov-source-sep"> · </span>}
                      <a href={s.url} target="_blank" rel="noreferrer" title={s.title ?? `Source: ${s.text}`}>{s.text}</a>
                    </span>
                  ))}
                </span>
                <span className="cov-metric-years">'10–'24</span>
              </div>
              <div className="cov-grid">
                {SORTED_PACIFIC_LIST.map(c => (
                  YEARS.map(y => {
                    const on = presence[m.key].has(`${c.code}|${y}`)
                    return (
                      <span
                        key={`${c.code}-${y}`}
                        className={`cov-cell${on ? ' on' : ''}`}
                        style={on ? { background: m.color, borderColor: m.color } : undefined}
                      />
                    )
                  })
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
