import { useState, useEffect } from 'react'
import { Pause, Play } from 'lucide-react'
import './TopBar.css'

const METRIC_LABELS = {
  aid: 'Aid',
  trade: 'Imports',
  remittances: 'Remittances',
  migration: 'Migration',
  debt: 'Debt',
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
  const [nudge, setNudge] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setNudge(false), 4500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="topbar">
      <div className={`topbar-metrics${nudge ? ' intro-animate' : ''}`} role="tablist" aria-label="Metric">
        {Object.entries(METRIC_LABELS).map(([metric, label]) => (
          <button
            key={metric}
            className={`topbar-metric topbar-metric-${metric} ${selectedMetric === metric ? 'active' : ''}`}
            onClick={() => onSelectMetric(metric)}
            role="tab"
            aria-selected={selectedMetric === metric}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="topbar-time">
        <button
          className={`play-btn ${playing ? 'playing' : ''}`}
          onClick={onPlayToggle}
          aria-label={playing ? 'Pause year animation' : 'Play year animation'}
          title={playing ? 'Pause' : 'Play animation'}
        >
          {playing ? <Pause size={12} strokeWidth={2.4} /> : <Play className="play-icon" size={12} strokeWidth={2.4} fill="currentColor" />}
        </button>
        <input
          type="range"
          min={yearMin}
          max={yearMax}
          value={selectedYear ?? yearMin}
          onChange={e => onYearChange(parseInt(e.target.value))}
          className="year-slider"
          aria-label="Year"
        />
        <span className="year-action">
          <span className="year-display">{selectedYear ?? 'Latest'}</span>
          {selectedYear && <button className="reset-btn" onClick={onYearReset} title="Reset to latest">x</button>}
        </span>
      </div>
    </div>
  )
}
