import { useState, useEffect, useCallback } from 'react'
import { Anchor, Globe, Download, ArrowRight } from 'lucide-react'
import { loadAllData } from './data/loadData.js'
import { getLatestData, getYearData, computeExposureScores } from './data/computeScores.js'
import { isPacific } from './data/pacificCountries.js'
import MapView from './components/MapView.jsx'
import SidePanel from './components/SidePanel.jsx'
import TopBar from './components/TopBar.jsx'
import CoverageMatrix from './components/CoverageMatrix.jsx'
import './App.css'

const YEAR_MIN = 2010
const YEAR_MAX = 2024

function formatRefreshed(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

export default function App() {
  const [allRows, setAllRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [introDismissed, setIntroDismissed] = useState(false)
  const [error, setError] = useState(null)

  const [activeMetrics, setActiveMetrics] = useState(['aid'])
  const [aidMode, setAidMode] = useState('aid')
  const [tradeMode, setTradeMode] = useState('trade')
  const [securityMode, setSecurityMode] = useState('security')
  const [investmentMode, setInvestmentMode] = useState('fdi')
  const [selectedYear, setSelectedYear] = useState(null)
  const [playing, setPlaying] = useState(false)

  const [selectedCountries, setSelectedCountries] = useState([])
  const [dataMeta, setDataMeta] = useState(null)

  useEffect(() => {
    loadAllData()
      .then(({ rows }) => { setAllRows(rows); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    fetch('/data/data_meta.json')
      .then(r => r.ok ? r.json() : null)
      .then(setDataMeta)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!playing) return
    const interval = setInterval(() => {
      setSelectedYear(y => {
        const next = (y ?? YEAR_MIN) + 1
        if (next > YEAR_MAX) { setPlaying(false); return y }
        return next
      })
    }, 800)
    return () => clearInterval(interval)
  }, [playing])

  const dataIndex = allRows
    ? selectedYear
      ? getYearData(allRows, activeMetrics, selectedYear)
      : getLatestData(allRows, activeMetrics)
    : {}

  const exposureScores = allRows ? computeExposureScores(dataIndex, activeMetrics) : {}

  const handleCountryClick = useCallback((code, name) => {
    const pac = isPacific(code)
    setSelectedCountries(prev => {
      if (pac) {
        const withoutExternal = prev.filter(c => c.isPacific)
        const exists = withoutExternal.find(c => c.code === code)
        return exists
          ? withoutExternal.filter(c => c.code !== code)
          : [...withoutExternal, { code, name, isPacific: true }]
      } else {
        const withoutPacific = prev.filter(c => !c.isPacific)
        const exists = withoutPacific.find(c => c.code === code)
        return exists
          ? withoutPacific.filter(c => c.code !== code)
          : [...withoutPacific, { code, name, isPacific: false }]
      }
    })
  }, [])

  const selectMetric = useCallback((metric) => {
    if (metric === 'aid') setActiveMetrics([aidMode])
    else if (metric === 'trade') setActiveMetrics([tradeMode])
    else if (metric === 'security') setActiveMetrics([securityMode])
    else if (metric === 'investment') setActiveMetrics([investmentMode])
    else setActiveMetrics([metric])
  }, [aidMode, tradeMode, securityMode, investmentMode])
  const toggleMetric = selectMetric
  const handleAidModeChange = useCallback((mode) => {
    setAidMode(mode)
    setActiveMetrics(prev => ['aid', 'aid_committed'].includes(prev[0]) ? [mode] : prev)
  }, [])
  const handleTradeModeChange = useCallback((mode) => {
    setTradeMode(mode)
    setActiveMetrics(prev => ['trade', 'exports'].includes(prev[0]) ? [mode] : prev)
  }, [])
  const handleSecurityModeChange = useCallback((mode) => {
    setSecurityMode(mode)
    setActiveMetrics(prev => ['security', 'security_arms'].includes(prev[0]) ? [mode] : prev)
  }, [])
  const handleInvestmentModeChange = useCallback((mode) => {
    setInvestmentMode(mode)
    setActiveMetrics(prev => ['fdi', 'portfolio'].includes(prev[0]) ? [mode] : prev)
  }, [])

  const handleYearChange = useCallback((year) => { setSelectedYear(year); setPlaying(false) }, [])
  const handlePlayToggle = useCallback(() => {
    if (playing) { setPlaying(false) }
    else { setSelectedYear(prev => (prev === null || prev >= YEAR_MAX) ? YEAR_MIN : prev); setPlaying(true) }
  }, [playing])
  const handleYearReset = useCallback(() => { setSelectedYear(null); setPlaying(false) }, [])

  const appReady = !loading && mapLoaded
  const showIntro = !introDismissed

  if (error) return <div className="error">Error: {error}</div>

  return (
    <div className="app">
      {allRows && (
        <>
          <MapView
            exposureScores={exposureScores}
            dataIndex={dataIndex}
            allRows={allRows}
            selectedCountries={selectedCountries}
            activeMetrics={activeMetrics}
            onCountryClick={handleCountryClick}
            onMapLoaded={() => setMapLoaded(true)}
            interactive={introDismissed}
          />
          {introDismissed && (
            <TopBar
              activeMetrics={activeMetrics}
              onSelectMetric={selectMetric}
              selectedYear={selectedYear}
              yearMin={YEAR_MIN}
              yearMax={YEAR_MAX}
              playing={playing}
              onYearChange={handleYearChange}
              onPlayToggle={handlePlayToggle}
              onYearReset={handleYearReset}
            />
          )}
          {introDismissed && (
            <SidePanel
              selectedCountries={selectedCountries}
              dataIndex={dataIndex}
              exposureScores={exposureScores}
              activeMetrics={activeMetrics}
              onAidModeChange={handleAidModeChange}
              onTradeModeChange={handleTradeModeChange}
              onSecurityModeChange={handleSecurityModeChange}
              onInvestmentModeChange={handleInvestmentModeChange}
              onCountryClick={handleCountryClick}
              onToggleMetric={toggleMetric}
              onSelectMetric={selectMetric}
              onBackToIntro={() => setIntroDismissed(false)}
              selectedYear={selectedYear}
              yearMin={YEAR_MIN}
              yearMax={YEAR_MAX}
              playing={playing}
              onYearChange={handleYearChange}
              onPlayToggle={handlePlayToggle}
              onYearReset={handleYearReset}
            />
          )}
        </>
      )}
      {showIntro && (
        <div className="intro-screen">
          <div className="intro-content">
            <svg className="intro-star" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
              <g fill="none" strokeWidth="3" strokeLinecap="round">
                <path d="M32 32 Q 25 19 33 11" stroke="#1e666d" />
                <path d="M32 32 Q 46 23 53 24" stroke="#8a5c10" />
                <path d="M32 32 Q 47 39 51 49" stroke="#507840" />
                <path d="M32 32 Q 22 43 15 50" stroke="#a0442c" />
                <path d="M32 32 Q 20 28 12 27" stroke="#76516a" />
              </g>
              <circle cx="33" cy="11" r="3.5" fill="#1e666d" />
              <circle cx="53" cy="24" r="3.5" fill="#8a5c10" />
              <circle cx="51" cy="49" r="3.5" fill="#507840" />
              <circle cx="15" cy="50" r="3.5" fill="#a0442c" />
              <circle cx="12" cy="27" r="3.5" fill="#76516a" />
              <circle cx="32" cy="32" r="6" fill="#8a6030" />
            </svg>
            <header className="intro-hero">
              <a className="intro-kicker" href="https://dottieaistudio.com.au/" target="_blank" rel="noreferrer">
                <span className="intro-kicker-label">Produced by</span>
                <span>Dottie AI Studio</span>
              </a>
              <h1>Pacific Links</h1>
              <p className="intro-subtitle">Turning fragmented bilateral datasets into a relationship map.</p>
              <p className="intro-lead">
                Pacific Links brings together aid, trade, debt, security, remittances, migration, students, and investment data for 14 Pacific Island Countries from 2010 to 2024 (where available).
              </p>
            </header>

            <section className="intro-block intro-block-perspectives">
              <h2 className="intro-section-label">See the Pacific from both sides</h2>
              <div className="intro-perspectives">
                <div className="intro-perspective">
                  <div className="intro-perspective-title">
                    <Anchor size={15} className="intro-perspective-icon" />
                    From the islands
                  </div>
                  <p>Click a Pacific country to see how it connects to the world.</p>
                </div>
                <div className="intro-perspective">
                  <div className="intro-perspective-title">
                    <Globe size={15} className="intro-perspective-icon" />
                    From external partners
                  </div>
                  <p>Click an external country to see its footprint across the Pacific.</p>
                </div>
              </div>
            </section>

            <div className="intro-actions">
              <button className="intro-button" disabled={!appReady} onClick={() => setIntroDismissed(true)}>
                {appReady ? <>{`Explore the map`}<ArrowRight size={14} strokeWidth={2.5} /></> : loading ? 'Loading data…' : 'Preparing map…'}
              </button>
              <a className="intro-download-link" href="/data/pacific_links_data.xlsx" download><Download size={12} strokeWidth={2.5} />Download the data</a>
              {!appReady && <div className="loading-bar"><span /></div>}
            </div>

            <section className="intro-block intro-about">
              <p className="intro-methodology">
                This data all already existed. It was just scattered, with each source speaking a slightly different language of codes, units and years.
              </p>
              <p className="intro-methodology">
                The hard part was never finding it, it was cleaning it and bringing it together. That's what we've done, with an open methodology.
              </p>
              <p className="intro-methodology">
                It isn't perfect. Gaps remain in Pacific bilateral data, and the most recent numbers may live in each country's official publications.
              </p>
              <h3 className="intro-chart-title">Data coverage</h3>
              <CoverageMatrix rows={allRows} />
            </section>

            <footer className="intro-creditbar">
              <p className="intro-inspiration intro-goal">
                We built this to make existing Pacific data more accessible.
              </p>
              <p className="intro-inspiration">
                Inspired by the <a href="https://pacificaidmap.lowyinstitute.org" target="_blank" rel="noreferrer">Lowy Pacific Aid Map</a>.
              </p>
              {dataMeta?.last_refreshed && <p className="intro-inspiration intro-refreshed">Refreshed {formatRefreshed(dataMeta.last_refreshed)}.</p>}
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
