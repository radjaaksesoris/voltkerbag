import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceProductCreation,
  productCreationPrompt,
  startProductCreationRequest
} from './chat/productCreation.js'

test('starts a new product flow and asks one question at a time', () => {
  const creation = startProductCreationRequest('Buat stok baru dengan nama AIGNER')

  assert.equal(creation.name, 'AIGNER')
  assert.equal(creation.step, 'photo')
  assert.match(productCreationPrompt(creation), /Silakan unggah foto/)
  assert.doesNotMatch(productCreationPrompt(creation), /harga modal|jumlah stok|harga jual/)
})

test('captures the product name when the initial request omits it', () => {
  const creation = startProductCreationRequest('Tolong buatkan produk baru')
  const result = advanceProductCreation(creation, { text: 'AIGNER' })

  assert.equal(result.creation.name, 'AIGNER')
  assert.equal(result.creation.step, 'photo')
  assert.match(result.prompt, /AIGNER/)
})

test('collects product details sequentially and finishes with a create action', () => {
  let state = startProductCreationRequest('Buat stok baru dengan nama AIGNER')
  let result = advanceProductCreation(state, { text: 'lewati foto' })
  assert.equal(result.creation.step, 'category')
  assert.match(result.prompt, /Kategori/)

  result = advanceProductCreation(result.creation, { text: 'lewati' })
  assert.equal(result.creation.step, 'unit')
  assert.match(result.prompt, /Satuan produk/)

  result = advanceProductCreation(result.creation, { text: 'pcs' })
  assert.equal(result.creation.step, 'quantity')
  assert.match(result.prompt, /jumlah stok awal.*lusin/i)

  result = advanceProductCreation(result.creation, { text: '2 lusin' })
  assert.equal(result.creation.step, 'unit_cost')
  assert.match(result.prompt, /harga modal.*per lusin/i)

  result = advanceProductCreation(result.creation, { text: 'Rp 600.000' })
  assert.equal(result.creation.step, 'sale_price_pcs')
  assert.match(result.prompt, /harga jual.*PCS/i)

  result = advanceProductCreation(result.creation, { text: 'Rp 75.000' })
  assert.equal(result.creation.step, 'sale_price_lusin')
  assert.match(result.prompt, /harga jual.*lusin/i)

  result = advanceProductCreation(result.creation, { text: 'Rp 800.000' })
  assert.equal(result.complete, true)
  assert.deepEqual(result.actionArgs, {
    name: 'AIGNER',
    unit: 'pcs',
    stock_quantity: 2,
    unit_cost: 600_000,
    sale_price_pcs: 75_000,
    sale_price_lusin: 800_000
  })
  assert.equal(result.attachment, null)
})

test('collects a custom-unit selling price and supports Indonesian large-number wording', () => {
  const state = startProductCreationRequest('Buat produk baru dengan nama Kain')
  let result = advanceProductCreation(state, { text: 'lewati foto' })
  result = advanceProductCreation(result.creation, { text: 'lewati' })
  result = advanceProductCreation(result.creation, { text: 'meter' })
  result = advanceProductCreation(result.creation, { text: '10' })
  result = advanceProductCreation(result.creation, { text: '1,5 juta' })
  assert.equal(result.creation.step, 'sale_price')

  result = advanceProductCreation(result.creation, { text: 'Rp 2.000.000' })
  assert.equal(result.complete, true)
  assert.equal(result.actionArgs.unit_cost, 1_500_000)
  assert.equal(result.actionArgs.sale_price, 2_000_000)
})

test('allows an explicit photo skip to advance to the next question', () => {
  const creation = startProductCreationRequest('Buat stok baru nama AIGNER')
  const result = advanceProductCreation(creation, { text: 'lewati foto' })

  assert.equal(result.creation.step, 'category')
  assert.match(result.prompt, /Kategori/)
})

test('stores a product image attached in response to the photo question', () => {
  const creation = startProductCreationRequest('Buat stok baru nama AIGNER')
  const image = { name: 'aigner.jpg', type: 'image/jpeg' }
  const result = advanceProductCreation(creation, { attachment: image, text: 'Foto produk' })

  assert.equal(result.creation.image, image)
  assert.equal(result.creation.step, 'category')
})

test('cancels the guided creation flow', () => {
  assert.deepEqual(
    advanceProductCreation(startProductCreationRequest('Buat stok baru nama AIGNER'), { text: 'batal' }),
    { cancelled: true }
  )
})
