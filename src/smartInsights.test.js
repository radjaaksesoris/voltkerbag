import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareSalesPeriods,
  getPreviousDateRange,
  rankLowStockSellers,
  recommendRestock
} from './chat/smartInsights.js'

test('builds an immediately preceding date range with the same inclusive duration', () => {
  assert.deepEqual(getPreviousDateRange({ from: '2026-03-10', to: '2026-03-12' }), {
    from: '2026-03-07',
    to: '2026-03-09'
  })
  assert.equal(getPreviousDateRange({ from: '2026-03-15', to: '2026-03-10' }), null)
})

test('flags large sales changes only with a nonzero baseline and enough transactions', () => {
  assert.deepEqual(compareSalesPeriods(
    { total: 160_000, transaction_count: 3 },
    { total: 100_000, transaction_count: 4 }
  ), {
    current_sales: 160_000,
    previous_sales: 100_000,
    current_transaction_count: 3,
    previous_transaction_count: 4,
    change_amount: 60_000,
    change_percent: 60,
    significant_change: true,
    sufficient_data: true
  })
  assert.equal(compareSalesPeriods(
    { total: 100_000, transaction_count: 2 },
    { total: 50_000, transaction_count: 4 }
  ).significant_change, false)
  assert.equal(compareSalesPeriods(
    { total: 100_000, transaction_count: 4 },
    { total: 0, transaction_count: 4 }
  ).change_percent, null)
})

test('estimates advisory restock using converted sale units and the stated sample period', () => {
  const result = recommendRestock([
    { id: 1, name: 'Tas A baru', unit: 'pcs', stock_pcs: 3 },
    { name: 'Tas B', unit: 'pcs', stock_pcs: 200 }
  ], Array.from({ length: 3 }, (_, index) => ({
    id: 'txn-' + index,
    createdAt: '2026-03-10T12:00:00',
    items: [{ productId: 1, name: 'Tas A lama', qty: 1, unit: 'lusin' }]
  })), {
    from: '2026-03-01',
    to: '2026-03-10',
    coverageDays: 14
  })

  assert.equal(result.data_sufficient, true)
  assert.equal(result.sample_days, 10)
  assert.deepEqual(result.products, [{
    name: 'Tas A baru',
    stock: '3 pcs',
    sold_stock_units: 36,
    average_daily_stock_units: 3.6,
    estimated_stock_days: 0.8,
    suggested_additional_stock_units: 48,
    suggested_additional: '48 pcs'
  }])
})

test('does not create restock estimates without matching sales history', () => {
  assert.deepEqual(recommendRestock(
    [{ id: 1, name: 'Tas A', unit: 'pcs', stock_pcs: 1 }],
    [],
    { from: '2026-03-01', to: '2026-03-30' }
  ), {
    data_sufficient: false,
    sample_days: 30,
    coverage_days: 14,
    insufficient_product_count: 1,
    products: []
  })
})

test('requires at least three distinct sales transactions per product for a restock estimate', () => {
  const result = recommendRestock(
    [{ name: 'Tas A', unit: 'pcs', stock_pcs: 1 }],
    [{ createdAt: '2026-03-10T12:00:00', items: [{ name: 'Tas A', qty: 1, unit: 'pcs' }] }],
    { from: '2026-03-01', to: '2026-03-30' }
  )
  assert.equal(result.data_sufficient, false)
  assert.deepEqual(result.products, [])
})

test('joins current low stock with period sales and ranks by revenue', () => {
  const result = rankLowStockSellers([
    { id: 1, name: 'Tas A', unit: 'pcs', stock_pcs: 2 },
    { id: 2, name: 'Tas B', unit: 'pcs', stock_pcs: 4 },
    { id: 3, name: 'Tas C', unit: 'pcs', stock_pcs: 20 }
  ], [{
    createdAt: '2026-03-10T12:00:00',
    items: [
      { productId: 1, name: 'Tas A', qty: 1, unit: 'pcs', price: 20_000 },
      { productId: 2, name: 'Tas B', qty: 2, unit: 'pcs', price: 30_000 },
      { productId: 3, name: 'Tas C', qty: 1, unit: 'pcs', price: 50_000 }
    ]
  }], { from: '2026-03-01', to: '2026-03-10' })

  assert.equal(result.low_stock_count, 2)
  assert.deepEqual(result.products.map(({ name }) => name), ['Tas B', 'Tas A'])
  assert.equal(result.products[0].quantity_label, '2 pcs')
})
