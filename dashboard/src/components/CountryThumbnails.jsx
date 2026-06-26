import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { geoMercator, geoPath } from 'd3-geo'
import { PACIFIC_COUNTRIES, PACIFIC_LIST } from '../data/pacificCountries.js'

const INFLUENCER_COLORS = [
  [180, 120, 40],  // ochre
  [42, 107, 114],  // deep teal
  [160, 68, 44],   // terracotta
  [122, 90, 110],  // dusty mauve
  [80, 120, 60],   // olive green
  [160, 100, 50],  // amber brown
]

function scoreToFill(score) {
  const t = Math.min(score / 60, 1)
  // Cool grey-blue (low) → warm amber (high), earthy palette
  const r = Math.round(160 + t * 80)
  const g = Math.round(140 - t * 60)
  const b = Math.round(110 - t * 70)
  return `rgb(${r},${g},${b})`
}

const SIZE = 64

function CountryShape({ feature, score, selected, selectedIdx, onClick, name }) {
  const path = useCallback(() => {
    if (!feature) return ''
    const proj = geoMercator().fitSize([SIZE, SIZE], feature)
    return geoPath(proj)(feature) ?? ''
  }, [feature])

  const fill = selected
    ? `rgb(${INFLUENCER_COLORS[selectedIdx % INFLUENCER_COLORS.length].join(',')})`
    : scoreToFill(score)

  return (
    <button className={`country-thumb ${selected ? 'selected' : ''}`} onClick={onClick} title={name}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <path d={path()} fill={fill} stroke="#2a5278" strokeWidth={0.8} />
      </svg>
      <span className="country-thumb-name">{name}</span>
    </button>
  )
}

export default function CountryThumbnails({ exposureScores, selectedCountries, onCountryClick, open, onToggle }) {
  const [featureMap, setFeatureMap] = useState({})

  useEffect(() => {
    fetch('/geo/countries.geojson')
      .then(r => r.json())
      .then(geojson => {
        const map = {}
        const codes = new Set(PACIFIC_LIST.map(c => c.code))
        for (const f of geojson.features) {
          const code = f.properties.ISO_A2
          if (codes.has(code)) map[code] = f
        }
        setFeatureMap(map)
      })
  }, [])

  const subregions = [
    { label: 'Melanesia', countries: PACIFIC_COUNTRIES.melanesia },
    { label: 'Micronesia', countries: PACIFIC_COUNTRIES.micronesia },
    { label: 'Polynesia', countries: PACIFIC_COUNTRIES.polynesia },
  ]

  return (
    <div className="country-thumbs-section">
      <div className="thumbs-section-header" onClick={onToggle}>
        <span className="thumbs-section-chevron">{open ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}</span>
        <span className="thumbs-section-title">Islands</span>
      </div>
      {open && (
        <div className="country-thumbs-scroll">
          {subregions.map(({ label, countries }) => (
            <div key={label} className="thumb-region">
              <div className="thumb-region-label">{label}</div>
              <div className="thumb-grid">
                {countries.map(c => {
                  const selIdx = selectedCountries.findIndex(s => s.code === c.code)
                  return (
                    <CountryShape
                      key={c.code}
                      feature={featureMap[c.code]}
                      score={exposureScores[c.code]?.score ?? 0}
                      selected={selIdx !== -1}
                      selectedIdx={selIdx}
                      name={c.name}
                      onClick={() => onCountryClick(c.code, c.name)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
