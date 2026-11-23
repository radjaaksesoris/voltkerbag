import test from 'node:test'
import assert from 'node:assert/strict'
import { formatInventoryPurchaseNote, formatPurchaseNote, parsePurchaseNote } from './purchaseNote.js'

test('stores purchase and vendor as separate lines', () => {
  assert.equal(formatPurchaseNote('Kain kanvas', 'Toko Bahan'), 'Kain kanvas\nToko Bahan')
  assert.deepEqual(parsePurchaseNote(formatPurchaseNote('Kain kanvas', 'Toko Bahan')), {
    purchase: 'Kain kanvas',
    vendor: 'Toko Bahan'
  })
})

test('supports purchase notes saved before the form was simplified', () => {
  assert.deepEqual(parsePurchaseNote('Bahan: Kain kanvas · Jumlah: 5 meter · Pemasok: Toko Bahan'), {
    purchase: 'Kain kanvas',
    vendor: 'Toko Bahan'
  })
})

test('shows a dash when a purchase has no vendor', () => {
  assert.deepEqual(parsePurchaseNote(formatPurchaseNote('Resleting', '')), {
    purchase: 'Resleting',
    vendor: '-'
  })
})

test('preserves inventory receipt details in a stock purchase note', () => {
  const stockPurchase = {
    productId: 12,
    quantityPcs: 24,
    unitCostPerPiece: 10000,
    unit: 'lusin'
  }

  assert.deepEqual(
    parsePurchaseNote(formatInventoryPurchaseNote('Tas kulit', 'Toko Tas', stockPurchase)),
    {
      purchase: 'Tas kulit',
      vendor: 'Toko Tas',
      stockPurchase
    }
  )
})

test('ignores malformed inventory metadata without losing purchase history', () => {
  const note = formatInventoryPurchaseNote('Tas kulit', 'Toko Tas', {
    productId: 12,
    quantityPcs: 24,
    unitCostPerPiece: 10000,
    unit: 'lusin'
  }).replace('"quantityPcs":24', '"quantityPcs":0')

  assert.deepEqual(parsePurchaseNote(note), {
    purchase: 'Tas kulit',
    vendor: 'Toko Tas'
  })
})
