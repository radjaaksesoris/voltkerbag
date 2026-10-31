import test from 'node:test'
import assert from 'node:assert/strict'
import { formatQueryAnswer } from './chat/queryAnswer.js'

test('formats stock matches and sale prices without an AI summary request', () => {
  const answer = formatQueryAnswer('stock', {
    total_products: 1,
    matches: [{
      name: 'Tas Aventador',
      stock: '4 lusin',
      sale_prices: { pcs: 125_000, lusin: 1_200_000 }
    }]
  })

  assert.match(answer, /Tas Aventador: 4 lusin/)
  assert.match(answer, /Rp\s?125\.000\/pcs/)
  assert.match(answer, /Rp\s?1\.200\.000\/lusin/)
})

test('labels ranked stock answers and reports stock units', () => {
  const answer = formatQueryAnswer('stock', {
    stock_order: 'asc',
    matches: [{ name: 'Tas A', stock: '2 lusin', sale_prices: {} }]
  })

  assert.match(answer, /Produk dengan stok paling sedikit/)
  assert.match(answer, /berdasarkan jumlah PCS/)
  assert.match(answer, /Tas A: 2 lusin/)
})

test('includes HPP per sale unit for direct cost questions', () => {
  const answer = formatQueryAnswer('stock', {
    include_cost: true,
    matches: [{
      name: 'Aventador',
      stock: '20 lusin',
      hpp: { pcs: 10_000, lusin: 120_000 },
      sale_prices: {}
    }]
  })

  assert.match(answer, /HPP Rp\s?10\.000\/pcs, Rp\s?120\.000\/lusin/)
})

test('reports current customer debt totals and balances', () => {
  const answer = formatQueryAnswer('debts', {
    total_debt: 250_000,
    customers: [{ customer_name: 'Andi', balance_due: 250_000 }]
  })

  assert.match(answer, /Total hutang pelanggan: Rp\s?250\.000/)
  assert.match(answer, /Andi: Rp\s?250\.000/)
})

test('shows only the requested customer debt without the store-wide total', () => {
  const answer = formatQueryAnswer('debts', {
    total_debt: 768_750,
    searched_customer: 'andri',
    customers: [{ customer_name: 'Andri', balance_due: 615_000 }]
  })

  assert.equal(answer, 'Hutang Andri: Rp\u00a0615.000')
  assert.doesNotMatch(answer, /Agus|Total hutang pelanggan/)
})

test('reports when a requested customer has no matching outstanding debt', () => {
  assert.equal(formatQueryAnswer('debts', {
    searched_customer: 'rudi',
    customers: []
  }), 'Hutang pelanggan "rudi" tidak ditemukan atau tidak memiliki hutang berjalan.')
})

test('formats an empty transaction result clearly', () => {
  assert.equal(formatQueryAnswer('transactions', { transactions: [] }), 'Tidak ada transaksi yang cocok.')
})

test('reports sales and finance metrics from query data', () => {
  const answer = formatQueryAnswer('daily_summary', {
    transaction_count: 2,
    sales_total: 500_000,
    gross_profit: 100_000,
    income: 500_000,
    expense: 50_000,
    customer_debt: 75_000
  })

  assert.match(answer, /Transaksi: 2/)
  assert.match(answer, /Total penjualan: Rp\s?500\.000/)
  assert.match(answer, /Laba kotor: Rp\s?100\.000/)
})

test('labels product performance ranking by the requested metric', () => {
  const answer = formatQueryAnswer('product_performance', {
    transaction_count: 3,
    sort_by: 'quantity',
    products: [{
      name: 'Tas A',
      quantity: 8,
      sales: 500_000,
      gross_profit: 100_000
    }]
  })

  assert.match(answer, /Paling banyak terjual/)
  assert.match(answer, /Tas A: terjual 8/)
})

test('formats category and unit catalog queries', () => {
  assert.equal(formatQueryAnswer('categories', { entries: [{ name: 'Tas' }, { name: 'Dompet' }] }), 'Tas\nDompet')
  assert.equal(formatQueryAnswer('units', { entries: [{ name: 'pcs' }] }), 'pcs')
})

test('reports current inventory count, low stock count, and recorded cost value', () => {
  assert.equal(formatQueryAnswer('inventory_summary', {
    product_count: 12,
    low_stock_count: 3,
    total_asset: 1_500_000
  }), 'Jumlah produk: 12\nProduk dengan stok rendah (maksimal 5 satuan utama): 3\nNilai modal seluruh stok: Rp\u00a01.500.000')
})
