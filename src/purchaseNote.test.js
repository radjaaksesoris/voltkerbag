import test from 'node:test'
import assert from 'node:assert/strict'
import { formatPurchaseNote, parsePurchaseNote } from './purchaseNote.js'

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
