import test from 'node:test'
import assert from 'node:assert/strict'
import { createInvoiceSvg } from './invoiceJpeg.js'

test('creates a branded JPEG source with invoice and sale details', () => {
  const svg = createInvoiceSvg({
    id: 14,
    createdAt: '2026-10-26T12:00:00.000Z',
    customerName: 'Agus Salim',
    paymentType: 'cash',
    items: [{ name: 'Tas Slingbag Tactical', qty: 1, unit: 'pcs', price: 15000 }],
    total: 15000,
    paidAmount: 15000,
    payment: 20000,
    change: 5000
  }, 'data:image/png;base64,bG9nbw==')

  assert.match(svg, /<svg[^>]+width="1240"/)
  assert.match(svg, /data:image\/png;base64,bG9nbw==/)
  assert.match(svg, /FAKTUR PENJUALAN/)
  assert.match(svg, /INV-20261026-14/)
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
  }, 'data:image/png;base64,bG9nbw==')

  assert.match(svg, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
  assert.match(svg, /Tas &amp; Dompet/)
  assert.match(svg, /Sisa tagihan/)
  assert.match(svg, /RIWAYAT PEMBAYARAN/)
  assert.doesNotMatch(svg, /<script>/)
})
