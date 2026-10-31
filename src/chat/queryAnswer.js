function rupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0)
}

function date(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('id-ID')
}

function summarizeStock(data) {
  const matches = data.matches || []
  if (matches.length === 0) {
    return data.total_products ? 'Produk yang cocok tidak ditemukan.' : 'Belum ada produk di toko.'
  }
  const lines = matches.slice(0, 10).map((product) => {
    const prices = Object.entries(product.sale_prices || {})
      .filter(([, price]) => Number(price) > 0)
      .map(([unit, price]) => rupiah(price) + '/' + unit)
    return product.name + ': ' + product.stock +
      (prices.length ? ' · Harga jual ' + prices.join(', ') : '')
  })
  if (data.truncated || matches.length > 10) lines.push('Masih ada produk lainnya; buka rincian data untuk daftar lengkap.')
  return lines.join('\n')
}

function summarizeDebts(data) {
  const customers = (data.customers || []).filter((customer) => Number(customer.balance_due) > 0)
  if (!customers.length) return 'Tidak ada hutang pelanggan yang masih berjalan.'
  return [
    'Total hutang pelanggan: ' + rupiah(data.total_debt),
    ...customers.slice(0, 10).map((customer) => customer.customer_name + ': ' + rupiah(customer.balance_due)),
    ...(customers.length > 10 ? ['Dan ' + (customers.length - 10) + ' pelanggan lainnya.'] : [])
  ].join('\n')
}

function summarizeTransactions(data) {
  const transactions = data.transactions || []
  if (!transactions.length) return 'Tidak ada transaksi yang cocok.'
  const lines = transactions.slice(0, 10).map((transaction) =>
    (transaction.invoiceNo || '#' + transaction.id) + ' · ' +
    (transaction.customerName || 'Pelanggan') + ' · ' +
    date(transaction.createdAt) + ' · ' + rupiah(transaction.total) +
    (transaction.paymentType === 'credit' ? ' · Sisa hutang ' + rupiah(transaction.balanceDue) : ' · Tunai')
  )
  if (data.truncated || transactions.length > 10) lines.push('Rincian lainnya dapat dilihat pada data transaksi.')
  return lines.join('\n')
}

export function formatQueryAnswer(intent, data = {}) {
  if (intent === 'stock' || intent === 'products') return summarizeStock(data)
  if (intent === 'debts') return summarizeDebts(data)

  if (intent === 'daily_summary' || intent === 'sales_summary') {
    return [
      'Transaksi: ' + (Number(data.transaction_count) || 0),
      'Total penjualan: ' + rupiah(data.sales_total),
      'Laba kotor: ' + rupiah(data.gross_profit),
      'Pemasukan: ' + rupiah(data.income) + ' · Pengeluaran: ' + rupiah(data.expense),
      'Hutang pelanggan berjalan: ' + rupiah(data.customer_debt),
      ...(Number(data.pending_expedition_count) > 0
        ? ['Biaya ekspedisi tertunda: ' + data.pending_expedition_count]
        : [])
    ].join('\n')
  }

  if (intent === 'finance_summary') {
    return [
      'Pemasukan: ' + rupiah(data.income),
      'Pengeluaran: ' + rupiah(data.expense),
      'Modal: ' + rupiah(data.capital),
      'Laba kotor: ' + rupiah(data.gross_profit),
      'Total hutang pelanggan: ' + rupiah(data.total_debt),
      ...(Number(data.pending_expedition_count) > 0
        ? ['Biaya ekspedisi tertunda: ' + data.pending_expedition_count]
        : [])
    ].join('\n')
  }

  if (intent === 'transactions') return summarizeTransactions(data)

  if (intent === 'product_performance') {
    const products = data.products || []
    if (!products.length) return 'Belum ada penjualan produk pada periode tersebut.'
    return [
      'Jumlah transaksi: ' + (Number(data.transaction_count) || 0),
      ...products.slice(0, 10).map((product) =>
        product.name + ': terjual ' + (Number(product.quantity) || 0) +
        ' · Penjualan ' + rupiah(product.sales) +
        ' · Laba kotor ' + rupiah(product.gross_profit)
      )
    ].join('\n')
  }

  if (intent === 'purchases') {
    const entries = data.entries || []
    if (!entries.length) return 'Tidak ada catatan pembelian yang cocok.'
    return entries.slice(0, 10).map((entry) =>
      date(entry.date) + ' · ' + (entry.note || entry.category || 'Pembelian') +
      ' · ' + rupiah(entry.amount)
    ).join('\n')
  }

  if (['customers', 'vendors', 'expeditions'].includes(intent)) {
    const entries = data.entries || []
    if (!entries.length) return 'Daftar ' + intent + ' masih kosong.'
    return entries.slice(0, 20).map((entry) => entry.name).join('\n')
  }

  return 'Data berhasil diambil. Buka rincian untuk melihat hasilnya.'
}
