import { useMemo } from 'react'
import { PACIFIC_LIST } from '../data/pacificCountries.js'
import './CoverageMatrix.css'

const YEAR_MIN = 2010
const YEAR_MAX = 2024
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i)

// Metric blocks, in display order, with the brand colours used across the app.
const METRICS = [
  { key: 'aid', label: 'Aid', color: '#8a5c10' },
  { key: 'trade', label: 'Imports', color: '#1e666d' },
  { key: 'remittances', label: 'Remittances', color: '#a0442c' },
  { key: 'migration', label: 'Migration', color: '#76516a' },
  { key: 'debt', label: 'Debt', color: '#507840' },
]

// Short row labels so the shared country axis stays narrow.
const SHORT_NAME = {
  FJ: 'Fiji', PG: 'PNG', SB: 'Solomon Is.', VU: 'Vanuatu',
  CK: 'Cook Is.', NU: 'Niue', TO: 'Tonga', TV: 'Tuvalu', WS: 'Samoa',
  FM: 'Micronesia', KI: 'Kiribati', MH: 'Marshall Is.', NR: 'Nauru', PW: 'Palau',
}

// Build, per metric, the set of "pacificCode|year" cells that have data.
function buildPresence(rows) {
  const sets = Object.fromEntries(METRICS.map(m => [m.key, new Set()]))
  for (const r of rows) {
    const set = sets[r.metric]
    if (set) set.add(`${r.pacificCode}|${r.year}`)
  }
  return sets
}

export default function CoverageMatrix({ rows }) {
  const presence = useMemo(() => buildPresence(rows ?? []), [rows])

  return (
    <div className="coverage-matrix" role="img"
      aria-label="Data coverage grid: 14 Pacific countries down the side, five metrics across the top, each metric showing years 2010 to 2024. Filled cells mark where bilateral data exists.">
      <div className="cov-axis">
        <div className="cov-axis-head" />
        {PACIFIC_LIST.map(c => (
          <div key={c.code} className="cov-row-label" title={c.name}>
            {SHORT_NAME[c.code] ?? c.name}
          </div>
        ))}
      </div>

      {METRICS.map(m => (
        <div key={m.key} className="cov-block">
          <div className="cov-block-head">
            <span className="cov-metric-name" style={{ color: m.color }}>{m.label}</span>
            <span className="cov-metric-years">'10–'24</span>
          </div>
          <div className="cov-grid">
            {PACIFIC_LIST.map(c => (
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
  )
}
