import Papa from 'papaparse'

const DATASET_VERSION = '2026-06-27-fdi'
const YEAR_MIN = 2010
const YEAR_MAX = 2024

function parseCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: r => resolve(r.data),
      error: reject,
    })
  })
}

function num(v) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function validYear(year) {
  return Number.isFinite(year) && year >= YEAR_MIN && year <= YEAR_MAX
}

// All loaders return rows of shape:
// { pacificCode, pacificName, counterpartCode, counterpartName, year, metric, value, pct }
// value = raw USD or people
// pct   = % of GDP (money metrics) or % of population (migration)
// All CSVs now use unified column names: pacific_code, pacific_name,
// counterpart_code, counterpart_name, year, value_usd/value_people, pct_gdp/pct_population

async function loadAid() {
  const rows = await parseCsv(`/data/aid_by_donor_year.csv?v=${DATASET_VERSION}`)
  return rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .map(r => ({
      pacificCode:     r.pacific_code,
      pacificName:     r.pacific_name,
      counterpartCode: r.counterpart_code,
      counterpartName: r.counterpart_name,
      year:            parseInt(r.year),
      metric:          'aid',
      value:           num(r.value_usd),
      pct:             num(r.pct_gdp),
    }))
    .filter(r => r.value > 0 && validYear(r.year))
}

async function loadAidCommitted() {
  const rows = await parseCsv(`/data/aid_committed_by_donor_year.csv?v=${DATASET_VERSION}`)
  return rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .map(r => ({
      pacificCode:     r.pacific_code,
      pacificName:     r.pacific_name,
      counterpartCode: r.counterpart_code,
      counterpartName: r.counterpart_name,
      year:            parseInt(r.year),
      metric:          'aid_committed',
      value:           num(r.value_usd),
      pct:             num(r.pct_gdp),
    }))
    .filter(r => r.value > 0 && validYear(r.year))
}

async function loadTrade() {
  const rows = await parseCsv(`/data/imports_by_supplier_year.csv?v=${DATASET_VERSION}`)
  const grouped = new Map()

  rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .forEach(r => {
      const year = parseInt(r.year)
      const value = num(r.value_usd)
      if (!(value > 0)) return

      const key = [r.pacific_code, r.counterpart_code, year].join('|')
      if (!grouped.has(key)) {
        grouped.set(key, {
          pacificCode:     r.pacific_code,
          pacificName:     r.pacific_name,
          counterpartCode: r.counterpart_code,
          counterpartName: r.counterpart_name,
          year,
          metric:          'trade',
          value:           0,
          pct:             0,
          hs1Breakdown:    [],
        })
      }

      const entry = grouped.get(key)
      entry.value += value
      entry.pct += num(r.pct_gdp) ?? 0

      if (r.hs1_code) {
        entry.hs1Breakdown.push({
          hs1Code: r.hs1_code,
          hs1Name: r.hs1_name || r.hs1_code,
          value,
          pct: num(r.pct_gdp),
        })
      }
    })

  return [...grouped.values()]
    .map(entry => ({
      ...entry,
      value: Math.round(entry.value * 100) / 100,
      pct: entry.pct ? Math.round(entry.pct * 10000) / 10000 : null,
      hs1Breakdown: entry.hs1Breakdown.sort((a, b) => b.value - a.value),
    }))
    .filter(r => validYear(r.year))
}

async function loadExports() {
  const rows = await parseCsv(`/data/exports_by_destination_year.csv?v=${DATASET_VERSION}`)
  const grouped = new Map()

  rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .forEach(r => {
      const year = parseInt(r.year)
      const value = num(r.value_usd)
      if (!(value > 0)) return

      const key = [r.pacific_code, r.counterpart_code, year].join('|')
      if (!grouped.has(key)) {
        grouped.set(key, {
          pacificCode:     r.pacific_code,
          pacificName:     r.pacific_name,
          counterpartCode: r.counterpart_code,
          counterpartName: r.counterpart_name,
          year,
          metric:          'exports',
          value:           0,
          pct:             0,
          hs1Breakdown:    [],
        })
      }

      const entry = grouped.get(key)
      entry.value += value
      entry.pct += num(r.pct_gdp) ?? 0

      if (r.hs1_code) {
        entry.hs1Breakdown.push({
          hs1Code: r.hs1_code,
          hs1Name: r.hs1_name || r.hs1_code,
          value,
          pct: num(r.pct_gdp),
        })
      }
    })

  return [...grouped.values()]
    .map(entry => ({
      ...entry,
      value: Math.round(entry.value * 100) / 100,
      pct: entry.pct ? Math.round(entry.pct * 10000) / 10000 : null,
      hs1Breakdown: entry.hs1Breakdown.sort((a, b) => b.value - a.value),
    }))
    .filter(r => validYear(r.year))
}

async function loadRemittances() {
  const rows = await parseCsv(`/data/remittances_by_source_year.csv?v=${DATASET_VERSION}`)
  return rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .map(r => ({
      pacificCode:     r.pacific_code,
      pacificName:     r.pacific_name,
      counterpartCode: r.counterpart_code,
      counterpartName: r.counterpart_name,
      year:            parseInt(r.year),
      metric:          'remittances',
      value:           num(r.value_usd),
      pct:             num(r.pct_gdp),
    }))
    .filter(r => r.value > 0 && validYear(r.year))
}

async function loadMigration() {
  const rows = await parseCsv(`/data/migrants_abroad_by_destination_year.csv?v=${DATASET_VERSION}`)
  return rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_people)
    .map(r => ({
      pacificCode:     r.pacific_code,
      pacificName:     r.pacific_name,
      counterpartCode: r.counterpart_code,
      counterpartName: r.counterpart_name,
      year:            parseInt(r.year),
      metric:          'migration',
      value:           num(r.value_people),
      pct:             num(r.pct_population),
    }))
    .filter(r => r.value > 0 && validYear(r.year))
}

async function loadFdi() {
  const rows = await parseCsv(`/data/fdi_positions_by_investor_year.csv?v=${DATASET_VERSION}`)
  return rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .map(r => ({
      pacificCode:     r.pacific_code,
      pacificName:     r.pacific_name,
      counterpartCode: r.counterpart_code,
      counterpartName: r.counterpart_name,
      year:            parseInt(r.year),
      metric:          'fdi',
      value:           num(r.value_usd),
      pct:             num(r.pct_gdp),
    }))
    .filter(r => r.value > 0 && validYear(r.year))
}

async function loadDebt() {
  const rows = await parseCsv(`/data/debt_by_creditor_year.csv?v=${DATASET_VERSION}`)
  return rows
    .filter(r => r.pacific_code && r.counterpart_code && r.value_usd)
    .map(r => ({
      pacificCode:     r.pacific_code,
      pacificName:     r.pacific_name,
      counterpartCode: r.counterpart_code,
      counterpartName: r.counterpart_name,
      year:            parseInt(r.year),
      metric:          'debt',
      value:           num(r.value_usd),
      pct:             num(r.pct_gdp),
    }))
    .filter(r => r.value > 0 && validYear(r.year))
}

export async function loadAllData() {
  const [aid, aidCommitted, trade, exports, remittances, fdi, migration, debt] = await Promise.all([
    loadAid(), loadAidCommitted(), loadTrade(), loadExports(), loadRemittances(), loadFdi(), loadMigration(), loadDebt(),
  ])

  const all = [...aid, ...aidCommitted, ...trade, ...exports, ...remittances, ...fdi, ...migration, ...debt]

  const metricYears = {}
  for (const r of all) {
    if (!metricYears[r.metric]) metricYears[r.metric] = { min: r.year, max: r.year }
    metricYears[r.metric].min = Math.min(metricYears[r.metric].min, r.year)
    metricYears[r.metric].max = Math.max(metricYears[r.metric].max, r.year)
  }

  return { rows: all, metricYears }
}
