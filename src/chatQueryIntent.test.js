import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFastQuery } from './chat/queryIntent.js'

test('routes simple stock questions directly to the stock query', () => {
  assert.deepEqual(resolveFastQuery('berapa stok tas Aventador?'), {
    kind: 'query',
    query: 'stock',
    args: { product: 'tas aventador' }
  })
})

test('removes remaining-stock wording before searching for the product', () => {
  for (const question of ['berapa sisa stok bimo oval', 'berapa stok yang tersisa Bimo Oval']) {
    assert.deepEqual(resolveFastQuery(question), {
      kind: 'query',
      query: 'stock',
      args: { product: 'bimo oval' }
    })
  }
})

test('routes low and high stock ranking questions without treating wording as product names', () => {
  for (const question of [
    'Sisa stok paling minim',
    'Item apa yang stok nya paling sedikit',
    'Barang apa yang stok nya paling sedikit',
    'produk dengan stok terendah'
  ]) {
    assert.deepEqual(resolveFastQuery(question), {
      kind: 'query',
      query: 'stock',
      args: { stockOrder: 'asc' }
    })
  }

  assert.deepEqual(resolveFastQuery('produk dengan stok paling banyak'), {
    kind: 'query',
    query: 'stock',
    args: { stockOrder: 'desc' }
  })
})

test('routes HPP and modal questions directly to the stock query with costs enabled', () => {
  for (const question of ['berapa harga HPP Aventador', 'modal aventador', 'harga pokok aventador']) {
    assert.deepEqual(resolveFastQuery(question), {
      kind: 'query',
      query: 'stock',
      args: { product: 'aventador', includeCost: true }
    })
  }
})

test('keeps product name words while removing generic stock wording', () => {
  assert.deepEqual(resolveFastQuery('cek stok tas ransel sekarang'), {
    kind: 'query',
    query: 'stock',
    args: { product: 'tas ransel' }
  })
})

test('supports listing all stock without a product name', () => {
  assert.deepEqual(resolveFastQuery('tampilkan stok produk'), {
    kind: 'query',
    query: 'stock',
    args: {}
  })
})

test('does not route stock changes or product performance through a read query', () => {
  assert.equal(resolveFastQuery('tambahkan stok aventador'), null)
  assert.equal(resolveFastQuery('produk apa paling laris dan stoknya'), null)
})

test('leaves other questions for the assistant', () => {
  assert.equal(resolveFastQuery('berapa harga tas aventador'), null)
})

test('routes customer debt questions to the debt query with an optional customer name', () => {
  assert.deepEqual(resolveFastQuery('berapa hutang andri'), {
    kind: 'query',
    query: 'debts',
    args: { customer: 'andri' }
  })
  assert.deepEqual(resolveFastQuery('berapa sisa hutang pelanggan Andri saja'), {
    kind: 'query',
    query: 'debts',
    args: { customer: 'andri' }
  })
  assert.deepEqual(resolveFastQuery('berapa hutang pelanggan'), {
    kind: 'query',
    query: 'debts',
    args: {}
  })
  for (const question of ['total hutang semua pelanggan', 'berapa total hutang seluruh pelanggan']) {
    assert.deepEqual(resolveFastQuery(question), {
      kind: 'query',
      query: 'debts',
      args: {}
    })
  }
  assert.equal(resolveFastQuery('bayar hutang Andri'), null)
})
