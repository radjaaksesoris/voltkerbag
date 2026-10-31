import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDirectQuery, resolveFallbackQuery, resolveFastQuery } from './chat/queryIntent.js'

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

test('does not route stock changes through a read query and recognizes product performance', () => {
  assert.equal(resolveFastQuery('tambahkan stok aventador'), null)
  assert.deepEqual(resolveFastQuery('produk apa paling laris dan stoknya'), {
    kind: 'query',
    query: 'product_performance',
    args: { sortBy: 'quantity' }
  })
})

test('leaves other questions for the assistant', () => {
  assert.deepEqual(resolveFastQuery('berapa harga tas aventador'), {
    kind: 'query',
    query: 'stock',
    args: { product: 'tas aventador' }
  })
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

test('routes last customer debt payment questions to the cashbook query', () => {
  for (const question of [
    'Pelanggan Andri pembayaran terakhir hutang kapan',
    'kapan cicilan hutang terakhir Andri',
    'kapan Andri membayar hutang'
  ]) {
    assert.deepEqual(resolveDirectQuery(question), {
      kind: 'query',
      query: 'debt_payments',
      args: { customer: 'andri' }
    })
  }
  assert.equal(resolveFastQuery('bayar hutang Andri'), null)
})

test('routes cashbook details and pending expedition costs to ledger queries', () => {
  assert.deepEqual(resolveDirectQuery('pengeluaran apa saja bulan ini'), {
    kind: 'query',
    query: 'cashbook',
    args: { type: 'expense', period: 'bulan ini' }
  })
  assert.deepEqual(resolveDirectQuery('berapa biaya ekspedisi Andri'), {
    kind: 'query',
    query: 'cashbook',
    args: { type: 'expense', search: 'ekspedisi andri', period: 'semua' }
  })
  assert.deepEqual(resolveDirectQuery('catatan biaya ekspedisi yang belum diisi'), {
    kind: 'query',
    query: 'cashbook',
    args: { type: 'expense', search: 'ekspedisi', pending: true, period: 'semua' }
  })
  assert.deepEqual(resolveDirectQuery('tampilkan buku kas bulan lalu'), {
    kind: 'query',
    query: 'cashbook',
    args: { period: 'bulan lalu' }
  })
})

test('falls back to supported sales, finance, transaction, catalog, and purchase queries', () => {
  assert.deepEqual(resolveFastQuery('ringkasan penjualan hari ini'), {
    kind: 'query',
    query: 'daily_summary',
    args: { period: 'hari ini' }
  })
  assert.deepEqual(resolveFastQuery('berapa kas bulan ini'), {
    kind: 'query',
    query: 'finance_summary',
    args: { period: 'bulan ini' }
  })
  assert.deepEqual(resolveFastQuery('produk paling laris minggu ini'), {
    kind: 'query',
    query: 'product_performance',
    args: { sortBy: 'quantity', period: 'minggu ini' }
  })
  assert.deepEqual(resolveFastQuery('riwayat transaksi Andri kemarin'), {
    kind: 'query',
    query: 'transactions',
    args: { customer: 'andri', period: 'kemarin' }
  })
  assert.deepEqual(resolveFastQuery('daftar nama vendor'), {
    kind: 'query',
    query: 'vendors',
    args: {}
  })
  assert.deepEqual(resolveFastQuery('riwayat pembelian vendor Agus'), {
    kind: 'query',
    query: 'purchases',
    args: { vendor: 'agus' }
  })
})

test('understands transaction existence, counts, latest records, and common question wording', () => {
  assert.deepEqual(resolveDirectQuery('Apakah hari ini ada transaksi?'), {
    kind: 'query',
    query: 'transactions',
    args: { period: 'hari ini', answerMode: 'existence' }
  })
  assert.deepEqual(resolveDirectQuery('sudah ada yang beli hari ini?'), {
    kind: 'query',
    query: 'transactions',
    args: { period: 'hari ini', answerMode: 'existence' }
  })
  assert.deepEqual(resolveDirectQuery('berapa jumlah transaksi hari ini'), {
    kind: 'query',
    query: 'transactions',
    args: { period: 'hari ini', answerMode: 'count' }
  })
  assert.deepEqual(resolveDirectQuery('transaksi Andri hari ini'), {
    kind: 'query',
    query: 'transactions',
    args: { customer: 'andri', period: 'hari ini' }
  })
  assert.deepEqual(resolveDirectQuery('nota terakhir Andri'), {
    kind: 'query',
    query: 'transactions',
    args: { customer: 'andri', answerMode: 'latest' }
  })
})

test('uses app query only after AI replies instead of producing a query plan', () => {
  assert.deepEqual(resolveFallbackQuery('berapa stok Bimo Oval', {
    kind: 'reply',
    message: 'Saya tidak memahami pertanyaan.'
  }), {
    kind: 'query',
    query: 'stock',
    args: { product: 'bimo oval' }
  })

  assert.equal(resolveFallbackQuery('berapa stok Bimo Oval', {
    kind: 'query',
    query: 'stock',
    args: { product: 'bimo oval' }
  }), null)
  assert.equal(resolveFallbackQuery('berapa stok Bimo Oval', { kind: 'reply' }, true), null)
  assert.equal(resolveFallbackQuery('apa kabar?', { kind: 'reply' }), null)
})

test('uses direct queries only for clear data questions', () => {
  assert.deepEqual(resolveDirectQuery('berapa stok Bimo Oval'), {
    kind: 'query',
    query: 'stock',
    args: { product: 'bimo oval' }
  })
  assert.deepEqual(resolveDirectQuery('berapa hutang Andri'), {
    kind: 'query',
    query: 'debts',
    args: { customer: 'andri' }
  })
  assert.deepEqual(resolveDirectQuery('ringkasan penjualan hari ini'), {
    kind: 'query',
    query: 'daily_summary',
    args: { period: 'hari ini' }
  })

  assert.equal(resolveDirectQuery('bagaimana strategi agar stok Bimo Oval lebih laris'), null)
  assert.equal(resolveDirectQuery('berapa harga tas Aventador'), null)
  assert.equal(resolveDirectQuery('produk apa paling laris dan stoknya'), null)
  assert.equal(resolveDirectQuery('berapa stok Bimo Oval', true), null)
})
