import { PACIFIC_LIST } from './pacificCountries.js'

export const METRICS = ['aid', 'trade', 'debt', 'security', 'remittances', 'migration', 'students', 'investment']
const LATEST_WINDOW_YEARS = 3

function buildLatestDataIndex(rows, activeMetrics) {
  const metricMaxYear = {}
  const latestYear = {}

  for (const r of rows) {
    if (!activeMetrics.includes(r.metric)) continue
    if (!metricMaxYear[r.metric] || r.year > metricMaxYear[r.metric]) {
      metricMaxYear[r.metric] = r.year
    }
    const k = `${r.pacificCode}|${r.metric}|${r.counterpartCode}`
    if (!latestYear[k] || r.year > latestYear[k]) latestYear[k] = r.year
  }

  for (const [key, year] of Object.entries(latestYear)) {
    const [, metric] = key.split('|')
    const maxYear = metricMaxYear[metric]
    if (maxYear && year < maxYear - (LATEST_WINDOW_YEARS - 1)) {
      delete latestYear[key]
    }
  }

  return buildIndexForLatestYears(rows, activeMetrics, latestYear)
}

function buildYearDataIndex(rows, activeMetrics, targetYear) {
  const latestYear = {}
  for (const r of rows) {
    if (!activeMetrics.includes(r.metric)) continue
    if (r.year !== targetYear) continue
    const k = `${r.pacificCode}|${r.metric}|${r.counterpartCode}`
    latestYear[k] = targetYear
  }

  return buildIndexForLatestYears(rows, activeMetrics, latestYear)
}

function buildIndexForLatestYears(rows, activeMetrics, latestYear) {
  const index = {}
  for (const r of rows) {
    if (!activeMetrics.includes(r.metric)) continue
    const k = `${r.pacificCode}|${r.metric}|${r.counterpartCode}`
    if (r.year !== latestYear[k]) continue
    if (!index[r.pacificCode]) index[r.pacificCode] = {}
    if (!index[r.pacificCode][r.metric]) index[r.pacificCode][r.metric] = {}
    index[r.pacificCode][r.metric][r.counterpartCode] = {
      name:  r.counterpartName,
      value: r.value,
      pct:   r.pct,
      year:  r.year,
      yearLabel: r.year ? `'${String(r.year).slice(2)}` : '',
      hs1Breakdown: r.hs1Breakdown ?? null,
      securityBreakdown: r.securityBreakdown ?? null,
    }
  }
  return index
}

// ---------------------------------------------------------------------------
// Latest mode: each relationship uses its own latest available observation, but
// only if that observation falls inside the metric's latest three-year window.
// This avoids carrying old one-off relationships forward indefinitely.
// Returns:
//   { pacificCode -> { metric -> { counterpartCode -> { name, value, year } } } }
// ---------------------------------------------------------------------------

export function getLatestData(rows, activeMetrics) {
  return buildLatestDataIndex(rows, activeMetrics)
}

// ---------------------------------------------------------------------------
// Year mode: an explicitly selected year shows that year's records only.
// ---------------------------------------------------------------------------

export function getYearData(rows, activeMetrics, year) {
  return buildYearDataIndex(rows, activeMetrics, year)
}

// ---------------------------------------------------------------------------
// Choropleth heat score per Pacific country.
// For money metrics: sum pct_gdp across all counterparts (total inflows as % of GDP)
// For migration: sum pct_population across all counterparts (total emigrants as % of population)
// Average across active metrics → one exposure score in real % terms.
// ---------------------------------------------------------------------------

export function computeExposureScores(dataIndex, activeMetrics) {
  const scores = {}
  for (const pac of PACIFIC_LIST) {
    const metricPcts = {}
    for (const metric of activeMetrics) {
      const counterparts = dataIndex[pac.code]?.[metric] ?? {}
      const total = Object.values(counterparts).reduce((s, c) => s + (c.pct ?? 0), 0)
      if (total > 0) metricPcts[metric] = total
    }
    const vals = Object.values(metricPcts)
    scores[pac.code] = {
      score:        vals.length ? vals.reduce((a, b) => a + b, 0) / activeMetrics.length : 0,
      metricCount:  vals.length,
      metricScores: metricPcts,
    }
  }
  return scores
}

// ---------------------------------------------------------------------------
// Top N counterparts for a selected Pacific country.
// For each counterpart, show latest value per metric independently.
// Sort by sum of values across active metrics (descending).
// ---------------------------------------------------------------------------

export function getTopCounterparts(dataIndex, pacificCode, activeMetrics, topN = 10) {
  const entry = dataIndex[pacificCode] ?? {}
  const counterpartMap = {}

  for (const metric of activeMetrics) {
    for (const [code, data] of Object.entries(entry[metric] ?? {})) {
      if (!counterpartMap[code]) {
        counterpartMap[code] = { counterpartCode: code, counterpartName: data.name, byMetric: {} }
      }
      counterpartMap[code].byMetric[metric] = {
        value: data.value,
        pct: data.pct,
        year: data.year,
        yearStart: data.yearStart,
        yearEnd: data.yearEnd,
        yearLabel: data.yearLabel,
      }
    }
  }

  return Object.values(counterpartMap)
    .map(c => ({
      ...c,
      totalValue: Object.values(c.byMetric).reduce((s, m) => s + m.value, 0),
      totalPct:   Object.values(c.byMetric).reduce((s, m) => s + (m.pct ?? 0), 0),
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, topN ?? Infinity)
}

// ---------------------------------------------------------------------------
// Influencer footprint: for an external country across the Pacific.
// ---------------------------------------------------------------------------

export function getInfluencerFootprint(dataIndex, counterpartCode, activeMetrics) {
  return PACIFIC_LIST
    .map(pac => {
      const byMetric = {}
      for (const metric of activeMetrics) {
        const cp = dataIndex[pac.code]?.[metric]?.[counterpartCode]
        if (cp) {
          byMetric[metric] = {
            value: cp.value,
            pct: cp.pct,
            year: cp.year,
            yearStart: cp.yearStart,
            yearEnd: cp.yearEnd,
            yearLabel: cp.yearLabel,
          }
        }
      }
      if (Object.keys(byMetric).length === 0) return null
      const totalPct = Object.values(byMetric).reduce((s, m) => s + (m.pct ?? 0), 0)
      return {
        pacificCode: pac.code,
        pacificName: pac.name,
        byMetric,
        totalValue: Object.values(byMetric).reduce((s, m) => s + m.value, 0),
        totalPct,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.totalValue - a.totalValue)
}

// ---------------------------------------------------------------------------
// Arc data for map: top N counterparts of a selected Pacific country
// ---------------------------------------------------------------------------

export function getArcData(dataIndex, pacificCode, activeMetrics, topN = 5) {
  return getTopCounterparts(dataIndex, pacificCode, activeMetrics, topN)
}
