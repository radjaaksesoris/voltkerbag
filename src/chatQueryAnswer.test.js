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

test('reports current customer debt totals and balances', () => {
  const answer = formatQueryAnswer('debts', {
    total_debt: 250_000,
    customers: [{ customer_name: 'Andi', balance_due: 250_000 }]
  })

  assert.match(answer, /Total hutang pelanggan: Rp\s?250\.000/)
  assert.match(answer, /Andi: Rp\s?250\.000/)
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
