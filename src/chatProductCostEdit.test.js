import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductCostUpdate } from './chat/productCostEdit.js'

test('corrects HPP per PCS, revalues stock, and recalculates markup-based prices', () => {
  const product = {
    name: 'Aventador',
    unit: 'pcs',
    stock_pcs: 45 * 12,
    stock_cost_value: 45 * 12 * 12_731,
    cost: 12_731,
    price_pcs: 20_000,
    price_lusin: 230_000,
    sale_markup_pcs_pct: 57,
    sale_markup_lusin_pct: 51
  }

  const result = createProductCostUpdate(product, 13_000, 'pcs')

  assert.equal(result.costPerPiece, 13_000)
  assert.equal(result.update.cost, 13_000)
  assert.equal(result.update.stock_cost_value, 45 * 12 * 13_000)
  assert.equal(result.update.stock_pcs, undefined)
  assert.equal(result.update.sale_markup_pcs_pct, undefined)
  assert.equal(result.update.sale_markup_lusin_pct, undefined)
  assert.equal(result.update.price_pcs, 20_410)
  assert.equal(result.update.price_lusin, 235_560)
  assert.deepEqual(result.salePrices, { pcs: 20_410, lusin: 235_560 })
})

test('converts an HPP entered per dozen to the stored per-piece cost', () => {
  const result = createProductCostUpdate({
    name: 'Aventador',
    unit: 'lusin',
    stock: 45,
    cost: 12_000,
    stock_cost_value: 6_480_000
  }, 156_000, 'lusin')

  assert.equal(result.costPerPiece, 13_000)
  assert.equal(result.update.stock_cost_value, 45 * 12 * 13_000)
})

test('uses the product unit for custom-unit products', () => {
  const result = createProductCostUpdate({
    name: 'Kain',
    unit: 'meter',
    stock: 20,
    cost: 8_000
  }, 9_500, 'meter')

  assert.equal(result.costUnit, 'meter')
  assert.equal(result.costPerPiece, 9_500)
  assert.equal(result.update.stock_cost_value, 190_000)
  assert.equal(result.update.price, undefined)
})

test('rejects invalid HPP amounts and units', () => {
  const product = { name: 'Aventador', unit: 'pcs', stock_pcs: 10 }
  assert.throws(() => createProductCostUpdate(product, -1, 'pcs'), /nominal Rupiah/)
  assert.throws(() => createProductCostUpdate(product, 10_000.5, 'pcs'), /nominal Rupiah/)
  assert.throws(() => createProductCostUpdate(product, 10_000, 'lusin-meter'), /Satuan HPP/)
})
