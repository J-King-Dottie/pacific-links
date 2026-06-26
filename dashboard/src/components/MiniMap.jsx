import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { PACIFIC_LIST } from '../data/pacificCountries.js'

const INFLUENCER_COLORS = [
  [250, 204, 21], [96, 165, 250], [52, 211, 153],
  [251, 113, 133], [167, 139, 250], [251, 146, 60],
]

function scoreToColor(score) {
  const t = Math.min(score / 60, 1)
  const r = Math.round(30 + t * 200)
  const g = Math.round(100 - t * 80)
  const b = Math.round(180 - t * 160)
  return `rgb(${r},${g},${b})`
}

export default function MiniMap({ title, center, zoom, exposureScores, selectedCountries, onCountryClick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const readyRef = useRef(false)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0f2238' } }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      center,
      zoom,
      minZoom: 2,
      maxZoom: 10,
      renderWorldCopies: true,
      attributionControl: false,
    })

    mapRef.current = map

    map.on('load', () => {
      map.addSource('countries', { type: 'geojson', data: '/geo/countries.geojson' })

      map.addLayer({ id: 'country-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#1a3a5c', 'fill-opacity': 0.8 } })

      map.addLayer({ id: 'pacific-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#1e5fa0', 'fill-opacity': 0.9 },
        filter: ['in', 'ISO_A2', ...PACIFIC_LIST.map(c => c.code)] })

      map.addLayer({ id: 'country-outline', type: 'line', source: 'countries',
        paint: { 'line-color': '#2a5278', 'line-width': 0.5 } })

      map.addLayer({ id: 'selected-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#facc15', 'fill-opacity': 0.5 },
        filter: ['in', 'ISO_A2', ''] })

      map.on('click', 'country-fill', e => {
        const f = e.features?.[0]
        if (!f) return
        const code = f.properties.ISO_A2
        const name = f.properties.NAME
        if (code && code !== '-99') onCountryClick(code, name)
      })
      map.on('mouseenter', 'country-fill', e => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (f) setTooltip({ x: e.point.x, y: e.point.y, code: f.properties.ISO_A2, name: f.properties.NAME })
      })
      map.on('mousemove', 'country-fill', e => {
        const f = e.features?.[0]
        if (f) setTooltip({ x: e.point.x, y: e.point.y, code: f.properties.ISO_A2, name: f.properties.NAME })
      })
      map.on('mouseleave', 'country-fill', () => {
        map.getCanvas().style.cursor = ''
        setTooltip(null)
      })

      readyRef.current = true
      updateLayers(map, exposureScores, selectedCountries)
    })

    return () => map.remove()
  }, [])

  function updateLayers(map, scores, countries) {
    if (!map.getLayer('pacific-fill')) return

    const colorExpr = ['match', ['get', 'ISO_A2']]
    for (const pac of PACIFIC_LIST) {
      colorExpr.push(pac.code, scoreToColor(scores[pac.code]?.score ?? 0))
    }
    colorExpr.push('#1a3a5c')
    map.setPaintProperty('pacific-fill', 'fill-color', colorExpr)

    const codes = countries.map(c => c.code)
    if (codes.length === 0) {
      map.setFilter('selected-fill', ['in', 'ISO_A2', ''])
    } else {
      const matchExpr = ['match', ['get', 'ISO_A2']]
      countries.forEach((c, i) => {
        const [r, g, b] = INFLUENCER_COLORS[i % INFLUENCER_COLORS.length]
        matchExpr.push(c.code, `rgb(${r},${g},${b})`)
      })
      matchExpr.push('#facc15')
      map.setFilter('selected-fill', ['in', 'ISO_A2', ...codes])
      map.setPaintProperty('selected-fill', 'fill-color', matchExpr)
    }
  }

  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return
    updateLayers(mapRef.current, exposureScores, selectedCountries)
  }, [exposureScores, selectedCountries])

  const tooltipScore = tooltip?.code ? exposureScores[tooltip.code] : null

  return (
    <div className="mini-map-wrap">
      <div className="mini-map-title">{title}</div>
      <div ref={containerRef} className="mini-map-canvas" />
      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 8, top: tooltip.y - 8 }}>
          <strong>{tooltip.name}</strong>
          {tooltipScore && tooltipScore.score > 0 && (
            <div>Avg exposure: {tooltipScore.score.toFixed(1)}% of GDP</div>
          )}
        </div>
      )}
    </div>
  )
}
