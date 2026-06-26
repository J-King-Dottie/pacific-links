# Pacific Economic Exposure Map Dashboard Spec

## Goal

Build a single-screen interactive map dashboard that shows how exposed each Pacific country is to external countries across a small set of bilateral influence metrics.

The dashboard should answer two complementary questions:

- `If I click a Pacific country, who has the most influence/exposure over it?`
- `If I click an external country, where in the Pacific is its influence strongest?`

## Core interaction model

### Default mode

- The map opens centered on the Pacific.
- Latest available data is shown by default.
- The default exposure score is the average of all active metric shares.
- By default, all enabled metrics are included in the average.

### Click behavior

- Clicking a `Pacific country` switches the dashboard into `recipient/host view`.
  - Show which outside countries matter most for that Pacific country.
  - Example for Vanuatu:
    - Australia aid to Vanuatu
    - Vanuatu imports from Australia
    - Australian FDI position in Vanuatu
    - remittances from Australia to Vanuatu
    - Vanuatu-born people living in Australia

- Clicking a `non-Pacific country` switches the dashboard into `source/influencer view`.
  - Show where that country’s influence is strongest across the Pacific.
  - Example for Australia:
    - Australia’s aid footprint across Pacific countries
    - Pacific imports sourced from Australia
    - Australian FDI footprint across Pacific hosts
    - remittance links from Australia into the Pacific
    - Pacific-born populations living in Australia

This is the same bilateral data viewed from the inverse direction. The data model should support both without duplicating separate datasets.

### Time behavior

- Default year = latest available for current metric selection.
- A year slider allows manual scrubbing.
- A play button animates across time.
- Animation updates:
  - map fills / heat
  - ranked country list
  - metric detail panel
  - selected corridor highlights

Because datasets have different year coverage, the dashboard should use the latest common or latest valid year depending on mode:

- `Combined mode`: use the latest year where enough active metrics exist to avoid nonsense.
- `Single-metric mode`: use the latest year available for that metric.

## Main viewport layout

One screen only. No page scroll in the main experience.

### Layout structure

- `Center`: map
- `Top bar`: title, metric toggles, year control, play/pause
- `Left panel`: selected country summary
- `Right panel`: ranked counterpart countries and metric breakdown
- `Bottom strip or footer rail`: legend, data caveat, source status

## Primary views

### 1. Combined exposure view

Purpose:
- show the aggregate external exposure profile

Map behavior:
- Pacific countries shaded by `composite exposure score`
- when a country is selected, show strongest counterpart links

Score logic:
- composite score = average of active bilateral share metrics
- start with equal weighting
- allow later extension to weighted metrics if needed

### 2. Single metric view

Purpose:
- isolate one dimension of influence

Supported metric views:
- `Aid`
- `Trade`
- `FDI`
- `Remittances`
- `Migration`

Optional:
- multi-select combinations such as `Aid + FDI` or `Trade + Migration`

### 3. Corridor view

Purpose:
- show specific bilateral relationships rather than just country-level heat

Behavior:
- once a country is selected, highlight top `N` counterpart corridors
- default top `5` or top `10`
- rest aggregated into `Other`

This avoids visual overload from trying to draw every connection.

## Recommended map behavior

### What the map should emphasize

- Country-level heat first
- Flows second, only on selection

That means:
- do not render global spaghetti arcs by default
- render arcs or curves only after a country click or on hover/focus

### Visual logic

- Base state:
  - choropleth / filled polygons for Pacific countries
- Selected state:
  - highlight chosen country
  - show arcs from selected country to top counterpart countries
  - or from selected external country into affected Pacific countries

This gives you both readability and the “flow map” feel without making the whole map unusable.

## Software stack — decided

### App framework

**Vite + React**

- Not a single HTML file. This project has enough state (selected country, active metrics, current year, view mode) that vanilla JS in one file becomes hard to maintain.
- Vite builds to a static `dist/` folder — no server needed, open `index.html` directly or host anywhere.
- Component separation: map, left panel, right panel, top bar, year slider all as their own components.

Do not use a chart library with a map component (Plotly, ECharts, Highcharts Maps). Reasons:
- Chart libraries assume an Atlantic-centered Mercator projection. The Pacific date-line (180°) breaks them or requires ugly hacks.
- No native arc/flow layer for corridor animation.

### Map layer

**MapLibre GL JS** via `react-map-gl`

- Open-source equivalent of Mapbox GL. Same API, no API key required, free.
- Handles Pacific-centered projection natively via a simple config change.
- Choropleth fills via GeoJSON fill layers.
- Country click interaction via layer event handlers.
- Do not use Leaflet — it is hardcoded to Atlantic-centered Mercator and has no arc layer.

### Flow / arc layer

**deck.gl ArcLayer**

- Renders animated bilateral flow arcs on top of the MapLibre basemap.
- Only activated on country selection — never rendered in default state.
- Top 5 corridors shown; remainder aggregated to "Other".

### Map visual logic — decided

**Default state: choropleth (heat map)**
- Pacific countries filled by composite exposure score.
- No arcs visible. Clean, readable at a glance.

**After clicking a Pacific country: arc flows appear**
- Arcs from selected country to its top counterpart countries.
- Side panel updates to show ranked counterpart breakdown.

**After clicking an external country: inverse arc flows**
- Arcs from selected external country out to Pacific countries it touches.
- Side panel flips to influencer view.

Never render all corridors simultaneously — spaghetti arcs make the map unreadable.

### GeoJSON source for country polygons

Use Natural Earth 1:50m countries GeoJSON. Needs to be reprojected / clipped to Pacific-centered view. Store locally in `public/geo/countries.geojson` — do not fetch from a third-party CDN at runtime.

## Data model the UI should expect

The dashboard should normalize all datasets into a common bilateral shape:

- `pacific_country`
- `counterpart_country`
- `year`
- `metric`
- `value`
- `share_pct`
- `direction`

Suggested direction labels:

- `incoming_to_pacific`
  - aid
  - trade imports
  - inward FDI position
  - remittances received

- `pacific_diaspora_abroad`
  - migration metric

For UI consistency, treat migration as:
- `people from Pacific country living in counterpart country`

That way clicking `Australia` for `Vanuatu` still reads coherently.

## Country panels

### Pacific country selected

Show:

- country name
- composite exposure score
- top counterpart countries
- per-metric mini bars or chips
- sparkline or small trend for selected metric / combined score

Suggested table:

| Counterpart | Composite | Aid | Trade | FDI | Remit | Migration |
|---|---:|---:|---:|---:|---:|---:|

### External country selected

Show:

- country name
- countries in the Pacific where it has strongest footprint
- per-metric map and ranked list

Suggested table:

| Pacific country | Composite | Aid | Trade | FDI | Remit | Migration |
|---|---:|---:|---:|---:|---:|---:|

## Time logic

### Score

The exposure score is a simple average of active metric shares. No weighting. Equal contribution per metric that has data for the selected country-year pair.

### Default state (no year selected)

- Each metric uses its own latest available year independently.
- Average computed from whichever metrics have data — no imputation, no gap filling.
- Applies at both the total map level and after a country click.
- Show a small caveat note: `Using latest available year per metric`.

### Year slider / play mode

- Slider range: 2010–2024.
- When a year is selected or the play animation is running, each frame shows whichever metrics have data for that year.
- Metrics with no data for the current year are excluded from the average and shown as greyed out in the metric toggles — makes it clear they dropped out, not a bug.
- No strict "all metrics must be present" requirement — the average just uses what exists.
- Play button animates across years; ranked panel and arcs update each frame to reflect available data.

## Metric notes for UI

- `Aid`: strongest for donor influence narrative
- `Trade`: use imports from supplier, not total two-way trade
- `FDI`: current dataset is bilateral position / stock, not annual inflow
- `Remittances`: bilateral estimates; good for source composition, weaker as exact totals
- `Migration`: migrant stock abroad by destination, not annual migration flow

## Initial v1 scope

### Must have

- one-screen map dashboard
- country click interaction
- Pacific view and inverse external-country view
- metric toggles
- year slider + play animation
- choropleth base map
- arcs only for selected top corridors
- ranked side panel

### Should have

- search for country
- top `N` corridor control
- tooltip on hover
- data availability note by metric/year

### Can wait

- tourism
- HS product drilldown for trade
- custom metric weighting
- downloadable chart images
- story mode / annotation mode

### Dropped / on hold

- `FDI` — removed from v1. The IMF DIP dataset has zero officially-reported bilateral data for any Pacific country. All values are mirror data (investor countries reporting their own outward positions), which for small Pacific states picks up pass-through capital and special purpose vehicles rather than real investment. The same $2.5B Canada figure appears simultaneously in Vanuatu, Solomon Islands and New Caledonia — clearly an accounting artifact. FDI should be revisited only if a better source with official Pacific-reported bilateral data becomes available.

## Decided stack summary

| Layer | Technology | Notes |
|---|---|---|
| App framework | Vite + React | Static build, no server |
| Basemap + choropleth | MapLibre GL JS via `react-map-gl` | Pacific-centered projection |
| Arc / flow layer | deck.gl ArcLayer | On selection only |
| Country polygons | Natural Earth 1:50m GeoJSON | Stored locally in `public/geo/` |
| Data files | Processed CSVs in `data/processed/` | Aid, imports, remittances, migration, and IDS public debt active. FDI dropped because mirror data is unreliable. |

- Default state: choropleth heat map only.
- Arcs appear only after a country is clicked, for top 5 corridors.
- Both view modes (Pacific recipient / external influencer) use the same bilateral data tables.
- Year slider is strict — selected year applies to all active metrics; missing metrics omitted from average.
- v1 scope: choropleth + arcs + dual-mode panels + year slider + metric toggles.
