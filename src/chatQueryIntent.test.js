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
  assert.equal(resolveFastQuery('siapa yang masih punya hutang'), null)
})
