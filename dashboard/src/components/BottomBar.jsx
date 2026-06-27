import './BottomBar.css'

const METRIC_LABELS = { aid: 'Aid', trade: 'Trade', exports: 'Exports', fdi: 'FDI', remittances: 'Remittances', migration: 'Migration', debt: 'Debt' }
const SOURCES = {
  aid: 'Lowy Pacific Aid Map via PDH',
  trade: 'CEPII BACI reconciled bilateral trade data',
  exports: 'CEPII BACI reconciled bilateral trade data',
  fdi: 'IMF Direct Investment Positions by Counterpart Economy',
  remittances: 'World Bank / KNOMAD Bilateral Remittance Matrices',
  migration: 'UN International Migrant Stock 2024',
  debt: 'World Bank International Debt Statistics',
}

export default function BottomBar({ selectedYear, activeMetrics, metricYears }) {
  const mode = selectedYear ? `Year: ${selectedYear}` : 'Latest available'

  return (
    <div className="bottombar">
      <div className="legend">
        <div className="legend-scale">
          <div className="legend-gradient" />
          <span>Low exposure</span>
          <span>High exposure</span>
        </div>
      </div>

      <div className="data-note">
        {mode}
        {!selectedYear && (
          <span className="note-detail"> - within a 3-year freshness window</span>
        )}
      </div>

      <div className="sources">
        {activeMetrics.map(m => (
          <span key={m} className="source-item">
            <span className={`dot dot-${m}`} />
            {METRIC_LABELS[m]} ({metricYears[m]?.min}-{metricYears[m]?.max}): {SOURCES[m]}
          </span>
        ))}
      </div>
    </div>
  )
}
