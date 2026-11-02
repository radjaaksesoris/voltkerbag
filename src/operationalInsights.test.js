import test from 'node:test'
import assert from 'node:assert/strict'
import { createOperationalInsights } from './chat/operationalInsights.js'

test('creates a read-only briefing with sales, inventory, and actionable warnings', () => {
  const insights = createOperationalInsights({
    dateRange: { from: '2026-11-02', to: '2026-11-02' },
    summary: {
      transaction_count: 2,
      sales_total: 250000,
      gross_profit: 50000,
      net_profit: 30000,
      cash_balance: 200000,
      customer_debt: 125000,
      pending_expedition_count: 1,
      inventory: { total_asset: 800000 }
    },
    products: [
      { name: 'Tas A', unit: 'pcs', stock_pcs: 3 },
      { name: 'Tas B', unit: 'lusin', stock_pcs: 96 },
      { name: 'Tas C', unit: 'pcs', stock_pcs: 20 }
    ]
  })

  assert.equal(insights.transaction_count, 2)
  assert.equal(insights.sales_total, 250000)
  assert.equal(insights.product_count, 3)
  assert.equal(insights.inventory_asset, 800000)
  assert.deepEqual(insights.low_stock_products, [{ name: 'Tas A', stock: '3 pcs' }])
  assert.equal(insights.low_stock_count, 1)
  assert.equal(insights.recommendations.length, 3)
  assert.match(insights.recommendations[0], /Tas A/)
  assert.match(insights.recommendations[1], /biaya ekspedisi/)
  assert.match(insights.recommendations[2], /hutang pelanggan/)
})

test('reports when no priority warnings or transactions exist', () => {
  const insights = createOperationalInsights({
    dateRange: { from: '2026-11-02', to: '2026-11-02' },
    summary: { transaction_count: 0 },
    products: [{ name: 'Tas Aman', unit: 'pcs', stock_pcs: 20 }]
  })

  assert.deepEqual(insights.recommendations, [
    'Belum ada transaksi pada periode ini; pastikan transaksi toko sudah tercatat.'
  ])
})

test('limits listed low-stock products while retaining their total count', () => {
  const products = Array.from({ length: 7 }, (_, index) => ({
    name: 'Tas ' + index,
    unit: 'pcs',
    stock_pcs: index
  }))
  const insights = createOperationalInsights({
    dateRange: {},
    summary: {},
    products
  })

  assert.equal(insights.low_stock_count, 6)
  assert.equal(insights.low_stock_products.length, 5)
  assert.match(insights.recommendations[0], /dan 1 produk lain/)
})

test('includes exact product-watchlist stocks and flags unknown product names', () => {
  const insights = createOperationalInsights({
    dateRange: {},
    summary: {},
    products: [
      { name: 'Tas A', unit: 'pcs', stock_pcs: 3 },
      { name: 'Tas B', unit: 'pcs', stock_pcs: 8 }
    ],
    watchedProducts: ['tas a', 'Tas B', 'Tas tidak terdaftar']
  })

  assert.deepEqual(insights.watched_products, [
    { name: 'Tas A', stock: '3 pcs', low_stock: true },
    { name: 'Tas B', stock: '8 pcs', low_stock: false },
    { name: 'Tas tidak terdaftar', not_found: true }
  ])
  assert.ok(insights.recommendations.some((recommendation) =>
    /Prioritaskan produk pantauan/.test(recommendation)
  ))
})
