import { useState, useEffect, useCallback } from 'react'
import { Anchor, Globe, Download, ArrowRight } from 'lucide-react'
import { loadAllData } from './data/loadData.js'
import { getLatestData, getYearData, computeExposureScores } from './data/computeScores.js'
import { isPacific } from './data/pacificCountries.js'
import MapView from './components/MapView.jsx'
import SidePanel from './components/SidePanel.jsx'
import TopBar from './components/TopBar.jsx'
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

  const toggleMetric = useCallback((metric) => { setActiveMetrics([metric]) }, [])
  const selectMetric = useCallback((metric) => { setActiveMetrics([metric]) }, [])

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
            <div className="intro-section intro-section-brand">
              <a className="intro-kicker" href="https://dottieaistudio.com.au/" target="_blank" rel="noreferrer">
                <span className="intro-kicker-label">Produced by</span>
                <span>Dottie AI Studio</span>
              </a>
              <h1>Pacific Links</h1>
              <p className="intro-subtitle">Explore the connections shaping the Pacific.</p>
            </div>
            <div className="intro-section intro-section-lead">
              <p className="intro-lead">
                There has been no single place to easily see how Pacific Island Countries are economically and socially connected to the rest of the world - until now.
              </p>
              <p className="intro-lead">
                Pacific Links brings together aid, trade, remittances, migration, and debt data for 14 Pacific Island Countries from 2010 to 2024 (where available).
              </p>
            </div>
            <div className="intro-section intro-section-perspectives">
              <div className="intro-section-label">See the Pacific from both sides</div>
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
            </div>
            <div className="intro-section intro-section-footer">
              <p className="intro-methodology">
                All of this data already exists but it's spread across different sources - Lowy, CEPII, World Bank, UN, and others - each using different codes, currencies and years. The hard part is cleaning it and pulling it together. That's what we've done.
              </p>
              <p className="intro-methodology">
                We present source data, transformed into an accessible format with a transparent methodology. Gaps exist in Pacific Islands bilateral data and for granular detail on specific countries, official publications remain the authoritative source.
              </p>
              <p className="intro-goal">
                Our goal is to make existing Pacific data more accessible for a region that is often underserved in global analysis.
              </p>
              <div className="intro-cta-row">
                {!appReady && <div className="loading-bar"><span /></div>}
                <div className="intro-cta-buttons">
                  <button className="intro-button" disabled={!appReady} onClick={() => setIntroDismissed(true)}>
                    {appReady ? <>{`Explore the map`}<ArrowRight size={14} strokeWidth={2.5} /></> : loading ? 'Loading data…' : 'Preparing map…'}
                  </button>
                  <a className="intro-download-link" href="/data/pacific_links_data.xlsx" download><Download size={11} strokeWidth={2.5} />Download all data (.xlsx)</a>
                </div>
                <div className="intro-credits">
                  <p className="intro-inspiration">
                    Inspired by the <a href="https://pacificaidmap.lowyinstitute.org" target="_blank" rel="noreferrer">Lowy Pacific Aid Map</a>.
                  </p>
                  {dataMeta?.last_refreshed && <p className="intro-inspiration intro-refreshed">Refreshed {formatRefreshed(dataMeta.last_refreshed)}.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
