import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let TradeComparisonBreakdownRow

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  ;({ TradeComparisonBreakdownRow } = await server.ssrLoadModule('/src/components/SidePanel.jsx'))
})

after(async () => {
  await server?.close()
})

const columns = [
  { key: 'FJ', className: 'comparison-value', title: '$ USD' },
  { key: 'TO', className: 'comparison-value', title: '$ USD' },
]

// These countries deliberately rank the categories differently in dollars and
// percent of GDP, so a percentage-based display or sort cannot pass by chance.
const row = {
  code: 'AU',
  vals: [
    { hs1Breakdown: [
      { hs1Code: '1', hs1Name: 'Food', value: 2500000, pct: 1.2 },
      { hs1Code: '7', hs1Name: 'Machinery', value: 1000000, pct: 0.5 },
    ] },
    { hs1Breakdown: [
      { hs1Code: '1', hs1Name: 'Food', value: 500, pct: 0.1 },
      { hs1Code: '7', hs1Name: 'Machinery', value: 200000, pct: 12.3 },
      { hs1Code: '9', hs1Name: 'Other', value: 0, pct: null },
    ] },
  ],
}

function renderBreakdown(props) {
  return renderToStaticMarkup(createElement(TradeComparisonBreakdownRow, {
    row, columns, ...props,
  }))
}

for (const metric of ['trade', 'exports']) {
  for (const isPacificComparison of [true, false]) {
    test(`${metric}: ${isPacificComparison ? 'Pacific' : 'external'} comparison details use USD and dollar ranking`, () => {
      const html = renderBreakdown({ metric, isPacificComparison })
      const values = [...html.matchAll(/class="comparison-value"[^>]*>([^<]*)<\/span>/g)]
        .map(match => match[1])

      assert.deepEqual(values, ['2.5M', '500.0', '1.0M', '200.0K', '-', '0.0'])
      assert.ok(html.indexOf('title="Food"') < html.indexOf('title="Machinery"'))
      assert.equal(html, renderBreakdown({ metric, isPacificComparison }))
    })
  }
}

test('comparison details omit rows without product breakdowns', () => {
  assert.equal(renderBreakdown({ row: { code: 'AU', vals: [null, {}] }, metric: 'trade' }), '')
})
