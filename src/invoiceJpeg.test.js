import test from 'node:test'
import assert from 'node:assert/strict'
import { createInvoiceSvg } from './invoiceJpeg.js'

test('creates a branded JPEG source with invoice and sale details', () => {
  const svg = createInvoiceSvg({
    id: 14,
    createdAt: '2026-10-26T12:00:00.000Z',
    customerName: 'Agus Salim',
    expedition: 'JNE',
    paymentType: 'cash',
    items: [{ name: 'Tas Slingbag Tactical', qty: 1, unit: 'pcs', price: 15000 }],
    total: 15000,
    paidAmount: 15000,
    payment: 20000,
    change: 5000
  })

  assert.match(svg, /<svg[^>]+width="1240"/)
  assert.match(svg, /FAKTUR PENJUALAN/)
  assert.match(svg, /INV-20261026-14/)
  assert.doesNotMatch(svg, /Ekspedisi|JNE/)
  assert.match(svg, /Tas Slingbag Tactical/)
  assert.match(svg, /Tunai diterima/)
  assert.match(svg, /Kembalian/)
})

test('escapes customer and item text in the generated invoice', () => {
  const svg = createInvoiceSvg({
    id: 1,
    createdAt: '2026-10-26T12:00:00.000Z',
    customerName: '<script>alert("x")</script>',
    paymentType: 'credit',
    items: [{ name: 'Tas & Dompet', qty: 2, unit: 'pcs', price: 10000 }],
    total: 20000,
    paidAmount: 5000,
    balanceDue: 15000,
    payments: [{ date: '2026-10-26T12:00:00.000Z', amount: 5000 }]
  })

  assert.match(svg, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
  assert.match(svg, /Tas &amp; Dompet/)
  assert.match(svg, /Sisa tagihan/)
  assert.match(svg, /RIWAYAT PEMBAYARAN/)
  assert.doesNotMatch(svg, /<script>/)
})

test('omits fully returned product lines but preserves return history, reduced total, and refund', () => {
  const svg = createInvoiceSvg({
    id: 21,
    createdAt: '2026-11-17T10:00:00.000Z',
    customerName: 'Pelanggan',
    paymentType: 'cash',
    items: [
      { name: 'Barang A', qty: 50, unit: 'pcs', price: 4000 },
      { name: 'Barang B', qty: 25, unit: 'pcs', price: 4000 }
    ],
    total: 200000,
    paidAmount: 200000,
    payment: 300000,
    change: 0,
    returns: [{
      requestId: 'return-1',
      date: '2026-11-17T11:00:00.000Z',
      amount: 100000,
      refundAmount: 100000,
      items: [{ lineIndex: 1, name: 'Barang B', qty: 25, unit: 'pcs', price: 4000 }]
    }]
  })

  assert.match(svg, /Barang A/)
  assert.match(svg, /Barang B/)
  assert.doesNotMatch(svg, />0 pcs<\/text>/)
  assert.doesNotMatch(svg, /Retur tercatat:/)
  assert.match(svg, /RETUR TERCATAT/)
  assert.match(svg, /Refund retur/)
  assert.match(svg, /-Rp/)
})
