import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { PACIFIC_LIST } from '../data/pacificCountries.js'
import { getTopCounterparts, getInfluencerFootprint } from '../data/computeScores.js'
import { layout as powerbiFlowLayout } from '../utils/powerbiFlowAlgo.ts'
import './MapView.css'

const CENTROIDS = {
  AU: [133.7751, -25.2744], NZ: [172.9, -40.9], CN: [104.19, 35.86],
  US: [-95.71, 37.09], JP: [138.25, 36.20], FR: [2.21, 46.23],
  GB: [-3.44, 55.37], DE: [10.45, 51.16], IN: [78.96, 20.59],
  KR: [127.77, 35.91], SG: [103.82, 1.35], PH: [121.77, 12.88],
  ID: [113.92, -0.79], MY: [109.70, 4.21], TW: [120.96, 23.70],
  HK: [114.17, 22.32], CA: [-96.80, 56.13], BR: [-51.93, -14.24],
  ZA: [25.08, -29.00], AE: [53.85, 23.42], NL: [5.29, 52.13],
  IT: [12.57, 41.87], CH: [8.23, 46.82], BE: [4.47, 50.50],
  DK: [9.50, 56.26], ES: [-3.75, 40.46], FI: [25.75, 61.92],
  IE: [-8.24, 53.41], GR: [21.82, 39.07], PL: [19.15, 51.92],
  LU: [6.13, 49.81], MT: [14.38, 35.94], HR: [15.20, 45.10],
  BG: [25.49, 42.73], CY: [33.43, 35.13], TR: [35.24, 38.96],
  RU: [105.32, 61.52], RS: [21.01, 44.02], SI: [14.99, 46.15],
  KZ: [66.92, 48.02], KW: [47.48, 29.31], PK: [69.35, 30.38],
  LK: [80.77, 7.87], TH: [100.99, 15.87], MU: [57.55, -20.35],
  BM: [-64.75, 32.31], KY: [-80.57, 19.31], VG: [-64.64, 18.42],
  VI: [-64.90, 18.34], CL: [-71.54, -35.68], FJ: [178.07, -17.71],
  PG: [143.96, -6.31], WS: [-172.10, -13.76], TO: [-175.20, -21.13],
  VU: [166.96, -15.38], SB: [160.16, -9.64], KI: [-168.73, 1.87],
  FM: [158.26, 6.92], MH: [171.18, 7.10], PW: [134.58, 7.51],
  NR: [166.93, -0.52], TV: [179.20, -7.11], CK: [-159.78, -21.24],
  NU: [-169.87, -19.05], WF: [-178.12, -13.77], TK: [-171.84, -9.20],
  PF: [-149.41, -17.68], GU: [144.79, 13.44],
  MP: [145.67, 15.18], AS: [-170.13, -14.29],
}

const IDS_COUNTRY_CENTROID_OVERRIDES = {
  IDS_004: 'FR',
  IDS_646: 'IN',
  IDS_751: 'MY',
}

const MULTILATERAL_CREDITOR_SLOTS = [
  [158, 35],
  [167, 39],
  [176, 35],
  [185, 39],
  [194, 35],
]

const MULTILATERAL_GROUP_LABEL = {
  code: '__multilateral_creditors_label',
  name: 'Multilateral creditors',
  pos: [176, 45],
}

function makeOvalPolygon([centerLon, centerLat], radiusLon, radiusLat, steps = 48) {
  return [[
    ...Array.from({ length: steps }, (_, i) => {
      const angle = (Math.PI * 2 * i) / steps
      return [
        centerLon + Math.cos(angle) * radiusLon,
        centerLat + Math.sin(angle) * radiusLat,
      ]
    }),
    [centerLon + radiusLon, centerLat],
  ]]
}

const MULTILATERAL_EEZ_POLYGON = makeOvalPolygon([176, 36.5], 26, 10.5)

const MULTILATERAL_LABEL_OVERRIDES = {
  IDS_905: 'World Bank-\nIDA',
  IDS_901: 'World Bank-\nIBRD',
  IDS_915: 'Asian Dev.\nBank',
  IDS_899: 'Asian Infra\nInv. Bank',
  IDS_919: 'European Inv.\nBank',
  IDS_918: 'European Dev.\nFund',
  IDS_988: 'IFAD',
  IDS_BND: 'Bondholders',
}

// Distinct colors for multi-selected external countries
const INFLUENCER_COLORS = [
  [180, 120, 40],   // ochre
  [42, 107, 114],   // deep teal
  [160, 68, 44],    // terracotta
  [122, 90, 110],   // dusty mauve
  [80, 120, 60],    // olive green
  [160, 100, 50],   // amber brown
]

const PACIFIC_CODES = new Set(PACIFIC_LIST.map(c => c.code))


function scoreToColor(score) {
  const t = Math.min(score / 60, 1)
  // Cool grey-blue (low) → warm amber (high) on light map
  const r = Math.round(160 + t * 80)
  const g = Math.round(140 - t * 60)
  const b = Math.round(110 - t * 70)
  return `rgb(${r},${g},${b})`
}

export default function MapView({ exposureScores, dataIndex, allRows, selectedCountries, activeMetrics, onCountryClick, onMapLoaded, interactive = true }) {
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const deckRef = useRef(null)
  const flowDotsRef = useRef(new Map())
  const artificialNodeSlotsRef = useRef(new Map())
  const [mapReady, setMapReady] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const [flowTooltip, setFlowTooltip] = useState(null)
  const selectedMetric = activeMetrics[0] ?? 'aid'

  const valueSharePct = (value, total) => (
    total > 0 && Number.isFinite(value) ? (value / total) * 100 : null
  )

  const flowEndpointFor = (code) => {
    const countryCode = IDS_COUNTRY_CENTROID_OVERRIDES[code]
    if (countryCode && CENTROIDS[countryCode]) {
      return { pos: CENTROIDS[countryCode], artificial: false }
    }
    if (CENTROIDS[code]) return { pos: CENTROIDS[code], artificial: false }
    const artificialPos = artificialNodeSlotsRef.current.get(code)
    if (selectedMetric === 'debt' && artificialPos) {
      return { pos: artificialPos, artificial: true }
    }
    return null
  }

  function setEndpointTooltip(code, point, fallbackTooltip) {
    const endpoint = flowDotsRef.current.get(code)
    if (endpoint) {
      setTooltip(null)
      setFlowTooltip({ x: point.x, y: point.y, ...endpoint })
    } else {
      setFlowTooltip(null)
      setTooltip(fallbackTooltip)
    }
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const handlers = [map.scrollZoom, map.boxZoom, map.dragRotate, map.dragPan, map.keyboard, map.doubleClickZoom, map.touchZoomRotate]
    handlers.forEach(h => interactive ? h.enable() : h.disable())
    map.getCanvas().style.cursor = interactive ? '' : 'default'
  }, [interactive])

  useEffect(() => {
    // Phones start more zoomed out so the whole Pacific is in frame above the
    // bottom sheet.
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 640
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [150, 3],
      zoom: isMobileViewport ? 1.3 : 2.0,
      minZoom: 1.1,
      maxZoom: 8,
      renderWorldCopies: true,
      attributionControl: { compact: true },
      interactive: false,
    })

    mapRef.current = map

    map.on('load', () => {
      map.addSource('countries', { type: 'geojson', data: '/geo/countries.geojson' })

      map.addLayer({ id: 'country-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#d4c9b0', 'fill-opacity': 0.3 } })

      map.addLayer({ id: 'pacific-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#c8b89a', 'fill-opacity': 0.55 },
        filter: ['in', 'ISO_A2', ...PACIFIC_LIST.map(c => c.code)] })

      map.addLayer({ id: 'country-outline', type: 'line', source: 'countries',
        paint: { 'line-color': '#a09070', 'line-width': 0.5 } })

      // Selected highlight — earthy gold for Pacific, per-country colors for external handled by arcs
      map.addLayer({ id: 'selected-fill', type: 'fill', source: 'countries',
        paint: { 'fill-color': '#b48020', 'fill-opacity': 0.45 },
        filter: ['in', 'ISO_A2', ''] })

      // Territory EEZs — faint outline only, decorative acknowledgement
      const TERRITORY_INFO = {
        AS: { name: 'American Samoa',   sovereign: 'United States' },
        GU: { name: 'Guam',             sovereign: 'United States' },
        MP: { name: 'N. Mariana Islands', sovereign: 'United States' },
        PF: { name: 'French Polynesia', sovereign: 'France' },
        WF: { name: 'Wallis & Futuna',  sovereign: 'France' },
        NC: { name: 'New Caledonia',    sovereign: 'France' },
        TK: { name: 'Tokelau',          sovereign: 'New Zealand' },
      }
      map.addSource('territory-eez', { type: 'geojson', data: '/geo/territory_eez.geojson' })
      // Invisible fill for hover detection
      map.addLayer({ id: 'territory-eez-fill', type: 'fill', source: 'territory-eez',
        paint: { 'fill-opacity': 0 } })
      map.addLayer({ id: 'territory-eez-outline', type: 'line', source: 'territory-eez',
        paint: { 'line-color': '#9a8060', 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.5 } })

      map.on('mousemove', 'territory-eez-fill', e => {
        const iso = e.features?.[0]?.properties?.ISO_A2
        if (!iso) return
        const info = TERRITORY_INFO[iso]
        if (!info) return
        map.getCanvas().style.cursor = 'default'
        setTooltip({
          x: e.point.x, y: e.point.y,
          name: info.name,
          subtitle: `Territory of ${info.sovereign} — not included in analysis`,
        })
      })
      map.on('mouseleave', 'territory-eez-fill', () => {
        map.getCanvas().style.cursor = ''
        setTooltip(null)
      })

      // EEZ polygons for Pacific island nations
      map.addSource('pacific-eez', { type: 'geojson', data: '/geo/pacific_eez.geojson', promoteId: 'ISO_A2' })
      map.addLayer({ id: 'eez-fill', type: 'fill', source: 'pacific-eez',
        paint: {
          'fill-color': '#2a6b72',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.18, 0.06],
        } })
      map.addLayer({ id: 'eez-outline', type: 'line', source: 'pacific-eez',
        paint: {
          'line-color': '#2a6b72',
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1.8, 1.2],
          'line-dasharray': [4, 3],
          'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0.5],
        } })

      let hoveredEEZ = null
      map.on('mousemove', 'eez-fill', e => {
        const f = e.features?.[0]
        const iso = f?.properties?.ISO_A2
        if (!iso) return
        map.getCanvas().style.cursor = 'pointer'
        const entry = PACIFIC_LIST.find(c => c.code === iso)
        setEndpointTooltip(iso, e.point, { x: e.point.x, y: e.point.y, code: iso, name: entry?.name ?? iso })
        if (hoveredEEZ !== iso) {
          if (hoveredEEZ) map.setFeatureState({ source: 'pacific-eez', id: hoveredEEZ }, { hover: false })
          hoveredEEZ = iso
          map.setFeatureState({ source: 'pacific-eez', id: iso }, { hover: true })
        }
      })
      map.on('mouseleave', 'eez-fill', () => {
        map.getCanvas().style.cursor = ''
        setTooltip(null)
        setFlowTooltip(null)
        if (hoveredEEZ) {
          map.setFeatureState({ source: 'pacific-eez', id: hoveredEEZ }, { hover: false })
          hoveredEEZ = null
        }
      })
      map.on('click', 'eez-fill', e => {
        const f = e.features?.[0]
        if (!f) return
        const iso = f.properties.ISO_A2
        const entry = PACIFIC_LIST.find(c => c.code === iso)
        if (entry) onCountryClick(iso, entry.name)
      })

      // Custom labels for Pacific island nations — Positron suppresses these at default zoom
      const PAC_LABEL_POSITIONS = {
        PG: [145.0,  -6.5],
        SB: [160.0,  -8.5],
        VU: [167.5, -16.0],
        FJ: [177.5, -17.5],
        FM: [152.5,   7.0],
        PW: [134.5,   7.5],
        MH: [168.5,   9.0],
        NR: [166.9,  -0.5],
        KI: [205.0,  -3.0],
        TV: [178.5,  -8.0],
        TO: [185.5, -20.0],
        WS: [188.0, -13.5],
        NU: [190.1, -19.0],
        CK: [200.0, -20.0],
      }
      map.addSource('pacific-labels-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: PACIFIC_LIST
            .filter(c => PAC_LABEL_POSITIONS[c.code])
            .map(c => ({
              type: 'Feature',
              properties: { name: c.name },
              geometry: { type: 'Point', coordinates: PAC_LABEL_POSITIONS[c.code] },
            })),
        },
      })
      map.addLayer({ id: 'pacific-labels', type: 'symbol', source: 'pacific-labels-src',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          // Scale with zoom so labels shrink at the zoomed-out (small-screen) view and
          // grow back as the user zooms in.
          'text-size': ['interpolate', ['linear'], ['zoom'], 1.1, 8, 2, 11, 4, 13, 6, 14],
          'text-max-width': 8,
          // Let MapLibre's collision engine place each label: it tries these anchors in
          // order around the point and uses the first that doesn't overlap; if none fit
          // it hides that label rather than stacking it. No hand-tuned positions needed.
          'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
          'text-radial-offset': 0.6,
          'text-justify': 'auto',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#3a2010',
          'text-halo-color': 'rgba(245,239,224,0.9)',
          'text-halo-width': 2,
        },
      })

      map.on('click', 'country-fill', e => {
        const f = e.features?.[0]
        if (!f) return
        const code = f.properties.ISO_A2
        const name = f.properties.NAME
        if (code && code !== '-99' && !PACIFIC_CODES.has(code)) onCountryClick(code, name)
      })

      map.on('mouseenter', 'country-fill', e => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (f) setEndpointTooltip(f.properties.ISO_A2, e.point, { x: e.point.x, y: e.point.y, code: f.properties.ISO_A2, name: f.properties.NAME })
      })
      map.on('mousemove', 'country-fill', e => {
        const f = e.features?.[0]
        if (f) setEndpointTooltip(f.properties.ISO_A2, e.point, { x: e.point.x, y: e.point.y, code: f.properties.ISO_A2, name: f.properties.NAME })
      })
      map.on('mouseleave', 'country-fill', () => {
        map.getCanvas().style.cursor = ''
        setTooltip(null)
        setFlowTooltip(null)
      })

      // Fix country name overrides in Positron's built-in label layers
      // Override Positron country labels: replace Turkey/mojibake with correct Türkiye
      // Match on native 'name' field (Türkiye) which is reliably encoded in the tile
      const fixedNameExpr = ['match', ['get', 'name'],
        'Türkiye', 'Türkiye',
        'Turkey',  'Türkiye',
        ['get', 'name_en'],
      ]
      // Fix Turkey name + suppress Positron's own Pacific labels (we draw our own)
      const pacNamesSet = new Set(PACIFIC_LIST.map(c => c.name))
      for (const layer of ['place_country_1', 'place_country_2']) {
        if (!map.getLayer(layer)) continue
        map.setLayoutProperty(layer, 'text-field', [
          'case',
          ['in', ['get', 'name_en'], ['literal', [...pacNamesSet]]], '',
          ['match', ['get', 'name'], 'Türkiye', 'Türkiye', 'Turkey', 'Türkiye', ['get', 'name_en']],
        ])
      }

      map.addSource('multilateral-creditor-labels-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addSource('multilateral-creditor-eez-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({ id: 'multilateral-creditor-eez-fill', type: 'fill', source: 'multilateral-creditor-eez-src',
        paint: {
          'fill-color': '#2a6b72',
          'fill-opacity': 0.06,
        },
      })
      map.addLayer({ id: 'multilateral-creditor-eez-outline', type: 'line', source: 'multilateral-creditor-eez-src',
        paint: {
          'line-color': '#2a6b72',
          'line-width': 1.2,
          'line-dasharray': [4, 3],
          'line-opacity': 0.5,
        },
      })
      map.addLayer({ id: 'multilateral-creditor-labels', type: 'symbol', source: 'multilateral-creditor-labels-src',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': ['get', 'size'],
          'text-max-width': 10,
          'text-line-height': 0.9,
          'text-anchor': ['get', 'anchor'],
          'text-offset': ['get', 'offset'],
          // Collision-aware like the Pacific labels: don't overlap each other or the
          // island names; hide if there's no room rather than stacking.
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#3a2010',
          'text-halo-color': 'rgba(245,239,224,0.9)',
          'text-halo-width': 2,
        },
      })

      const overlay = new MapboxOverlay({ layers: [] })
      map.addControl(overlay)
      deckRef.current = overlay

      setMapReady(true)
      onMapLoaded?.()
    })

    return () => map.remove()
  }, [])

  // Choropleth
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer('pacific-fill')) return
    const colorExpr = ['match', ['get', 'ISO_A2']]
    for (const pac of PACIFIC_LIST) {
      colorExpr.push(pac.code, scoreToColor(exposureScores[pac.code]?.score ?? 0))
    }
    colorExpr.push('#c8b89a')
    map.setPaintProperty('pacific-fill', 'fill-color', colorExpr)
  }, [mapReady, exposureScores])

  // Selected highlight — each country gets its arc color
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer('selected-fill')) return
    const codes = selectedCountries.map(c => c.code)
    if (codes.length === 0) {
      map.setFilter('selected-fill', ['in', 'ISO_A2', ''])
      return
    }
    const colorExpr = ['match', ['get', 'ISO_A2']]
    selectedCountries.forEach((c, i) => {
      colorExpr.push(c.code, INFLUENCER_COLORS[i % INFLUENCER_COLORS.length].map((v, j) => j < 3 ? `${v}` : null).filter(Boolean).join(','))
    })
    colorExpr.push('#facc15')
    // Build as rgb strings
    const matchExpr = ['match', ['get', 'ISO_A2']]
    selectedCountries.forEach((c, i) => {
      const [r, g, b] = INFLUENCER_COLORS[i % INFLUENCER_COLORS.length]
      matchExpr.push(c.code, `rgb(${r},${g},${b})`)
    })
    matchExpr.push('#facc15')
    map.setFilter('selected-fill', ['in', 'ISO_A2', ...codes])
    map.setPaintProperty('selected-fill', 'fill-color', matchExpr)
  }, [mapReady, selectedCountries])

  // Flow lines — adapted from PowerBI Flowmap's MIT-licensed spiral-tree layout (Verbeek et al. 2011).
  // Destinations sorted furthest-first; greedy join picks the pair whose joint has max radius.
  // One complete smooth path rendered per leaf; trunk emerges from overlapping paths.
  useEffect(() => {
    if (!mapReady || !deckRef.current) return

    const MAX_PX = 14
    const MIN_PX = 0.8
    const SELECTED_MAX_PX = 18
    const SELECTED_MIN_PX = 1.5
    const MIN_FLOW_PCT = 0.1
    const DOT_RADIUS = 5
    const TWO_PI = Math.PI * 2
    const TAN_ALPHA  = Math.tan(Math.PI / 10)
    const TAN_2ALPHA = Math.tan(Math.PI / 5)
    const MAX_T = Math.PI / TAN_ALPHA

    // PowerBI uses [0,2π] theta via acos — critical for the join formula
    function calcTheta(dx, dy, r) {
      if (r === 0) return 0
      const t = Math.acos(Math.max(-1, Math.min(1, dx / r)))
      return dy < 0 ? TWO_PI - t : t
    }

    function normTheta(a) {
      while (a > TWO_PI) a -= TWO_PI
      while (a < 0)     a += TWO_PI
      return a
    }

    function ptDist(a, b) {
      const dx = a.x - b.x, dy = a.y - b.y
      return Math.sqrt(dx * dx + dy * dy)
    }

    // Catmull-Rom spline through 2D waypoints
    function catmullRom(pts, segs = 20) {
      if (pts.length < 2) return pts
      const p = [pts[0], ...pts, pts[pts.length - 1]]
      const out = []
      for (let i = 0; i < p.length - 3; i++) {
        const [p0, p1, p2, p3] = [p[i], p[i+1], p[i+2], p[i+3]]
        for (let j = 0; j <= segs; j++) {
          const t = j / segs, t2 = t*t, t3 = t2*t
          out.push([
            0.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
            0.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
          ])
        }
      }
      return out
    }

    function sampleCubic(p0, p1, p2, p3, steps = 14) {
      const pts = []
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const mt = 1 - t
        pts.push([
          mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
          mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
        ])
      }
      return pts
    }

    function buildPowerBIPaths(origin, flows) {
      const map = mapRef.current
      if (!map || !flows.length) return null
      const originPx = map.project(origin)
      const targets = flows.map((flow, i) => {
        let lon = flow.to[0]
        while (lon - origin[0] >  180) lon -= 360
        while (lon - origin[0] < -180) lon += 360
        const px = map.project([lon, flow.to[1]])
        return { x: px.x - originPx.x, y: px.y - originPx.y, key: i }
      })
      const weights = flows.map(flow => flow.pct)
      const toLngLat = ([x, y]) => {
        const lngLat = map.unproject([originPx.x + x, originPx.y + y])
        return [lngLat.lng, lngLat.lat]
      }
      return powerbiFlowLayout({ x: 0, y: 0 }, targets, weights).paths().map(segment => {
        const points = [[...segment.lineStart], [...segment.lineEnd]]
        if (segment.curveCtl?.length && segment.curveEnd?.length) {
          const offset = segment.offset ?? [0, 0, 0, 0]
          const offx = offset[0] * offset[2] * offset[3]
          const offy = offset[1] * offset[2] * offset[3]
          const p0 = [...segment.lineEnd]
          const p1 = [...segment.lineEnd]
          const p2 = [segment.curveCtl[0] + offx, segment.curveCtl[1] + offy]
          const p3 = [segment.curveEnd[0] + offx, segment.curveEnd[1] + offy]
          points.push(...sampleCubic(p0, p1, p2, p3))
        }
        return { path: points.map(toLngLat), weight: segment.weight }
      }).filter(segment => segment.path.length >= 2 && Number.isFinite(segment.weight))
    }

    // Fallback spiral-tree builder retained for safety; normal routing uses PowerBI's imported layout above.
    function buildLeafPaths(origin, flows) {
      if (!flows.length) return []
      const powerBIPaths = buildPowerBIPaths(origin, flows)
      if (powerBIPaths) return powerBIPaths

      const map = mapRef.current
      const originPx = map?.project(origin)
      function toLocal(to) {
        if (map && originPx) {
          let lon = to[0]
          while (lon - origin[0] >  180) lon -= 360
          while (lon - origin[0] < -180) lon += 360
          const px = map.project([lon, to[1]])
          return [px.x - originPx.x, px.y - originPx.y]
        }
        let lon = to[0]
        while (lon - origin[0] >  180) lon -= 360
        while (lon - origin[0] < -180) lon += 360
        return [lon - origin[0], to[1] - origin[1]]
      }
      function fromLocal(x, y) {
        if (map && originPx) {
          const lngLat = map.unproject([originPx.x + x, originPx.y + y])
          return [lngLat.lng, lngLat.lat]
        }
        return [x + origin[0], y + origin[1]]
      }

      // _IsValid: both tPlus AND tMinus must share the same sign and both be < maxValue
      function isValid(tP, tM, maxV) { return tP * tM > 0 && tP < maxV && tM < maxV }

      let _id = 0
      function makeNode(x, y, r, theta, w, type) {
        return { x, y, radius: r, theta, weight: w, type,
                 parent: null, PChild: null, MChild: null, id: _id++ }
      }

      // Jitter to avoid duplicate angles (matches PowerBI's duplicate-angle check)
      const seen = new Set(['0,0'])
      const JITTER = 1e-7

      const leaves = flows.map(f => {
        let [x, y] = toLocal(f.to)
        let k = `${x.toFixed(9)},${y.toFixed(9)}`
        while (seen.has(k)) {
          x += JITTER * (Math.random() - 0.5)
          y += JITTER * (Math.random() - 0.5)
          k = `${x.toFixed(9)},${y.toFixed(9)}`
        }
        seen.add(k)
        const r = Math.sqrt(x*x + y*y) || 0.001
        return makeNode(x, y, r, calcTheta(x, y, r), f.pct, 'leaf')
      })

      // PowerBI sorts destinations by radius DESCENDING — furthest first
      leaves.sort((a, b) => b.radius - a.radius)

      function tryJoin(right, left) {
        // right = smaller theta, left = larger theta (PowerBI convention)
        if (right.radius === 0 || left.radius === 0)
          return { radius: 0, theta: 0, PChild: right, MChild: left }
        const td = normTheta(left.theta - right.theta) / TAN_ALPHA
        const rd = Math.log(right.radius / left.radius)
        const tP = (td + rd) / 2, tM = (td - rd) / 2
        if (!isValid(tP, tM, MAX_T)) return null
        return {
          radius: right.radius * Math.exp(-tP),
          theta:  normTheta(right.theta + TAN_ALPHA * tP),
          PChild: right, MChild: left,
        }
      }

      // Weighted joint: PowerBI adjusts joint position toward the heavier branch
      function weightedJoin(right, left, minR) {
        if (right.radius === 0 || left.radius === 0)
          return makeNode(0, 0, 0, 0, 0, 'joint')
        const td = normTheta(left.theta - right.theta) / TAN_2ALPHA
        const rd = Math.log(right.radius / left.radius)
        const tP = (td + rd) / 2, tM = (td - rd) / 2
        if (!isValid(tP, tM, Math.PI / TAN_2ALPHA)) return null
        let r = 0, theta = 0
        if (left.type === 'joint' && right.type !== 'joint') {
          r = right.radius * Math.exp(-(td)); theta = left.theta
        } else if (right.type === 'joint' && left.type !== 'joint') {
          r = right.radius * Math.exp(-(td + rd)); theta = right.theta
        } else if (left.weight > right.weight) {
          r = right.radius * Math.exp(-td); theta = left.theta
        } else if (right.weight > left.weight) {
          r = right.radius * Math.exp(-(td + rd)); theta = right.theta
        } else { return null }
        if (r < minR) return null
        const n = makeNode(r * Math.cos(theta), r * Math.sin(theta), r, normTheta(theta),
                           left.weight + right.weight, 'joint')
        n.PChild = right; n.MChild = left
        return n
      }

      function createJoint(polar, MChild, PChild) {
        const w = (MChild?.weight ?? 0) + (PChild?.weight ?? 0)
        const n = makeNode(
          polar.radius * Math.cos(polar.theta),
          polar.radius * Math.sin(polar.theta),
          polar.radius, polar.theta, w, 'joint'
        )
        n.PChild = PChild ?? null
        n.MChild = MChild ?? null
        return n
      }

      function createAux(node, auxR, sign) {
        if (auxR === 0) {
          const root = makeNode(0, 0, 0, 0, node.weight, 'joint')
          root.PChild = node
          return root
        }
        const ti = -Math.log(auxR / node.radius)
        const auxTheta = normTheta(node.theta + Math.tan(sign * Math.PI / 10) * ti)
        // sign>0 (Plus): MChild=node, PChild=null  |  sign<0 (Minus): PChild=node, MChild=null
        return sign > 0
          ? createJoint({ radius: auxR, theta: auxTheta }, node, null)
          : createJoint({ radius: auxR, theta: auxTheta }, null, node)
      }

      // Wave front sorted by theta
      let wave = []
      function waveInsert(n) {
        let i = 0; while (i < wave.length && wave[i].theta < n.theta) i++
        wave.splice(i, 0, n)
      }
      function waveRemove(n) { const i = wave.indexOf(n); if (i >= 0) wave.splice(i, 1) }
      function waveNeighbors(n) {
        if (wave.length <= 1) return null
        const i = wave.indexOf(n), len = wave.length
        return [wave[i === 0 ? len-1 : i-1], wave[i === len-1 ? 0 : i+1]]
      }

      // Pick the adjacent pair whose joint has the MAXIMUM radius (PowerBI's criterion)
      function bestJoinPair(minR) {
        if (wave.length < 2) return null
        let best = null, bestR = -Infinity
        for (let i = 0; i < wave.length; i++) {
          const j = tryJoin(wave[i], wave[(i+1) % wave.length])
          if (j && j.radius > bestR && j.radius >= minR) { bestR = j.radius; best = j }
        }
        return best
      }

      function genJoint(minR) {
        const max = bestJoinPair(minR)
        if (!max) return null
        const jn = createJoint(max, max.MChild, max.PChild)
        const weighted = weightedJoin(jn.PChild, jn.MChild, minR)
        return weighted ?? jn
      }

      const OVERLAP = 0.01
      function processJoint(jn) {
        const p = jn.PChild, m = jn.MChild
        if (p && m && ptDist(p, m) <= OVERLAP * 3) {
          waveRemove(p); waveRemove(m); waveInsert(jn)
        } else if (p && ptDist(jn, p) <= OVERLAP) {
          if (m) { waveRemove(m); waveInsert(createAux(m, p.radius,  1)) }
        } else if (m && ptDist(jn, m) <= OVERLAP) {
          if (p) { waveRemove(p); waveInsert(createAux(p, m.radius, -1)) }
        } else {
          if (p) waveRemove(p)
          if (m) waveRemove(m)
          waveInsert(jn)
        }
      }

      function fixupNeighbors(curr) {
        const nb = waveNeighbors(curr)
        if (!nb) return
        const [right, left] = nb
        if (curr !== left && tryJoin(curr, left) === null) {
          waveRemove(left); waveInsert(createAux(left, curr.radius,  1))
        } else if (curr !== right && tryJoin(right, curr) === null) {
          waveRemove(right); waveInsert(createAux(right, curr.radius, -1))
        }
      }

      // Main build loop — process furthest-first, greedy max-radius join
      let root = null, destIdx = 0, lastJoint = null

      while (destIdx < leaves.length || wave.length > 0) {
        if (destIdx >= leaves.length && lastJoint === null) {
          root = createAux(wave[0], 0, 1)
          waveRemove(wave[0])
          break
        }
        const leaf = leaves[destIdx++]
        waveInsert(leaf)
        fixupNeighbors(leaf)
        const nextR = destIdx < leaves.length ? leaves[destIdx].radius : 0
        lastJoint = genJoint(nextR)
        while (lastJoint) { processJoint(lastJoint); lastJoint = genJoint(nextR) }
      }

      if (!root) return []

      // Set parent pointers via BFS from root (matches PowerBI's post-build visit)
      const queue = [root]
      while (queue.length) {
        const n = queue.shift()
        if (n.PChild) { n.PChild.parent = n; queue.push(n.PChild) }
        if (n.MChild) { n.MChild.parent = n; queue.push(n.MChild) }
      }

      // For each leaf: trace chain [leaf, joint..., root=[0,0]], smooth, convert to lon/lat
      const leafPaths = []
      function visitLeaves(n) {
        if (!n) return
        if (n.type === 'leaf') {
          const chain = []
          let curr = n
          while (curr) { chain.push([curr.x, curr.y]); curr = curr.parent }
          const lonlats = catmullRom(chain).map(([x, y]) => fromLocal(x, y))
          for (let i = 1; i < lonlats.length; i++) {
            while (lonlats[i][0] - lonlats[i-1][0] >  180) lonlats[i][0] -= 360
            while (lonlats[i][0] - lonlats[i-1][0] < -180) lonlats[i][0] += 360
          }
          leafPaths.push({ path: lonlats, weight: n.weight })
        } else {
          visitLeaves(n.PChild)
          visitLeaves(n.MChild)
        }
      }
      visitLeaves(root)
      return leafPaths
    }

    /*
    function bucketedLeafPaths(origin, flows, useDirectionalBuckets) {
      if (!useDirectionalBuckets || flows.length <= 1) {
        return buildLeafPaths(origin, flows)
      }
      const bucketSize = Math.PI / 2
      const buckets = new Map()
      const map = mapRef.current
      const originPx = map?.project(origin)
      for (const flow of flows) {
        let lon = flow.to[0]
        while (lon - origin[0] >  180) lon -= 360
        while (lon - origin[0] < -180) lon += 360
        const angle = map && originPx
          ? (() => {
              const px = map.project([lon, flow.to[1]])
              return normTheta(Math.atan2(px.y - originPx.y, px.x - originPx.x))
            })()
          : normTheta(Math.atan2(flow.to[1] - origin[1], lon - origin[0]))
        const bucket = Math.floor(angle / bucketSize)
        if (!buckets.has(bucket)) buckets.set(bucket, [])
        buckets.get(bucket).push({ ...flow, to: [lon, flow.to[1]] })
      }
      return [...buckets.values()].flatMap(bucketFlows => buildLeafPaths(origin, bucketFlows))
    }
    */

    const paths = []
    const dotMap = new Map() // destCode → {pos, name, entries:[{label,color,byMetric,totalPct}]}
    const filteredMetric = activeMetrics.length === 1 ? activeMetrics[0] : null
    const selectedFlowSets = []
    const flowPct = (byMetric) => {
      const total = activeMetrics.reduce((s, m) => s + Math.min(byMetric[m]?.pct ?? 0, 100), 0)
      return filteredMetric ? total : total / activeMetrics.length
    }

    const artificialTotals = new Map()
    if (selectedMetric === 'debt') {
      for (const country of selectedCountries) {
        if (!country.isPacific) continue
        const tops = getTopCounterparts(dataIndex, country.code, activeMetrics, null)
        for (const t of tops) {
          if (!MULTILATERAL_LABEL_OVERRIDES[t.counterpartCode]) continue
          const widthValue = flowPct(t.byMetric)
          if (!(widthValue >= MIN_FLOW_PCT && widthValue > 0)) continue
          artificialTotals.set(t.counterpartCode, (artificialTotals.get(t.counterpartCode) ?? 0) + widthValue)
        }
      }
    }
    artificialNodeSlotsRef.current = new Map(
      [...artificialTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MULTILATERAL_CREDITOR_SLOTS.length)
        .map(([code], i) => [code, MULTILATERAL_CREDITOR_SLOTS[i]])
    )

    for (let i = 0; i < selectedCountries.length; i++) {
      const country = selectedCountries[i]
      const color   = INFLUENCER_COLORS[i % INFLUENCER_COLORS.length]
      const src     = CENTROIDS[country.code]
      if (!src) continue

      let flows
      if (!country.isPacific) {
        const footprint = getInfluencerFootprint(dataIndex, country.code, activeMetrics)
        const totalValue = footprint.reduce((sum, f) => sum + (f.byMetric[selectedMetric]?.value ?? 0), 0)
        flows = footprint
          .filter(f => flowEndpointFor(f.pacificCode) && f.totalPct > 0)
          .map(f => {
            const metricValue = f.byMetric[selectedMetric]?.value ?? null
            const sharePct = valueSharePct(metricValue, totalValue)
            const endpoint = flowEndpointFor(f.pacificCode)
            return {
              to: endpoint.pos,
              pct: sharePct,
              widthValue: metricValue,
              destCode: f.pacificCode,
              destName: f.pacificName,
              artificialDest: endpoint.artificial,
              byMetric: {
                ...f.byMetric,
                [selectedMetric]: {
                  ...(f.byMetric[selectedMetric] ?? { year: null }),
                  value: metricValue,
                  pct: sharePct,
                },
              },
            }
          })
      } else {
        const tops = getTopCounterparts(dataIndex, country.code, activeMetrics, null)
        flows = tops
          .filter(t => flowEndpointFor(t.counterpartCode) && t.totalPct > 0)
          .map(t => {
            const pct = flowPct(t.byMetric)
            const endpoint = flowEndpointFor(t.counterpartCode)
            return {
              to: endpoint.pos,
              pct,
              widthValue: pct,
              destCode: t.counterpartCode,
              destName: t.counterpartName,
              artificialDest: endpoint.artificial,
              byMetric: t.byMetric,
            }
          })
      }
      flows = flows.filter(f => f.pct >= MIN_FLOW_PCT && f.widthValue > 0)
      if (!flows.length) continue
      selectedFlowSets.push({
        color,
        flows,
        leafPaths: buildLeafPaths(src, flows.map(f => ({ ...f, pct: f.widthValue }))),
      })

      for (const f of flows) {
        let lon = f.to[0]
        while (lon - src[0] >  180) lon -= 360
        while (lon - src[0] < -180) lon += 360
        const pos = [lon, f.to[1]]
        if (!dotMap.has(f.destCode)) {
          dotMap.set(f.destCode, { pos, name: f.destName, code: f.destCode, artificial: f.artificialDest, entries: [] })
        }
        dotMap.get(f.destCode).entries.push({
          label: country.name, color, byMetric: f.byMetric, totalPct: f.pct,
        })
      }
    }

    const selectionWidthMax = Math.max(...selectedFlowSets.flatMap(set => set.flows.map(f => f.widthValue)), 0)

    for (const set of selectedFlowSets) {
      for (const lp of set.leafPaths) {
        const w = selectionWidthMax > 0
          ? SELECTED_MIN_PX + Math.sqrt(Math.min(lp.weight, selectionWidthMax) / selectionWidthMax) * (SELECTED_MAX_PX - SELECTED_MIN_PX)
          : MIN_PX
        paths.push({ path: lp.path, width: w, color: set.color })
      }
    }

    const dots = [...dotMap.values()]
    // Pick the color of the first (largest) entry for each dot
    dots.forEach(d => {
      d.color = d.entries[0].color
      d.displayName = MULTILATERAL_LABEL_OVERRIDES[d.code] ?? d.name
    })
    flowDotsRef.current = new Map(dots.map(d => [d.code, d]))

    paths.sort((a, b) => b.width - a.width)

    const layers = []
    if (paths.length) {
      layers.push(new PathLayer({
        id: 'flows',
        data: paths,
        getPath: d => d.path,
        getWidth: d => d.width,
        getColor: d => [...d.color, 255],
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        pickable: false,
      }))
    }
    if (dots.length) {
      layers.push(new ScatterplotLayer({
        id: 'flow-dots',
        data: dots,
        getPosition: d => d.pos,
        getRadius: DOT_RADIUS,
        getFillColor: d => [...d.color, 255],
        radiusUnits: 'pixels',
        pickable: true,
        onHover: ({ object, x, y }) => {
          setFlowTooltip(object ? { x, y, ...object } : null)
        },
      }))
    }
    const artificialDots = dots.filter(d => d.artificial)
    mapRef.current?.getSource('multilateral-creditor-eez-src')?.setData({
      type: 'FeatureCollection',
      features: artificialDots.length
        ? [{
            type: 'Feature',
            properties: { name: MULTILATERAL_GROUP_LABEL.name },
            geometry: { type: 'Polygon', coordinates: MULTILATERAL_EEZ_POLYGON },
          }]
        : [],
    })
    mapRef.current?.getSource('multilateral-creditor-labels-src')?.setData({
      type: 'FeatureCollection',
      features: artificialDots.length
        ? [
            {
              type: 'Feature',
              properties: { name: MULTILATERAL_GROUP_LABEL.name, size: 12, anchor: 'center', offset: [0, 0] },
              geometry: { type: 'Point', coordinates: MULTILATERAL_GROUP_LABEL.pos },
            },
            ...artificialDots.map(d => ({
              type: 'Feature',
              properties: { name: d.displayName, size: 12, anchor: 'bottom', offset: [0, -0.75] },
              geometry: { type: 'Point', coordinates: d.pos },
            })),
          ]
        : [],
    })

    deckRef.current.setProps({ layers })
  }, [mapReady, selectedCountries, dataIndex, allRows, activeMetrics])

  const tooltipScore = tooltip?.code ? exposureScores[tooltip.code] : null
  const tooltipIsPacific = tooltip?.code ? PACIFIC_CODES.has(tooltip.code) : false
  const tooltipMetricEntry = tooltip?.code ? dataIndex[tooltip.code]?.[selectedMetric] ?? {} : {}
  const tooltipMetricRows = Object.values(tooltipMetricEntry)
  const tooltipMetricTotalValue = tooltipMetricRows.reduce((sum, row) => sum + (Number.isFinite(row.value) ? row.value : 0), 0)
  const tooltipMetricLatestYear = tooltipMetricRows.reduce((latest, row) => Number.isFinite(row.year) ? Math.max(latest, row.year) : latest, 0) || null
  const tooltipPctHeader = selectedMetric === 'migration'
    ? (tooltipIsPacific ? '% of pop' : '% of total')
    : (tooltipIsPacific ? '% of GDP' : '% of total')
  const tooltipValueHeader = selectedMetric === 'migration' ? 'people' : '$USD'
  const METRIC_LABELS = { aid: 'Aid', aid_committed: 'Aid committed', trade: 'Imports', exports: 'Exports', remittances: 'Remittances', fdi: 'FDI', migration: 'Migration', debt: 'Debt' }
  const tooltipMetricLabel = METRIC_LABELS[selectedMetric]
  const tooltipPctValue = tooltipIsPacific
    ? tooltipScore?.metricScores?.[selectedMetric] ?? null
    : (tooltipMetricTotalValue > 0 ? 100 : null)

  return (
    <div className="mapview">
      <div ref={mapContainer} className="map-container" style={interactive ? undefined : { pointerEvents: 'none' }} />
      {tooltip && !flowTooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <strong>{tooltip.name}</strong>
          {tooltip.subtitle
            ? <div style={{ fontStyle: 'italic', color: '#9a8060', marginTop: 2 }}>{tooltip.subtitle}</div>
            : tooltipScore && (
              <table style={{ marginTop: 4, borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingRight: 8, color: '#6b5230', fontSize: '0.68rem', fontWeight: 600 }}>{'Metric'}</th>
                    <th style={{ textAlign: 'right', paddingRight: 8, color: '#6b5230', fontSize: '0.68rem', fontWeight: 600 }}>{tooltipPctHeader}</th>
                    <th style={{ textAlign: 'right', paddingRight: 8, color: '#6b5230', fontSize: '0.68rem', fontWeight: 600 }}>{tooltipValueHeader}</th>
                    <th style={{ textAlign: 'right', color: '#6b5230', fontSize: '0.68rem', fontWeight: 600 }}>{'yr'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ paddingRight: 8, color: '#6b5230', fontSize: '0.78rem' }}>{tooltipMetricLabel}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', paddingRight: 8 }}>
                      {tooltipPctValue != null ? tooltipPctValue.toFixed(1) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem', paddingRight: 8 }}>
                      {tooltipMetricTotalValue > 0
                        ? (tooltipMetricTotalValue >= 1e9 ? `${(tooltipMetricTotalValue / 1e9).toFixed(1)}B`
                          : tooltipMetricTotalValue >= 1e6 ? `${(tooltipMetricTotalValue / 1e6).toFixed(1)}M`
                          : tooltipMetricTotalValue >= 1e3 ? `${(tooltipMetricTotalValue / 1e3).toFixed(1)}K`
                          : tooltipMetricTotalValue.toFixed(1))
                        : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.78rem' }}>
                      {tooltipMetricLatestYear ?? '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            )
          }
        </div>
      )}
      {flowTooltip && (
        <div className="map-tooltip flow-tooltip" style={{ left: flowTooltip.x + 12, top: flowTooltip.y - 10 }}>
          {flowTooltip.entries.map((e, i) => {
            const fmtVal = (metric, val) => {
              if (val == null) return '-'
              if (val >= 1e9) return `${(val/1e9).toFixed(1)}B`
              if (val >= 1e6) return `${(val/1e6).toFixed(1)}M`
              if (val >= 1e3) return `${(val/1e3).toFixed(1)}K`
              return val.toFixed(1)
            }
            const metricEntry = e.byMetric[selectedMetric] ?? { pct: null, value: null, year: null }
            const isMigration = selectedMetric === 'migration'
            const pctHeader = isMigration ? '% of pop' : '% of GDP'
            const valueHeader = isMigration ? 'people' : '$USD'
            const metricLabel = selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)
            return (
              <div key={i} className="flow-tooltip-entry">
                <div className="flow-tooltip-header">
                  <span style={{ color: `rgb(${e.color.join(',')})` }}>{e.label}</span>
                  <span className="flow-tooltip-arrow">→</span>
                  <span>{flowTooltip.name}</span>
                </div>
                <table className="flow-tooltip-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>{pctHeader}</th>
                      <th>{valueHeader}</th>
                      <th>yr</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="flow-tt-metric">{metricLabel}</td>
                      <td className="flow-tt-pct">{metricEntry.pct != null ? metricEntry.pct.toFixed(1) : '-'}</td>
                      <td className="flow-tt-value">{fmtVal(selectedMetric, metricEntry.value)}</td>
                      <td className="flow-tt-year">{metricEntry.year}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
