import { getTopCounterparts, getInfluencerFootprint } from '../data/computeScores.js'
import './LeftPanel.css'

const METRIC_LABELS = { aid: 'Aid', trade: 'Imports', exports: 'Exports', remittances: 'Remit', migration: 'Migr', debt: 'Debt' }
const METRIC_UNITS  = { aid: 'USD', trade: 'USD', exports: 'USD', remittances: 'USD', migration: 'people', debt: 'USD' }

function fmtValue(value, metric) {
  if (value == null) return '—'
  if (metric === 'migration') return value >= 1000
    ? `${(value / 1000).toFixed(0)}k`
    : value.toFixed(0)
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

export default function LeftPanel({ selectedCountry, dataIndex, exposureScores, activeMetrics }) {
  if (!selectedCountry) {
    return (
      <div className="left-panel empty">
        <p>Click a country on the map to explore its exposure profile.</p>
      </div>
    )
  }

  const { code, name, isPacific } = selectedCountry

  if (isPacific) {
    const score = exposureScores[code]
    const tops = getTopCounterparts(dataIndex, code, activeMetrics, 5)
    const entry = dataIndex[code] ?? {}

    return (
      <div className="left-panel">
        <div className="panel-header">
          <div className="country-name">{name}</div>
          <div className="subregion-tag">Pacific recipient</div>
        </div>

        <div className="section-label">Latest by metric</div>
        <div className="metric-bars">
          {activeMetrics.map(m => {
            const counterparts = entry[m] ?? {}
            const entries = Object.values(counterparts).sort((a, b) => b.value - a.value)
            const top = entries[0]
            if (!top) return (
              <div key={m} className="metric-row no-data">
                <span className={`metric-tag metric-${m}`}>{METRIC_LABELS[m]}</span>
                <span className="no-data-label">no data</span>
              </div>
            )
            const total = entries.reduce((s, e) => s + e.value, 0)
            const topPct = total > 0 ? (top.value / total * 100) : 0
            return (
              <div key={m} className="metric-row">
                <span className={`metric-tag metric-${m}`}>{METRIC_LABELS[m]}</span>
                <div className="bar-wrap">
                  <div className="bar" style={{ width: `${Math.min(topPct, 100)}%` }} />
                </div>
                <span className="bar-value">{fmtValue(top.value, m)}</span>
                <span className="bar-country">{top.name} <span className="year-tag">'{String(top.year).slice(2)}</span></span>
              </div>
            )
          })}
        </div>

        {tops.length > 0 && (
          <>
            <div className="section-label">Top counterparts</div>
            <div className="counterpart-list">
              {tops.map((t, i) => (
                <div key={t.counterpartCode} className="counterpart-row">
                  <span className="rank">{i + 1}</span>
                  <span className="cp-name">{t.counterpartName}</span>
                  <span className="cp-score">{fmtValue(t.totalValue, 'aid')}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // External country — influencer view
  const footprint = getInfluencerFootprint(dataIndex, code, activeMetrics)

  return (
    <div className="left-panel">
      <div className="panel-header">
        <div className="country-name">{name}</div>
        <div className="subregion-tag influencer">External influencer</div>
      </div>

      {footprint.length === 0 ? (
        <p className="no-data-msg">No Pacific exposure data for this country.</p>
      ) : (
        <>
          <div className="section-label">Pacific footprint</div>
          <div className="counterpart-list">
            {footprint.map((f, i) => (
              <div key={f.pacificCode} className="counterpart-row">
                <span className="rank">{i + 1}</span>
                <span className="cp-name">{f.pacificName}</span>
                <span className="cp-score">{fmtValue(f.totalValue, 'aid')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
