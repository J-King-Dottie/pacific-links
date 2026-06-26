import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Info, Pause, Play, X } from 'lucide-react'
import { PACIFIC_LIST } from '../data/pacificCountries.js'
import { METRICS } from '../data/computeScores.js'
import { useIsMobile } from '../hooks/useIsMobile.js'
import './SidePanel.css'

// Bottom-sheet snap points on phones, as fractions of viewport height.
const SHEET_SNAPS = { peek: 0.12, half: 0.5, full: 0.9 }

const METRIC_LABELS = { aid: 'Aid', trade: 'Imports', remittances: 'Remittances', migration: 'Migration', debt: 'Debt' }

const DENOMINATOR_SOURCES = {
  gdp: [
    { text: 'World Bank', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD' },
    { text: 'UN SNAAMA', url: 'https://unstats.un.org/unsd/snaama/' },
    { text: 'Niue Statistics Office National Accounts', url: 'https://niuestatistics.nu/economic/national-accounts-estimates-of-niue-2024/' },
  ],
  population: [
    { text: 'World Bank', url: 'https://data.worldbank.org/indicator/SP.POP.TOTL' },
    { text: 'UN SNAAMA', url: 'https://unstats.un.org/unsd/snaama/' },
    { text: 'Niue Statistics Office National Accounts', url: 'https://niuestatistics.nu/economic/national-accounts-estimates-of-niue-2024/' },
  ],
}

const METRIC_INFO = {
  aid: {
    source: 'Lowy Institute Pacific Aid Map via Pacific Data Hub',
    sourceUrl: 'https://pacificdata.org/data/dataset/pacific-aid-and-development-finance-data-from-the-lowy-institute-df-pam',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. Figures are aid and development finance actually disbursed (spent), in current US dollars, by donor. The most recent year is partial and rises as donors finish reporting.',
    why: 'Lowy is the most complete public source for Pacific aid and development finance. We use it because this dashboard is trying to show who is actually funding Pacific countries, not just who announced support. Lowy brings donor-level aid flows into one consistent public dataset, which makes it the best fit for comparing aid relationships across the region.',
    changed: 'We show spent/disbursed aid only, not commitments, because it is the money that actually flowed. Aggregate donor categories are removed, so the table shows direct donor relationships only. The dollar figures are Lowy\'s.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  trade: {
    source: 'CEPII BACI reconciled bilateral trade data',
    sourceUrl: 'https://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37',
    coverage: 'The dashboard covers 14 Pacific island countries from 2010 to 2024. Figures are annual merchandise (goods) imports in current US dollars, by supplier country; services are not included.',
    why: 'No trade dataset is perfect, and different sources can be correct while answering different questions. Pacific Data Hub and UN Comtrade are useful sources for reported trade, but reported imports and reported exports often do not match: imports usually include freight and insurance, exports usually do not, and countries can disagree on partner, destination, or product classification. For this dashboard, we want the best country-to-country view of where Pacific imports come from. BACI starts from UN Comtrade and reconciles importer and exporter reports into one flow, which makes it the better fit for comparing external trade relationships.',
    changed: 'We group the import values by supplier country and remove a small set of flows that appear to reflect ships, bunkering fuel, or flag-registry effects rather than goods imported for the local economy. This matters because countries such as the Marshall Islands register many foreign-owned vessels; trade records can then show large ship or fuel transactions tied to the flag on the vessel, even when the activity is not a normal domestic import. We remove commercial vessels (HS 8901), Marshall Islands refined petroleum/bunkering fuel (HS 271000), and Marshall Islands vessel flows (HS 89). Marshall Islands and other Pacific islands trade data may still be distorted by this issue.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  remittances: {
    source: 'World Bank and KNOMAD Bilateral Remittance Matrices',
    sourceUrl: 'https://web.archive.org/web/20231119232039/https://www.knomad.org/data/remittances',
    sourceLinks: [
      { text: '2021 matrix download', url: 'https://thedocs.worldbank.org/en/doc/cf8eee7ff5029398f75e897b342e7320-0050122023/related/WB-KNOMAD.xlsx' },
      { text: '2018 matrix download', url: 'https://thedocs.worldbank.org/en/doc/904591573826885707-0090022019/original/Bilateralremittancematrix2018Oct2019.xlsx' },
      { text: '2017 matrix archive', url: 'https://web.archive.org/web/20190124090151id_/http://pubdocs.worldbank.org/en/705611533661084197/bilateralremittancematrix2017-Apr2018.xlsx' },
      { text: '2010 matrix archive', url: 'https://web.archive.org/web/20160531235700id_/http://pubdocs.worldbank.org:80/pubdocs/publicdoc/2015/9/895701443117529385/Bilateral-Remittance-Matrix-2010.xlsx' },
    ],
    coverage: 'The dashboard covers 14 Pacific island countries. Figures are modelled bilateral remittances received, in current US dollars, by source country, for benchmark years only: 2010, 2017, 2018 and 2021.',
    why: 'We could not find any public bilateral remittance data other than World Bank/KNOMAD. Most remittance data shows only how much money each country receives or sends in total; this matrix estimates the country-to-country links behind those totals, which is the relationship this dashboard needs. The latest bilateral matrix we found is from 2021. Current public pages mainly show aggregate remittance data, so we link to the archived KNOMAD page that listed the matrix downloads.',
    changed: 'We remove non-country aggregate rows where present. The source provides benchmark years only, and we leave it that way: we do not interpolate missing years or re-estimate missing flows. The estimates shown are the published modelled values.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
  migration: {
    source: 'UN International Migrant Stock 2024',
    sourceUrl: 'https://www.un.org/development/desa/pd/content/international-migrant-stock',
    coverage: 'The dashboard covers 14 Pacific island countries. Figures are migrant stock — the number of people born in the Pacific country living in each destination, counted as people, not yearly movement — for benchmark years only: 2010, 2015, 2020 and 2024.',
    why: 'The UN migrant stock data is the standard public source for where people born in one country are living. We use migrant stock, not annual migration flows, because this dashboard is about long-running external connections: where Pacific communities have built up overseas over time, and where family, labour, education, and remittance links are likely to be strongest. In some small islands, more people can live overseas than currently live in the country, so percentages can be over 100%.',
    changed: 'We remove regional and aggregate destination rows so the table shows country-to-country destinations only. The headcounts shown are the UN migrant stock values.',
    denominator: 'Population uses [World Bank] where available; [UN SNAAMA] / implied resident population for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.population,
  },
  debt: {
    source: 'World Bank International Debt Statistics',
    sourceUrl: 'https://databank.worldbank.org/source/international-debt-statistics',
    coverage: 'The dashboard covers the seven IDS-reporting Pacific countries (Fiji, FSM, PNG, Samoa, Solomon Islands, Tonga, Vanuatu) from 2010 to 2024. Figures are end-of-year external debt stock outstanding, public and publicly guaranteed (PPG), in current US dollars, by creditor.',
    why: 'World Bank IDS is the standard public source for creditor-level external public debt where countries report it. We use debt stock, not new borrowing or commitments, because this dashboard is trying to show who Pacific countries currently owe money to. That makes it closer to a relationship map of outstanding obligations than a record of new loans announced in a given year.',
    changed: 'We show the rows where IDS reports that a Pacific country owed money to a creditor in that year, and keep the creditor names IDS reports, including multilateral and institutional creditors. The amounts shown are the IDS debt stock values.',
    denominator: 'GDP uses [World Bank] where available; [UN SNAAMA] for Cook Islands; [Niue Statistics Office National Accounts] for Niue.',
    denominatorLinks: DENOMINATOR_SOURCES.gdp,
  },
}
const PAC_NAMES = Object.fromEntries(PACIFIC_LIST.map(c => [c.code, c.name]))

const METRIC_PCT_LABEL = {
  aid: '% of GDP', trade: '% of GDP', remittances: '% of GDP', migration: '% of pop', debt: '% of GDP',
}

const DEFAULT_ROW_LIMIT = 10

// Colors matching MapView INFLUENCER_COLORS
const COUNTRY_COLORS = ['#b47828', '#2a6b72', '#a0442c', '#7a5a6e', '#507840', '#a06432']

const INTERPRETATION_COPY = {
  default: {
    aid: 'How important is outside aid to each Pacific economy?',
    trade: 'How much does each Pacific economy rely on goods from overseas?',
    remittances: 'How important is money sent from overseas to each Pacific economy?',
    migration: 'What share of each Pacific country\'s people live overseas?',
    debt: 'How large is each Pacific country\'s external public debt burden?',
  },
  pacific: {
    aid: 'Who does the selected Pacific country rely on most for aid?',
    trade: 'Where does the selected Pacific country buy most of its imported goods?',
    remittances: 'Where does money sent home to the selected Pacific country come from?',
    migration: 'Where do people from the selected Pacific country live overseas?',
    debt: 'Who does the selected Pacific country owe external public debt to?',
  },
  influencer: {
    aid: 'Where does the selected outside partner send its Pacific aid?',
    trade: 'Which Pacific countries buy goods from the selected outside partner?',
    remittances: 'Which Pacific countries receive money from people in the selected outside partner?',
    migration: 'Which Pacific communities live in the selected outside partner?',
    debt: 'Which Pacific countries owe debt to the selected outside partner?',
  },
  pacificComparison: {
    aid: 'Who do the selected Pacific countries rely on most for aid?',
    trade: 'Where do the selected Pacific countries buy most of their imported goods?',
    remittances: 'Where does money sent home to the selected Pacific countries come from?',
    migration: 'Where do people from the selected Pacific countries live overseas?',
    debt: 'Who do the selected Pacific countries owe external public debt to?',
  },
  influencerComparison: {
    aid: 'Where do the selected outside partners send their Pacific aid?',
    trade: 'Which Pacific countries buy goods from the selected outside partners?',
    remittances: 'Which Pacific countries receive money from people in the selected outside partners?',
    migration: 'Which Pacific communities live in the selected outside partners?',
    debt: 'Which Pacific countries owe debt to the selected outside partners?',
  },
}

function formatCountryList(countries) {
  const names = countries.map(c => c.name)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function selectedInterpretation(metric, mode, countries = []) {
  const names = formatCountryList(countries)
  if (!names) return INTERPRETATION_COPY[mode]?.[metric]

  if (mode === 'pacific') {
    return {
      aid: `Who does ${names} rely on most for aid?`,
      trade: `Where does ${names} buy most of its imported goods?`,
      remittances: `Where does money sent home to ${names} come from?`,
      migration: `Where do people from ${names} live overseas?`,
      debt: `Who does ${names} owe external public debt to?`,
    }[metric]
  }

  if (mode === 'influencer') {
    return {
      aid: `Where does ${names} send its Pacific aid?`,
      trade: `Which Pacific countries buy goods from ${names}?`,
      remittances: `Which Pacific countries receive money from people in ${names}?`,
      migration: `Which Pacific communities live in ${names}?`,
      debt: `Which Pacific countries owe debt to ${names}?`,
    }[metric]
  }

  if (mode === 'pacificComparison') {
    return {
      aid: `Who do ${names} rely on most for aid?`,
      trade: `Where do ${names} buy most of their imported goods?`,
      remittances: `Where does money sent home to ${names} come from?`,
      migration: `Where do people from ${names} live overseas?`,
      debt: `Who do ${names} owe external public debt to?`,
    }[metric]
  }

  if (mode === 'influencerComparison') {
    return {
      aid: `Where do ${names} send their Pacific aid?`,
      trade: `Which Pacific countries buy goods from ${names}?`,
      remittances: `Which Pacific countries receive money from people in ${names}?`,
      migration: `Which Pacific communities live in ${names}?`,
      debt: `Which Pacific countries owe debt to ${names}?`,
    }[metric]
  }

  return INTERPRETATION_COPY[mode]?.[metric]
}

function InterpretationNote({ metric, mode, countries = [] }) {
  const text = selectedInterpretation(metric, mode, countries)
  if (!text) return null
  return <p className="interpretation-note">{text}</p>
}

function SelectionPills({ countries, onRemoveCountry }) {
  if (!countries?.length) return null
  return <CountryChips countries={countries} onRemoveCountry={onRemoveCountry} />
}

function InfoIcon({ metric }) {
  const btnRef = useRef(null)
  const hideTimerRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const info = METRIC_INFO[metric]
  if (!info) return null
  const clearHideTimer = () => {
    if (!hideTimerRef.current) return
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }
  const showTooltip = () => {
    clearHideTimer()
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ left: rect.right + 8, top: rect.top - 4 })
    setVisible(true)
  }
  const hideTooltip = () => {
    if (pinned) return
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setVisible(false), 120)
  }
  const togglePinned = () => {
    if (pinned) {
      setPinned(false)
      setVisible(false)
      return
    }
    showTooltip()
    setPinned(true)
  }
  return (
    <span className="info-icon-wrap">
      <button
        ref={btnRef}
        className={`info-icon-btn ${pinned ? 'pinned' : ''}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={togglePinned}
        aria-label="Data info"
      ><Info size={12} /></button>
      {visible && (
        <div
          className={`info-tooltip ${pinned ? 'pinned' : ''}`}
          style={{ left: pos.left, top: pos.top }}
          onMouseEnter={showTooltip}
          onMouseLeave={hideTooltip}
        >
          <div className="info-section">
            <span className="info-label">Source</span>
            <span>
              {info.sourceUrl && <a className="info-source-link" href={info.sourceUrl} target="_blank" rel="noreferrer">{info.source}</a>}
              {!info.sourceUrl && info.source}
              {info.sourceLinks && (
                <span className="info-inline-links">
                  {info.sourceLinks.map((link, i) => (
                    <a key={link.url} className="info-source-link" href={link.url} target="_blank" rel="noreferrer">
                      {link.text}{i < info.sourceLinks.length - 1 ? '; ' : ''}
                    </a>
                  ))}
                </span>
              )}
            </span>
          </div>
          <InfoSection label="Coverage" text={info.coverage} />
          <InfoSection label="Why this source" text={info.why} />
          <InfoSection label="What we did" text={info.changed} />
          <InfoSection label="Denominator" text={info.denominator} links={info.denominatorLinks} />
        </div>
      )}
    </span>
  )
}

function InfoSection({ label, text, links }) {
  if (!text) return null
  return (
    <div className="info-section">
      <span className="info-label">{label}</span>
      <span>
        <LinkedText text={text} links={links} />
      </span>
    </div>
  )
}

function LinkedText({ text, links }) {
  if (!links?.length) return text
  const linkMap = Object.fromEntries(links.map(link => [link.text, link]))
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) => {
    const label = part.match(/^\[([^\]]+)\]$/)?.[1]
    const link = label ? linkMap[label] : null
    if (!link) return part.replace(/^\[|\]$/g, '')
    return (
      <a key={`${link.url}-${i}`} className="info-source-link" href={link.url} target="_blank" rel="noreferrer">
        {label}
      </a>
    )
  })
}

function fmtValue(value, metric, bare = false) {
  if (value == null) return '-'
  const $ = bare ? '' : '$'
  if (value >= 1e9) return `${$}${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${$}${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${$}${(value / 1e3).toFixed(1)}K`
  return `${$}${value.toFixed(1)}`
}

function fmtPct(pct, bare = false) {
  if (pct == null) return '-'
  return bare ? pct.toFixed(1) : `${pct.toFixed(1)}%`
}

function sortByPctThenValue(a, b) {
  const aPct = Number.isFinite(a.pct) ? a.pct : -Infinity
  const bPct = Number.isFinite(b.pct) ? b.pct : -Infinity
  return bPct - aPct || b.value - a.value
}

function metricTotal(rows) {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.pct) ? r.pct : 0), 0)
}

function metricValueTotal(rows) {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.value) ? r.value : 0), 0)
}

function metricLatestYear(rows) {
  return rows.reduce((latest, r) => Number.isFinite(r.year) ? Math.max(latest, r.year) : latest, 0) || null
}

function pctAggregate(rows) {
  let valueTotal = 0
  let denominatorTotal = 0
  for (const r of rows) {
    const pct = Number.isFinite(r.pct) ? r.pct : null
    const value = Number.isFinite(r.value) ? r.value : null
    if (!(pct > 0) || !(value > 0)) continue
    valueTotal += value
    denominatorTotal += value / (pct / 100)
  }
  return denominatorTotal > 0 ? (valueTotal / denominatorTotal) * 100 : null
}

function outflowShareRows(rows) {
  const totalValue = metricValueTotal(rows)
  return rows.map(row => ({
    ...row,
    pct: totalValue > 0 && Number.isFinite(row.value) ? (row.value / totalValue) * 100 : null,
  }))
}

function aggregatePacificMetric(dataIndex, metric) {
  const recipientRows = PACIFIC_LIST.map(pac => {
    const counterparts = Object.values(dataIndex[pac.code]?.[metric] ?? {})
    const value = counterparts.reduce((sum, r) => sum + (Number.isFinite(r.value) ? r.value : 0), 0)
    const pct = counterparts.reduce((sum, r) => sum + (Number.isFinite(r.pct) ? r.pct : 0), 0)
    const year = metricLatestYear(counterparts)
    return { value, pct, year }
  })
  return {
    pct: pctAggregate(recipientRows),
    value: metricValueTotal(recipientRows),
  }
}

function MetricTotal({ metric, pct, value, year, label = 'Total exposure' }) {
  return (
    <div className="metric-row metric-total-row">
      <span className="rank"></span>
      <span className="row-name metric-total-label">{label}</span>
      <span className="val-primary">{fmtPct(pct, true)}</span>
      <span className="val-secondary">{fmtValue(value, metric, true)}</span>
      <span className="year-tag">{year ? `'${String(year).slice(2)}` : ''}</span>
    </div>
  )
}

function MetricColumnHeaders({ metric, className = '', pctLabel }) {
  return (
    <div className={`col-headers metric-card-headers ${className}`.trim()}>
      <span className="col-country"></span>
      <span className="col-pct">{pctLabel ?? METRIC_PCT_LABEL[metric]}</span>
      <span className="col-abs">{metric === 'migration' ? 'people' : '$USD'}</span>
      <span className="col-year">yr</span>
    </div>
  )
}

function HeaderCell({ top, bottom, className = '', style }) {
  return (
    <span className={`table-header-cell ${className}`.trim()} style={style}>
      <span className="table-header-top">{top}</span>
      <span className="table-header-bottom">{bottom}</span>
    </span>
  )
}

function unitLabel(metric, kind) {
  if (kind === 'pctTotal') return '% total'
  if (kind === 'exposure') return metric === 'migration' ? '% pop' : '% GDP'
  if (kind === 'value') return metric === 'migration' ? 'people' : '$ USD'
  if (kind === 'year') return 'year'
  return ''
}

function TradeBreakdownRow({ row }) {
  const breakdown = row.hs1Breakdown ?? []
  if (!breakdown.length) return null

  return (
    <div className="trade-breakdown">
      {breakdown.slice(0, 10).map(item => (
        <div key={`${row.code}-${item.hs1Code}`} className="metric-row trade-breakdown-row">
          <span className="rank"></span>
          <span className="row-name trade-breakdown-name" title={item.hs1Name}>{item.hs1Name}</span>
          <span className="val-primary">{fmtPct(item.pct, true)}</span>
          <span className="val-secondary">{fmtValue(item.value, 'trade', true)}</span>
          <span className="year-tag"></span>
        </div>
      ))}
    </div>
  )
}

function MetricSelector({ selectedMetric, onSelectMetric }) {
  return (
    <div className="metric-selector" role="tablist" aria-label="Metric">
      {METRICS.map(metric => (
        <button
          key={metric}
          className={`metric-tab metric-${metric} ${selectedMetric === metric ? 'active' : ''}`}
          onClick={() => onSelectMetric(metric)}
          role="tab"
          aria-selected={selectedMetric === metric}
        >
          {METRIC_LABELS[metric]}
        </button>
      ))}
    </div>
  )
}

function ExpandRowsButton({ expanded, hiddenCount, onClick }) {
  if (hiddenCount <= 0) return null
  return (
    // preventDefault on mousedown stops the button taking focus, which would make
    // the browser scroll it into view as the list grows — dragging the pinned
    // country pill up and out of the scroll area.
    <button
      className="metric-row metric-row-expand-control"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
    >
      <span className="rank">
        {expanded ? <ChevronUp size={12} strokeWidth={2.2} /> : <ChevronDown size={12} strokeWidth={2.2} />}
      </span>
      <span className="row-name">{expanded ? 'Show top 10' : `Show ${hiddenCount} more`}</span>
      <span className="val-primary"></span>
      <span className="val-secondary"></span>
      <span className="year-tag"></span>
    </button>
  )
}

function MetricTableCard({
  metric,
  columns,
  rows,
  summaryLabel,
  summaryCells,
  limitRows = false,
  onRowClick,
  renderRowExtra,
}) {
  const [expandedRows, setExpandedRows] = useState(false)
  const visibleRows = !limitRows || expandedRows ? rows : rows.slice(0, DEFAULT_ROW_LIMIT)
  const hiddenCount = limitRows ? Math.max(0, rows.length - DEFAULT_ROW_LIMIT) : 0

  return (
    <div className="metric-table-shell">
      <div className={`single-table-header metric-${metric}`}>
        <div className="metric-header-title-group">
          <span className="metric-header-label">{METRIC_LABELS[metric]}</span>
          <InfoIcon metric={metric} />
        </div>
        <div className="col-headers metric-card-headers metric-header-columns">
          <span className="col-country"></span>
          {columns.map(column => (
            <HeaderCell
              key={column.key}
              top={column.headerTop}
              bottom={column.headerBottom}
              className={column.className}
              style={column.style}
            />
          ))}
        </div>
      </div>
      <div className="metric-table-preview">
        <div className="metric-row metric-total-row">
          <span className="rank"></span>
          <span className="row-name metric-total-label">{summaryLabel}</span>
          {columns.map(column => (
            <span key={column.key} className={column.className} style={column.style} title={column.title}>
              {summaryCells[column.key] ?? ''}
            </span>
          ))}
        </div>
      </div>
      <div className="metric-rows single-table-rows">
        {rows.length === 0
          ? <div className="no-data-row">No data available</div>
          : visibleRows.map((row, i) => {
            const extra = renderRowExtra?.(row)
            return (
              <div key={row.key ?? row.code} className={`metric-row-stack ${extra ? 'expanded' : ''}`}>
                <div className={`metric-row ${row.expandable ? 'metric-row-expandable' : ''}`} onClick={() => onRowClick?.(row, i)}>
                  <span className="rank">{i + 1}</span>
                  <span className="row-name">{row.name}</span>
                  {columns.map(column => (
                    <span key={column.key} className={column.className} style={column.style} title={column.title}>
                      {row.cells[column.key] ?? '-'}
                    </span>
                  ))}
                </div>
                {extra}
              </div>
            )
          })
        }
        <ExpandRowsButton expanded={expandedRows} hiddenCount={hiddenCount} onClick={() => setExpandedRows(v => !v)} />
      </div>
    </div>
  )
}

function MetricTable({ metric, rows, totalPct, totalValue, totalYear, totalLabel, onMetricCountryClick, isPacific, pctLabel, limitRows = true }) {
  const [expandedTrade, setExpandedTrade] = useState(null)
  const columns = [
    {
      key: 'pct',
      headerTop: pctLabel?.startsWith('%') ? '%' : '%',
      headerBottom: pctLabel?.replace(/^%\s*/, '') || unitLabel(metric, 'exposure').replace(/^%\s*/, ''),
      className: 'val-primary',
    },
    {
      key: 'value',
      headerTop: metric === 'migration' ? '' : '$',
      headerBottom: metric === 'migration' ? 'people' : 'USD',
      className: 'val-secondary',
    },
    { key: 'year', headerTop: '', headerBottom: 'yr', className: 'year-tag' },
  ]
  const tableRows = rows.map((r, i) => ({
    ...r,
    key: `${r.code}-${r.year ?? i}`,
    expandable: metric === 'trade' && isPacific && (r.hs1Breakdown?.length ?? 0) > 0,
    cells: {
      pct: fmtPct(r.pct, true),
      value: fmtValue(r.value, metric, true),
      year: r.year ? `'${String(r.year).slice(2)}` : '',
    },
  }))

  return (
    <MetricTableCard
      metric={metric}
      columns={columns}
      rows={tableRows}
      summaryLabel={totalLabel}
      summaryCells={{
        pct: fmtPct(totalPct, true),
        value: fmtValue(totalValue, metric, true),
        year: '',
      }}
      limitRows={limitRows}
      onRowClick={(row) => {
        if (row.expandable) {
          setExpandedTrade(expandedTrade === row.key ? null : row.key)
          return
        }
        onMetricCountryClick(metric, row.code, row.name)
      }}
      renderRowExtra={(row) => row.expandable && expandedTrade === row.key ? <TradeBreakdownRow row={row} /> : null}
    />
  )
}

function YearControl({ selectedYear, yearMin, yearMax, playing, onYearChange, onPlayToggle, onYearReset }) {
  return (
    <div className="panel-time-control">
      <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={onPlayToggle} aria-label={playing ? 'Pause year animation' : 'Play year animation'}>
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
      <span className="year-display">{selectedYear ?? 'Latest'}</span>
      {selectedYear && <button className="reset-btn" onClick={onYearReset} aria-label="Reset to latest">×</button>}
    </div>
  )
}

// Default view: one metric table ranked across Pacific recipients.
function PacificRankingView({ exposureScores, dataIndex, selectedMetric, onMetricCountryClick, onSelectMetric, yearControl, selectedYear }) {
  const metric = selectedMetric
  const rows = PACIFIC_LIST
    .map(c => {
      const counterparts = Object.values(dataIndex[c.code]?.[metric] ?? {})
      const pct = exposureScores[c.code]?.metricScores?.[metric] ?? null
      const value = metricValueTotal(counterparts)
      const year = metricLatestYear(counterparts)
      return { code: c.code, name: c.name, pct, value, year }
    })
    .filter(r => r.pct != null)
    .sort((a, b) => b.pct - a.pct)
  const total = aggregatePacificMetric(dataIndex, metric)

  return (
    <>
      <div className="sections">
        <InterpretationNote metric={metric} mode="default" />
        <SelectionPills countries={[{ code: 'ALL_PACIFIC', name: 'All Pacific countries' }]} />
        <MetricTable
          metric={metric}
          rows={rows}
          totalPct={total.pct}
          totalValue={total.value}
          totalYear={selectedYear ?? null}
          totalLabel="Pacific total"
          onMetricCountryClick={onMetricCountryClick}
          isPacific={false}
          limitRows={false}
        />
      </div>
    </>
  )
}

// Single country view (Pacific recipient or one external influencer)
function SingleCountryView({ country, dataIndex, selectedMetric, onMetricCountryClick, onSelectMetric, yearControl, selectedYear, onRemoveCountry }) {
  const { code, isPacific } = country

  function pacificMetricRows(metric) {
    const counterparts = dataIndex[code]?.[metric] ?? {}
    return Object.entries(counterparts)
      .map(([cpCode, d]) => ({
        code: cpCode,
        name: d.name,
        value: d.value,
        pct: d.pct,
        year: d.year,
        hs1Breakdown: d.hs1Breakdown,
      }))
      .filter(r => r.pct != null)
      .sort(sortByPctThenValue)
  }

  function influencerMetricRows(metric) {
    const rows = []
    for (const [pacCode, entry] of Object.entries(dataIndex)) {
      const cp = entry[metric]?.[code]
      if (!cp) continue
      rows.push({ code: pacCode, name: PAC_NAMES[pacCode] ?? pacCode, value: cp.value, pct: cp.pct, year: cp.year })
    }
    return rows
  }
  const baseRows = isPacific ? pacificMetricRows(selectedMetric) : influencerMetricRows(selectedMetric)
  const rows = isPacific ? baseRows : outflowShareRows(baseRows).sort(sortByPctThenValue)
  const totalPct = isPacific ? metricTotal(rows) : (rows.length ? 100 : null)
  const totalValue = metricValueTotal(rows)

return (
    <>
      <div className="sections sections-fixed-head">
        <InterpretationNote metric={selectedMetric} mode={isPacific ? 'pacific' : 'influencer'} countries={[country]} />
        <SelectionPills countries={[country]} onRemoveCountry={onRemoveCountry} />
        <MetricTable
          metric={selectedMetric}
          rows={rows}
          totalPct={totalPct}
          totalValue={totalValue}
          totalYear={selectedYear ?? null}
          totalLabel={isPacific ? 'Total exposure' : 'Pacific total'}
          onMetricCountryClick={onMetricCountryClick}
          isPacific={isPacific}
          pctLabel={isPacific ? undefined : '% of total'}
          limitRows={isPacific}
        />
      </div>
    </>
  )
}

// Multi-select comparison view
function ComparisonView({ countries, dataIndex, selectedMetric, onMetricCountryClick, onSelectMetric, yearControl, onRemoveCountry }) {
  const isPacificComparison = countries.every(c => c.isPacific)
  return (
    <>
      <div className="sections">
        <InterpretationNote metric={selectedMetric} mode={isPacificComparison ? 'pacificComparison' : 'influencerComparison'} countries={countries} />
        <SelectionPills countries={countries} onRemoveCountry={onRemoveCountry} />
        <CompareMetricTable
          metric={selectedMetric}
          countries={countries}
          dataIndex={dataIndex}
          onMetricCountryClick={onMetricCountryClick}
          isPacificComparison={isPacificComparison}
        />
      </div>
    </>
  )
}

function CountryChips({ countries, onRemoveCountry }) {
  return (
    <div className="comparison-chips">
      {countries.map((c, i) => (
        <span key={c.code} className="comparison-chip" style={{ borderColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length], color: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}>
          <span className="comparison-chip-label">{c.name}</span>
          {onRemoveCountry && c.code !== 'ALL_PACIFIC' && (
            <button
              className="comparison-chip-remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveCountry(c.code, c.name)
              }}
              aria-label={`Deselect ${c.name}`}
              title={`Deselect ${c.name}`}
            >
              <X size={11} strokeWidth={2.2} />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function comparisonRowsForPacific(metric, countries, dataIndex) {
  const rowMap = new Map()
  for (const country of countries) {
    const topRows = Object.entries(dataIndex[country.code]?.[metric] ?? {})
      .map(([code, d]) => ({ code, name: d.name, pct: d.pct, value: d.value, year: d.year }))
      .filter(r => r.pct != null)
      .sort(sortByPctThenValue)
      .slice(0, DEFAULT_ROW_LIMIT)

    for (const row of topRows) {
      if (!rowMap.has(row.code)) rowMap.set(row.code, { code: row.code, name: row.name, vals: [] })
    }
  }

  return [...rowMap.values()]
    .map(row => ({
      ...row,
      vals: countries.map(c => {
        const d = dataIndex[c.code]?.[metric]?.[row.code]
        return d ? { pct: d.pct, value: d.value, year: d.year } : null
      }),
    }))
    .sort((a, b) => Math.max(...b.vals.map(v => v?.pct ?? -Infinity)) - Math.max(...a.vals.map(v => v?.pct ?? -Infinity)))
}

function comparisonRowsForExternal(metric, countries, dataIndex) {
  const rowMap = new Map()
  for (const country of countries) {
    const topRows = []
    for (const [pacCode, entry] of Object.entries(dataIndex)) {
      const d = entry[metric]?.[country.code]
      if (d) topRows.push({ code: pacCode, name: PAC_NAMES[pacCode] ?? pacCode, pct: d.pct, value: d.value, year: d.year })
    }
    topRows
      .filter(r => Number.isFinite(r.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, DEFAULT_ROW_LIMIT)
      .forEach(row => {
        if (!rowMap.has(row.code)) rowMap.set(row.code, { code: row.code, name: row.name, vals: [] })
      })
  }

  return [...rowMap.values()]
    .map(row => ({
      ...row,
      vals: countries.map(c => {
        const d = dataIndex[row.code]?.[metric]?.[c.code]
        return d ? { pct: d.pct, value: d.value, year: d.year } : null
      }),
    }))
    .sort((a, b) => Math.max(...b.vals.map(v => v?.value ?? -Infinity)) - Math.max(...a.vals.map(v => v?.value ?? -Infinity)))
}

function CompareMetricTable({ metric, countries, dataIndex, onMetricCountryClick, isPacificComparison }) {
  const rows = isPacificComparison
    ? comparisonRowsForPacific(metric, countries, dataIndex)
    : comparisonRowsForExternal(metric, countries, dataIndex)
  const limitRows = isPacificComparison
  const comparisonKind = isPacificComparison ? 'exposure' : 'value'
  const comparisonUnit = unitLabel(metric, comparisonKind)
  const totalLabel = isPacificComparison ? 'Highest exposure' : 'Largest value'
  const comparisonCellClass = (i) => i < 2 ? 'comparison-val' : 'col-compare comparison-val'
  const columns = countries.map((country, i) => ({
    key: country.code,
    headerTop: country.code,
    headerBottom: comparisonUnit,
    className: comparisonCellClass(i),
    title: comparisonUnit,
  }))
  const cellValue = (v) => {
    if (!v) return '-'
    return isPacificComparison ? fmtPct(v.pct, true) : fmtValue(v.value, metric, true)
  }
  const tableRows = rows.map(row => ({
    ...row,
    key: row.code,
    cells: Object.fromEntries(countries.map((country, i) => [country.code, cellValue(row.vals[i])])),
  }))
  const summaryCells = Object.fromEntries(countries.map((country, i) => {
    const vals = rows.map(row => row.vals[i]).filter(Boolean)
    const maxVal = vals.length
      ? isPacificComparison
        ? Math.max(...vals.map(v => v.pct ?? 0))
        : Math.max(...vals.map(v => v.value ?? 0))
      : null
    return [
      country.code,
      isPacificComparison ? fmtPct(maxVal, true) : fmtValue(maxVal, metric, true),
    ]
  }))

  return (
    <MetricTableCard
      metric={metric}
      columns={columns}
      rows={tableRows}
      summaryLabel={totalLabel}
      summaryCells={summaryCells}
      limitRows={limitRows}
      onRowClick={(row) => onMetricCountryClick(metric, row.code, row.name)}
    />
  )
}

export default function SidePanel({
  selectedCountries, dataIndex, exposureScores, activeMetrics,
  onCountryClick, onSelectMetric,
  onBackToIntro,
  selectedYear, yearMin, yearMax, playing, onYearChange, onPlayToggle, onYearReset,
}) {

  const isComparison = selectedCountries && selectedCountries.length > 1
  const isEmpty = !selectedCountries || selectedCountries.length === 0
  const selectedMetric = activeMetrics[0] ?? 'aid'

  const extraCols = Math.max(0, selectedCountries.length - 2)
  const tablesWidth = isComparison ? 310 + extraCols * 58 : 310

  // --- Mobile bottom-sheet drag/snap ---
  const isMobile = useIsMobile()
  const [snap, setSnap] = useState('half')
  const [dragHeight, setDragHeight] = useState(null)  // px while dragging, else null
  const dragRef = useRef(null)

  const snapPx = key => Math.round(window.innerHeight * SHEET_SNAPS[key])
  const sheetHeight = dragHeight != null ? dragHeight : (isMobile ? snapPx(snap) : null)

  // Raise the sheet to at least half when a country is selected.
  useEffect(() => {
    if (isMobile && !isEmpty && snap === 'peek') setSnap('half')
  }, [isMobile, isEmpty]) // eslint-disable-line react-hooks/exhaustive-deps

  const onHandlePointerDown = e => {
    if (!isMobile) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, startH: snapPx(snap) }
  }
  const onHandlePointerMove = e => {
    if (!dragRef.current) return
    const dy = dragRef.current.startY - e.clientY
    const h = Math.max(snapPx('peek') - 20, Math.min(snapPx('full'), dragRef.current.startH + dy))
    setDragHeight(h)
  }
  const onHandlePointerUp = () => {
    if (!dragRef.current) return
    const h = dragHeight ?? snapPx(snap)
    // snap to nearest of peek/half/full
    const nearest = ['peek', 'half', 'full'].reduce((best, k) =>
      Math.abs(snapPx(k) - h) < Math.abs(snapPx(best) - h) ? k : best, 'half')
    dragRef.current = null
    setDragHeight(null)
    setSnap(nearest)
  }
  const handleMetricCountryClick = (metric, code, name) => {
    onSelectMetric(metric)
    onCountryClick(code, name)
  }
  const handleRemoveCountry = (code, name) => {
    onCountryClick(code, name)
  }
  const yearControl = (
    <YearControl
      selectedYear={selectedYear}
      yearMin={yearMin}
      yearMax={yearMax}
      playing={playing}
      onYearChange={onYearChange}
      onPlayToggle={onPlayToggle}
      onYearReset={onYearReset}
    />
  )

  return (
    <div
      className={`side-panel${isMobile ? ` is-mobile snap-${snap}${dragHeight != null ? ' dragging' : ''}` : ''}`}
      style={isMobile ? { height: sheetHeight } : undefined}
    >
      {isMobile && (
        <div
          className="sheet-handle"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onClick={() => setSnap(snap === 'full' ? 'half' : 'full')}
        >
          <span className="sheet-grabber" />
        </div>
      )}
      {/* Left container: title and tables */}
      <div className="panel-tables" style={{ width: isMobile ? '100%' : tablesWidth }}>
        <div className="panel-titlebar">
          <button className="panel-back-btn" onClick={onBackToIntro} aria-label="Back to landing page">
            <ArrowLeft size={13} strokeWidth={2.2} />
          </button>
          <span className="panel-title">Pacific Links</span>
        </div>

        <div className="panel-content">
          {isEmpty ? (
            <PacificRankingView exposureScores={exposureScores} dataIndex={dataIndex} selectedMetric={selectedMetric} onMetricCountryClick={handleMetricCountryClick} onSelectMetric={onSelectMetric} yearControl={yearControl} selectedYear={selectedYear} />
          ) : isComparison ? (
            <ComparisonView countries={selectedCountries} dataIndex={dataIndex} selectedMetric={selectedMetric} onMetricCountryClick={handleMetricCountryClick} onSelectMetric={onSelectMetric} yearControl={yearControl} onRemoveCountry={handleRemoveCountry} />
          ) : (
            <SingleCountryView country={selectedCountries[0]} dataIndex={dataIndex} selectedMetric={selectedMetric} onMetricCountryClick={handleMetricCountryClick} onSelectMetric={onSelectMetric} yearControl={yearControl} selectedYear={selectedYear} onRemoveCountry={handleRemoveCountry} />
          )}
        </div>
      </div>
    </div>
  )
}
