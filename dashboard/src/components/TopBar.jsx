import { useState, useEffect } from 'react'
import { Pause, Play, HeartHandshake, ArrowLeftRight, Landmark, Shield, Banknote, Plane, GraduationCap, TrendingUp } from 'lucide-react'
import './TopBar.css'

const METRIC_LABELS = {
  aid: 'Aid',
  trade: 'Trade',
  debt: 'Debt',
  security: 'Security',
  remittances: 'Remittances',
  migration: 'Migration',
  students: 'Students',
  investment: 'Investment',
}

const METRIC_ICONS = {
  aid: HeartHandshake,
  trade: ArrowLeftRight,
  debt: Landmark,
  security: Shield,
  remittances: Banknote,
  migration: Plane,
  students: GraduationCap,
  investment: TrendingUp,
}

// Colour for the year timeline, keyed by the active metric (incl. its sub-views).
const METRIC_COLOR = {
  aid: '#8a5c10', aid_committed: '#8a5c10',
  trade: '#1e666d', exports: '#1e666d',
  debt: '#507840',
  security: '#3c6e71', security_arms: '#3c6e71',
  remittances: '#a0442c',
  migration: '#76516a',
  students: '#b45f06',
  fdi: '#45607e', portfolio: '#45607e',
}

function isMetricActive(metric, selectedMetric) {
  if (metric === 'aid') return ['aid', 'aid_committed'].includes(selectedMetric)
  if (metric === 'trade') return ['trade', 'exports'].includes(selectedMetric)
  if (metric === 'security') return ['security', 'security_arms'].includes(selectedMetric)
  if (metric === 'investment') return ['fdi', 'portfolio'].includes(selectedMetric)
  return selectedMetric === metric
}

export default function TopBar({
  activeMetrics,
  onSelectMetric,
  selectedYear,
  yearMin,
  yearMax,
  playing,
  onYearChange,
  onPlayToggle,
  onYearReset,
}) {
  const selectedMetric = activeMetrics[0] ?? 'aid'
  const metricColor = METRIC_COLOR[selectedMetric] ?? '#8a6030'
  const years = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i)
  const currentYear = selectedYear ?? yearMax
  const [nudge, setNudge] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setNudge(false), 4500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="topbar">
      <div className={`topbar-metrics${nudge ? ' intro-animate' : ''}`} role="tablist" aria-label="Metric">
        {Object.entries(METRIC_LABELS).map(([metric, label]) => {
          const Icon = METRIC_ICONS[metric]
          return (
            <button
              key={metric}
              className={`topbar-metric topbar-metric-${metric} ${isMetricActive(metric, selectedMetric) ? 'active' : ''}`}
              onClick={() => onSelectMetric(metric)}
              role="tab"
              aria-selected={isMetricActive(metric, selectedMetric)}
            >
              <Icon className="topbar-metric-icon" size={11} strokeWidth={2.2} />
              {label}
            </button>
          )
        })}
      </div>

      <div className="topbar-time">
        <div className="topbar-time-head">
          <span className="topbar-time-label">Year</span>
          <span className="year-action">
            <span className="year-display">{selectedYear ?? 'Latest'}</span>
            {selectedYear && <button className="reset-btn" onClick={onYearReset} title="Reset to latest">x</button>}
          </span>
        </div>
        <div className="topbar-time-controls">
          <button
            className={`play-btn ${playing ? 'playing' : ''}`}
            onClick={onPlayToggle}
            aria-label={playing ? 'Pause year animation' : 'Play year animation'}
            title={playing ? 'Pause' : 'Play animation'}
          >
            {playing ? <Pause size={11} strokeWidth={0} fill="currentColor" /> : <Play className="play-icon" size={11} strokeWidth={0} fill="currentColor" />}
          </button>
          <div className="year-ticks" style={{ '--metric': metricColor }} role="group" aria-label="Year timeline">
            {years.map(y => (
              <button
                key={y}
                className={`year-tick${y <= currentYear ? ' on' : ''}${y === currentYear ? ' cur' : ''}`}
                onClick={() => onYearChange(y)}
                aria-label={String(y)}
                aria-pressed={y === currentYear}
                title={String(y)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
