import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceStockAddition,
  advanceProductCreation,
  productCreationPrompt,
  startProductCreationRequest,
  startStockAdditionRequest,
  stockAdditionPrompt
} from './chat/productCreation.js'

test('collects an existing-product stock addition one question at a time', () => {
  const addition = startStockAdditionRequest('Tambahkan stok Aventador')

  assert.equal(addition.product, 'Aventador')
  assert.equal(addition.kind, 'stock_addition')

  const selectedProduct = {
    ...addition,
    unit: 'lusin',
    current: {
      stock: '10 lusin',
      average_cost: 8_000,
      sale_prices: { pcs: 12_000, lusin: 120_000 }
    },
    step: 'quantity'
  }
  assert.match(stockAdditionPrompt(selectedProduct), /jumlah stok.*lusin/i)
  assert.match(stockAdditionPrompt(selectedProduct), /modal rata-rata saat ini: Rp96\.000\/lusin/i)
  assert.match(stockAdditionPrompt(selectedProduct), /PCS Rp12\.000.*lusin Rp120\.000/i)

  let result = advanceStockAddition(selectedProduct, '5')
  assert.equal(result.addition.step, 'unit_cost')
  assert.match(result.prompt, /harga modal batch baru per lusin/i)

  result = advanceStockAddition(result.addition, 'Rp 150.000')
  assert.equal(result.addition.step, 'price_policy')
  assert.match(result.prompt, /Balas "ganti".*"tetap"/i)

  result = advanceStockAddition(result.addition, 'tetap')
  assert.equal(result.complete, true)
  assert.deepEqual(result.actionArgs, {
    product: 'Aventador',
    quantity: 5,
    unit: 'lusin',
    unit_cost: 150_000,
    pricePolicy: 'keep'
  })
})

test('asks new selling prices sequentially when chat stock pricing should be replaced', () => {
  const addition = {
    ...startStockAdditionRequest('Tambah stok Tas Baru'),
    unit: 'lusin',
    current: {
      average_cost: 10_000,
      sale_prices: { pcs: 15_000, lusin: 160_000 }
    },
    step: 'quantity'
  }
  let result = advanceStockAddition(addition, '2')
  result = advanceStockAddition(result.addition, 'Rp 180.000')
  result = advanceStockAddition(result.addition, 'ganti')
  assert.equal(result.addition.step, 'sale_price_pcs')
  assert.match(result.prompt, /PCS sebelumnya Rp15\.000/)

  result = advanceStockAddition(result.addition, 'Rp 18.000')
  assert.equal(result.addition.step, 'sale_price_lusin')
  assert.match(result.prompt, /lusin sebelumnya Rp160\.000/)

  result = advanceStockAddition(result.addition, 'Rp 200.000')
  assert.equal(result.complete, true)
  assert.deepEqual(result.actionArgs, {
    product: 'Tas Baru',
    quantity: 2,
    unit: 'lusin',
    unit_cost: 180_000,
    pricePolicy: 'replace',
    sale_price_pcs: 18_000,
    sale_price_lusin: 200_000
  })
})

test('collects a custom-unit replacement price and can preserve the existing price', () => {
  const addition = {
    ...startStockAdditionRequest('Tambah stok Kain'),
    unit: 'meter',
    current: {
      average_cost: 12_000,
      sale_prices: { meter: 20_000 }
    },
    step: 'quantity'
  }
  let result = advanceStockAddition(addition, '3')
  result = advanceStockAddition(result.addition, 'Rp 15.000')
  result = advanceStockAddition(result.addition, 'ubah')
  assert.equal(result.addition.step, 'sale_price')
  assert.match(result.prompt, /meter sebelumnya Rp20\.000/)

  result = advanceStockAddition(result.addition, 'Rp 25.000')
  assert.deepEqual(result.actionArgs, {
    product: 'Kain',
    quantity: 3,
    unit: 'meter',
    unit_cost: 15_000,
    pricePolicy: 'replace',
    sale_price: 25_000
  })
})

test('asks for an existing product if the stock addition command omits its name', () => {
  const addition = startStockAdditionRequest('Tambah stok')

  assert.equal(addition.product, '')
  assert.equal(addition.step, 'product')
  assert.match(stockAdditionPrompt(addition), /produk mana/i)
  assert.deepEqual(advanceStockAddition(addition, 'Aventador'), {
    addition: { ...addition, product: 'Aventador' },
    resolveProduct: true
  })
})

test('extracts product names from common add-stock wording', () => {
  assert.equal(startStockAdditionRequest('Tambah stok untuk produk Aventador').product, 'Aventador')
  assert.equal(startStockAdditionRequest('Menambahkan stok produk Aventador').product, 'Aventador')
})

test('does not mistake a new product stock request for an existing-product stock addition', () => {
  assert.equal(startStockAdditionRequest('Tambahkan stok baru nama AIGNER'), null)
})

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
