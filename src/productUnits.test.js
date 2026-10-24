import test from 'node:test'
import assert from 'node:assert/strict'
import { availableQuantity, productPrice, purchaseCostUnit, quantityToPcs, saleUnitPrice, saleUnits, stockCostValue, stockInPcs, stockIssueValuation, stockLabel, stockReceiptValuation, unitCost, unitFactor } from './productUnits.js'

test('uses the standard conversion factors', () => {
  assert.equal(unitFactor('pcs'), 1)
  assert.equal(unitFactor('lusin'), 12)
  assert.equal(unitFactor('kodi'), 20)
})

test('allows each standard sale unit and calculates stock capacity in it', () => {
  const product = { unit: 'kodi', stock_pcs: 40 }
  assert.deepEqual(saleUnits(product.unit), ['pcs', 'lusin', 'kodi'])
  assert.equal(availableQuantity(product, 'pcs'), 40)
  assert.equal(availableQuantity(product, 'lusin'), 3)
  assert.equal(availableQuantity(product, 'kodi'), 2)
})

test('reads legacy stock in the product main unit', () => {
  assert.equal(stockInPcs({ unit: 'kodi', stock: 2 }), 40)
  assert.equal(quantityToPcs(2, 'kodi'), 40)
  assert.equal(quantityToPcs(1.5, 'lusin'), 18)
  assert.equal(stockLabel({ unit: 'kodi', stock_pcs: 19 }), '19 pcs')
  assert.equal(stockLabel({ unit: 'kodi', stock_pcs: 28 }), '1 kodi 8 pcs')
})

test('values standard-unit stock and sale costs using cost per piece', () => {
  const product = { unit: 'kodi', stock_pcs: 68, cost: 40000 }
  assert.equal(purchaseCostUnit(product.unit), 'pcs')
  assert.equal(stockCostValue(product), 2720000)
  assert.equal(unitCost(product, 'pcs'), 40000)
  assert.equal(unitCost(product, 'lusin'), 480000)
  assert.equal(unitCost(product, 'kodi'), 800000)
})

test('keeps the existing stock value when a new production batch has a different cost', () => {
  const receipt = stockReceiptValuation({
    stockPcs: 2000,
    stockValue: 40000000,
    receiptPcs: 1000,
    receiptUnitCost: 25000
  })

  assert.deepEqual(receipt, {
    stockPcs: 3000,
    stockValue: 65000000,
    averageUnitCost: 65000000 / 3000
  })
})

test('reduces stock value proportionally at weighted average cost when goods are sold', () => {
  const issue = stockIssueValuation({
    stockPcs: 3000,
    stockValue: 65000000,
    issuePcs: 1000
  })

  assert.equal(issue.stockPcs, 2000)
  assert.equal(issue.issuedValue, 65000000 / 3)
  assert.equal(issue.stockValue, 65000000 - 65000000 / 3)
})

test('uses stored inventory value instead of recalculating historic stock at the latest average price', () => {
  assert.equal(stockCostValue({
    unit: 'pcs',
    stock_pcs: 2000,
    cost: 25000,
    stock_cost_value: 40000000
  }), 40000000)
  assert.equal(stockCostValue({
    unit: 'pcs',
    stock_pcs: 2000,
    cost: 20000,
    stock_cost_value: null
  }), 40000000)
})

test('applies each sale-tier price per piece and multiplies it by the selected unit size', () => {
  const product = {
    unit: 'kodi',
    price: 900000,
    price_pcs: 50000,
    price_lusin: 47500,
    price_kodi: 45000,
    cost: 100000
  }
  assert.equal(productPrice(product, 'pcs'), 50000)
  assert.equal(productPrice(product, 'lusin'), 47500)
  assert.equal(productPrice(product, 'kodi'), 45000)
  assert.equal(saleUnitPrice(product, 'pcs'), 50000)
  assert.equal(saleUnitPrice(product, 'lusin'), 570000)
  assert.equal(saleUnitPrice(product, 'kodi'), 900000)
  assert.equal(unitCost(product, 'pcs'), 100000)
  assert.equal(unitCost(product, 'lusin'), 1200000)
  assert.equal(unitCost(product, 'kodi'), 2000000)
})

test('keeps custom product units limited to their own sale unit', () => {
  assert.deepEqual(saleUnits('pak'), ['pak'])
  assert.equal(purchaseCostUnit('pak'), 'pak')
  assert.equal(productPrice({ unit: 'pak', price: 25000 }, 'pak'), 25000)
  assert.equal(saleUnitPrice({ unit: 'pak', price: 25000 }, 'pak'), 25000)
  assert.equal(stockCostValue({ unit: 'pak', stock: 3, cost: 5000 }), 15000)
})
