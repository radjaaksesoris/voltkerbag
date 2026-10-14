import test from 'node:test'
import assert from 'node:assert/strict'
import { availableQuantity, productPrice, quantityToPcs, saleUnitPrice, saleUnits, stockInPcs, stockLabel, unitCost, unitFactor } from './productUnits.js'

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
  assert.equal(unitCost(product, 'pcs'), 5000)
  assert.equal(unitCost(product, 'lusin'), 60000)
  assert.equal(unitCost(product, 'kodi'), 100000)
})

test('keeps custom product units limited to their own sale unit', () => {
  assert.deepEqual(saleUnits('pak'), ['pak'])
  assert.equal(productPrice({ unit: 'pak', price: 25000 }, 'pak'), 25000)
  assert.equal(saleUnitPrice({ unit: 'pak', price: 25000 }, 'pak'), 25000)
})
