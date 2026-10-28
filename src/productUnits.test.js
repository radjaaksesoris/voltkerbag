import test from 'node:test'
import assert from 'node:assert/strict'
import { availableQuantity, isWholeStockQuantity, productPrice, purchaseCostFactor, purchaseCostPerPiece, purchaseCostUnit, quantityToPcs, saleMarkupPercentage, saleMarkupPrice, salePricesFromMarkups, saleUnitPrice, saleUnits, stockCostValue, stockEntryUnit, stockInPcs, stockLabel, stockReceiptValuation, unitCost, unitFactor } from './productUnits.js'

test('uses the standard conversion factors', () => {
  assert.equal(unitFactor('pcs'), 1)
  assert.equal(unitFactor('lusin'), 12)
  assert.equal(unitFactor('kodi'), 20)
})

test('allows only pcs and lusin for standard and legacy products', () => {
  assert.deepEqual(saleUnits('pcs'), ['pcs', 'lusin'])
  assert.deepEqual(saleUnits('lusin'), ['pcs', 'lusin'])
  const product = { unit: 'kodi', stock_pcs: 40 }
  assert.deepEqual(saleUnits(product.unit), ['pcs', 'lusin'])
  assert.equal(availableQuantity(product, 'pcs'), 40)
  assert.equal(availableQuantity(product, 'lusin'), 3)
})

test('reads legacy stock in the product main unit', () => {
  assert.equal(stockInPcs({ unit: 'kodi', stock: 2 }), 40)
  assert.equal(quantityToPcs(2, 'kodi'), 40)
  assert.equal(quantityToPcs(1.5, 'lusin'), 18)
  assert.equal(stockLabel({ unit: 'kodi', stock_pcs: 19 }), '19 pcs')
  assert.equal(stockLabel({ unit: 'kodi', stock_pcs: 28 }), '28 pcs')
  assert.equal(stockLabel({ unit: 'lusin', stock: 215 / 12 }), '17 lusin 11 pcs')
})

test('enters initial stock in lusin for standard products', () => {
  assert.equal(stockEntryUnit('pcs'), 'lusin')
  assert.equal(stockEntryUnit('lusin'), 'lusin')
  assert.equal(quantityToPcs(5, stockEntryUnit('pcs')), 60)
  assert.equal(quantityToPcs(2.5, stockEntryUnit('lusin')), 30)
  assert.equal(stockEntryUnit('pak'), 'pak')
  assert.equal(quantityToPcs(3, stockEntryUnit('pak')), 3)
})

test('rejects stock quantities that would be rounded to a different piece count', () => {
  assert.equal(isWholeStockQuantity(1.5, 'lusin'), true)
  assert.equal(isWholeStockQuantity(0.1, 'lusin'), false)
  assert.equal(isWholeStockQuantity(2.5, 'pak'), false)
  assert.equal(isWholeStockQuantity(-1, 'pcs'), false)
  assert.equal(isWholeStockQuantity(Number.POSITIVE_INFINITY, 'pcs'), false)
})

test('values standard-unit stock and sale costs using cost per piece', () => {
  const product = { unit: 'kodi', stock_pcs: 68, cost: 40000 }
  assert.equal(purchaseCostUnit(product.unit), 'lusin')
  assert.equal(purchaseCostFactor(product.unit), 12)
  assert.equal(purchaseCostPerPiece(product.unit, 480000), 40000)
  assert.equal(purchaseCostUnit('pcs'), 'lusin')
  assert.equal(purchaseCostUnit('lusin'), 'lusin')
  assert.equal(purchaseCostPerPiece('pcs', 120000), 10000)
  assert.equal(stockCostValue(product), 2720000)
  assert.equal(unitCost(product, 'pcs'), 40000)
  assert.equal(unitCost(product, 'lusin'), 480000)
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

test('calculates prices from cost markup and converts only stock quantities', () => {
  assert.equal(quantityToPcs(1, 'lusin'), 12)
  assert.equal(quantityToPcs(2.5, 'lusin'), 30)
  assert.equal(saleMarkupPrice(30000, 'pcs', 25), 37500)
  assert.equal(saleMarkupPrice(30000, 'lusin', 20), 432000)
  assert.equal(saleMarkupPercentage(140000, 10000, 'lusin'), 17)
  assert.equal(saleMarkupPercentage(37500, 30000, 'pcs'), 25)
  const product = {
    unit: 'pcs',
    price: 50000,
    price_pcs: 50000,
    price_lusin: 360000,
    sale_markup_pcs_pct: 25,
    sale_markup_lusin_pct: 0,
    cost: 30000
  }
  assert.equal(productPrice(product, 'pcs'), 50000)
  assert.equal(productPrice(product, 'lusin'), 360000)
  assert.equal(saleUnitPrice(product, 'pcs'), 50000)
  assert.equal(saleUnitPrice(product, 'lusin'), 360000)
  assert.equal(saleUnitPrice({ ...product, price_lusin: 140000 }, 'lusin'), 140000)
  assert.equal(saleUnitPrice({ ...product, price_pcs: 0, cost: 40000 }, 'pcs'), 50000)
  assert.equal(saleUnitPrice({ ...product, price_lusin: 0, cost: 40000 }, 'lusin'), 480000)
  assert.equal(unitCost(product, 'pcs'), 30000)
  assert.equal(unitCost(product, 'lusin'), 360000)
})

test('recalculates sale prices from existing markups when cost changes', () => {
  assert.deepEqual(salePricesFromMarkups(130000, { pcs: '50', lusin: '' }, 'lusin'), {
    pcs: 16250
  })
  assert.deepEqual(salePricesFromMarkups(150000, { pcs: '50', lusin: '' }, 'lusin'), {
    pcs: 18750
  })
  assert.deepEqual(salePricesFromMarkups(150000, { pcs: '', lusin: '50' }, 'lusin'), {
    lusin: 225000
  })
})

test('keeps custom product units limited to their own sale unit', () => {
  assert.deepEqual(saleUnits('pak'), ['pak'])
  assert.equal(purchaseCostUnit('pak'), 'pak')
  assert.equal(purchaseCostFactor('pak'), 1)
  assert.equal(purchaseCostPerPiece('pak', 5000), 5000)
  assert.equal(productPrice({ unit: 'pak', price: 25000 }, 'pak'), 25000)
  assert.equal(saleUnitPrice({ unit: 'pak', price: 25000 }, 'pak'), 25000)
  assert.equal(stockCostValue({ unit: 'pak', stock: 3, cost: 5000 }), 15000)
})
