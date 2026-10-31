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
    const costs = Object.entries(product.hpp || {})
      .filter(([, cost]) => Number(cost) > 0)
      .map(([unit, cost]) => rupiah(cost) + '/' + unit)
    const costText = data.include_cost && costs.length
      ? ' · HPP ' + costs.join(', ')
      : ''
    return product.name + ': ' + product.stock +
      costText +
      (prices.length ? ' · Harga jual ' + prices.join(', ') : '')
  })
  if (data.truncated || matches.length > 10) lines.push('Masih ada produk lainnya; buka rincian data untuk daftar lengkap.')
  const orderLabel = data.stock_order === 'asc'
    ? 'Produk dengan stok paling sedikit (diurutkan berdasarkan jumlah PCS):'
    : data.stock_order === 'desc'
      ? 'Produk dengan stok paling banyak (diurutkan berdasarkan jumlah PCS):'
      : ''
  return [orderLabel, ...lines].filter(Boolean).join('\n')
}

function summarizeDebts(data) {
  const customers = (data.customers || []).filter((customer) => Number(customer.balance_due) > 0)
  if (data.searched_customer) {
    if (!customers.length) return 'Hutang pelanggan "' + data.searched_customer + '" tidak ditemukan atau tidak memiliki hutang berjalan.'
    return customers.map((customer) =>
      'Hutang ' + customer.customer_name + ': ' + rupiah(customer.balance_due)
    ).join('\n')
  }
  if (!customers.length) return 'Tidak ada hutang pelanggan yang masih berjalan.'
  return [
    'Total hutang pelanggan: ' + rupiah(data.total_debt),
    ...customers.slice(0, 10).map((customer) => customer.customer_name + ': ' + rupiah(customer.balance_due)),
    ...(customers.length > 10 ? ['Dan ' + (customers.length - 10) + ' pelanggan lainnya.'] : [])
  ].join('\n')
}

function summarizeTransactions(data) {
  const transactions = data.transactions || []
  const periodLabels = {
    'hari ini': 'hari ini',
    kemarin: 'kemarin',
    'minggu ini': 'minggu ini',
    'bulan ini': 'bulan ini',
    'bulan lalu': 'bulan lalu',
    'tahun ini': 'tahun ini',
    'tahun lalu': 'tahun lalu'
  }
  const periodLabel = periodLabels[data.period] || ''
  const matchingCount = Number(data.matching_count ?? transactions.length) || 0
  if (data.answer_mode === 'existence') {
    return matchingCount
      ? 'Ya, ada ' + matchingCount + ' transaksi' + (periodLabel ? ' ' + periodLabel : '') + '.'
      : 'Belum ada transaksi' + (periodLabel ? ' ' + periodLabel : '') + '.'
  }
  if (data.answer_mode === 'count') {
    return 'Jumlah transaksi' + (periodLabel ? ' ' + periodLabel : '') + ': ' + matchingCount + '.'
  }
  if (!transactions.length) return 'Tidak ada transaksi yang cocok' + (periodLabel ? ' ' + periodLabel : '') + '.'
  if (data.answer_mode === 'latest') {
    const transaction = transactions[0]
    return 'Transaksi terakhir' + (data.matching_customer ? ' pelanggan ' + data.matching_customer : '') +
      ': ' + (transaction.invoiceNo || '#' + transaction.id) + ' · ' +
      (transaction.customerName || 'Pelanggan') + ' · ' + date(transaction.createdAt) +
      ' · ' + rupiah(transaction.total) +
      (transaction.paymentType === 'credit' ? ' · Sisa hutang ' + rupiah(transaction.balanceDue) : ' · Tunai')
  }
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
  if (intent === 'inventory_summary') {
    return [
      'Jumlah produk: ' + (Number(data.product_count) || 0),
      'Produk dengan stok rendah (maksimal 5 satuan utama): ' + (Number(data.low_stock_count) || 0),
      'Nilai modal seluruh stok: ' + rupiah(data.total_asset)
    ].join('\n')
  }

  if (intent === 'stock' || intent === 'products') return summarizeStock(data)
  if (intent === 'debts') return summarizeDebts(data)
  if (intent === 'debt_payments') {
    if (!data.searched_customer) return 'Sebutkan nama pelanggan untuk memeriksa pembayaran hutang terakhir.'
    if (!data.payment) return 'Tidak ditemukan catatan pembayaran hutang untuk pelanggan "' + data.searched_customer + '" di Buku Kas.'
    return 'Pembayaran hutang terakhir ' + data.payment.customer_name +
      ': ' + date(data.payment.date) + ' · ' + rupiah(data.payment.amount) + '.'
  }
  if (intent === 'cashbook') {
    const entries = data.entries || []
    if (!entries.length) {
      return data.pending_count
        ? 'Tidak ditemukan catatan Buku Kas yang cocok. Ada ' + data.pending_count + ' biaya tertunda yang belum memiliki nominal.'
        : 'Tidak ditemukan catatan Buku Kas yang cocok.'
    }
    const lines = [
      ...(data.type === 'expense'
        ? ['Total pengeluaran: ' + rupiah(data.totals?.expense)]
        : data.type === 'income'
          ? ['Total pemasukan: ' + rupiah(data.totals?.income)]
          : data.type === 'capital'
            ? ['Total modal: ' + rupiah(data.totals?.capital)]
            : [
                'Pemasukan: ' + rupiah(data.totals?.income),
                'Pengeluaran: ' + rupiah(data.totals?.expense),
                'Modal: ' + rupiah(data.totals?.capital),
                'Saldo bersih catatan: ' + rupiah(data.net_amount)
              ]),
      ...entries.slice(0, 10).map((entry) =>
        date(entry.date) + ' · ' +
        ({ income: 'Pemasukan', expense: 'Pengeluaran', capital: 'Modal' }[entry.type] || entry.type) +
        (entry.category ? ' · ' + entry.category : '') +
        (entry.note ? ' · ' + entry.note : '') +
        (entry.pending ? ' · Nominal belum diisi' : ' · ' + rupiah(entry.amount))
      ),
      ...(Number(data.pending_count) > 0
        ? ['Ada ' + data.pending_count + ' biaya tertunda yang belum memiliki nominal.']
        : []),
      ...(data.truncated ? ['Rincian dibatasi 30 catatan; persempit periode atau kata pencarian.'] : [])
    ]
    return lines.join('\n')
  }

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
    const rankingLabel = {
      quantity: 'Paling banyak terjual (jumlah sesuai satuan produk)',
      sales: 'Penjualan tertinggi',
      gross_profit: 'Laba kotor tertinggi'
    }[data.sort_by] || 'Peringkat produk'
    return [
      'Jumlah transaksi: ' + (Number(data.transaction_count) || 0),
      rankingLabel + ':',
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

  if (['categories', 'units'].includes(intent)) {
    const entries = data.entries || []
    if (!entries.length) return 'Daftar ' + (intent === 'categories' ? 'kategori' : 'satuan') + ' masih kosong.'
    return entries.slice(0, 30).map((entry) => entry.name).join('\n')
  }

  return 'Data berhasil diambil. Buka rincian untuk melihat hasilnya.'
}
