import test from 'node:test'
import assert from 'node:assert/strict'
import { fitProductImageDimensions } from './productImage.js'

test('keeps product image dimensions within the maximum edge', () => {
  assert.deepEqual(fitProductImageDimensions(2400, 1600), { width: 1200, height: 800 })
  assert.deepEqual(fitProductImageDimensions(900, 600), { width: 900, height: 600 })
})

test('fits portrait and square product images without changing aspect ratio', () => {
  assert.deepEqual(fitProductImageDimensions(1000, 2000), { width: 600, height: 1200 })
  assert.deepEqual(fitProductImageDimensions(1800, 1800), { width: 1200, height: 1200 })
})

test('rejects invalid image dimensions', () => {
  assert.throws(() => fitProductImageDimensions(0, 400), /Dimensi gambar tidak valid/)
  assert.throws(() => fitProductImageDimensions(400, Number.NaN), /Dimensi gambar tidak valid/)
})
