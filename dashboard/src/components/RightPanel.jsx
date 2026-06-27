import { Fragment, useState } from 'react'
import { getTopCounterparts, getInfluencerFootprint } from '../data/computeScores.js'
import './RightPanel.css'

const METRIC_LABELS = { aid: 'Aid', trade: 'Imports', exports: 'Exports', remittances: 'Remittances', migration: 'Migration', debt: 'Debt' }
const METRIC_UNITS  = { aid: 'USD', trade: 'USD', exports: 'USD', remittances: 'USD', migration: 'people', debt: 'USD' }

function fmtValue(value, metric) {
  if (value == null) return '—'
  if (metric === 'migration') {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`
    return value.toFixed(0)
  }
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

function TradeBreakdown({ row }) {
  const breakdown = row.hs1Breakdown ?? []
  if (!breakdown.length) return null

  return (
    <tr className="breakdown-row">
      <td colSpan="3">
        <div className="breakdown-wrap">
          {breakdown.slice(0, 10).map(item => {
            const share = row.value ? (item.value / row.value) * 100 : null
            return (
              <div key={`${row.code}-${item.hs1Code}`} className="breakdown-item">
                <span className="breakdown-label">
                  HS{item.hs1Code} {item.hs1Name}
                </span>
                <span className="breakdown-value">
                  {fmtValue(item.value, 'trade')}
                  {share != null && <span className="breakdown-share"> {share.toFixed(1)}%</span>}
                </span>
              </div>
            )
          })}
        </div>
      </td>
    </tr>
  )
}

function MetricTable({ metric, rows, onCountryClick }) {
  const [expandedTrade, setExpandedTrade] = useState(null)

  if (!rows || rows.length === 0) return (
    <div className="metric-section">
      <div className={`metric-section-title metric-${metric}`}>{METRIC_LABELS[metric]}</div>
      <div className="no-data-row">No data</div>
    </div>
  )

  return (
    <div className="metric-section">
      <div className={`metric-section-title metric-${metric}`}>{METRIC_LABELS[metric]}</div>
      <table>
        <tbody>
          {rows.map((r, i) => {
            const tradeKey = `${r.code}-${r.year}`
            const hasBreakdown = ['trade', 'exports'].includes(metric) && (r.hs1Breakdown?.length ?? 0) > 0
            const isExpanded = expandedTrade === tradeKey
            return (
              <Fragment key={tradeKey}>
                <tr
                  className={`cp-row ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => {
                    if (hasBreakdown) {
                      setExpandedTrade(isExpanded ? null : tradeKey)
                      return
                    }
                    onCountryClick(r.code, r.name)
                  }}
                >
                  <td className="rank-cell">{i + 1}</td>
                  <td className="cp-name-cell">
                    {r.name}
                    {hasBreakdown && <span className="expand-tag">{isExpanded ? 'Hide HS1' : 'Show HS1'}</span>}
                  </td>
                  <td className="value-cell">
                    {fmtValue(r.value, metric)}
                    <span className="year-tag"> '{String(r.year).slice(2)}</span>
                  </td>
                </tr>
                {hasBreakdown && isExpanded && <TradeBreakdown row={r} />}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function RightPanel({ selectedCountry, dataIndex, activeMetrics, onCountryClick }) {
  if (!selectedCountry) {
    return (
      <div className="right-panel empty">
        <p>Click a country to see bilateral breakdown.</p>
      </div>
    )
  }

  const { code, name, isPacific: isP } = selectedCountry

  // Build per-metric rows for Pacific recipient view
  function pacificMetricRows(metric) {
    const counterparts = dataIndex[code]?.[metric] ?? {}
    return Object.entries(counterparts)
      .map(([cpCode, d]) => ({
        code: cpCode, name: d.name, value: d.value, year: d.year, hs1Breakdown: d.hs1Breakdown,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }

  // Build per-metric rows for influencer view
  function influencerMetricRows(metric) {
    return Object.entries(dataIndex)
      .filter(([pacCode]) => {
        // only Pacific countries
        const cp = dataIndex[pacCode]?.[metric]?.[code]
        return cp != null
      })
      .map(([pacCode, entry]) => {
        const cp = entry[metric]?.[code]
        return { code: pacCode, name: cp ? Object.values(entry[metric] ?? {})[0]?.name ?? pacCode : pacCode, value: cp.value, year: cp.year, pacCode }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }

  // For influencer we need pacific names — pull from PACIFIC_LIST via dataIndex keys
  function influencerMetricRowsClean(metric) {
    const rows = []
    for (const [pacCode, entry] of Object.entries(dataIndex)) {
      const cp = entry[metric]?.[code]
      if (!cp) continue
      // Get pacific name from any entry in the metric
      const anyEntry = Object.values(entry[metric] ?? {})[0]
      rows.push({ code: pacCode, name: pacCode, value: cp.value, year: cp.year })
    }
    return rows.sort((a, b) => b.value - a.value).slice(0, 10)
  }

  return (
    <div className="right-panel">
      <div className="panel-title">
        {name}
        <span className="panel-subtitle"> — {isP ? 'exposure by source' : 'Pacific footprint'}</span>
      </div>
      <div className="metrics-list">
        {activeMetrics.map(metric => (
          <MetricTable
            key={metric}
            metric={metric}
            rows={isP ? pacificMetricRows(metric) : influencerMetricRowsClean(metric)}
            onCountryClick={onCountryClick}
          />
        ))}
      </div>
    </div>
  )
}
