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

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return value || ''
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/\b\w/g, (char) => char.toLocaleUpperCase('id-ID'))
}

function dateTime(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : parsed.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })
}

function summarizeStock(data) {
  const matches = data.matches || []
  if (matches.length === 0) {
    if (data.low_stock_only && !data.searched_product) {
      return 'Tidak ada produk dengan stok rendah (maksimal 5 satuan utama).'
    }
    return data.total_products ? 'Produk yang cocok tidak ditemukan.' : 'Belum ada produk di toko.'
  }
  const lines = matches.slice(0, 10).map((product) => {
    const prices = Object.entries(product.sale_prices || {})
      .filter(([, price]) => Number(price) > 0)
      .map(([unit, price]) => rupiah(price) + '/' + unit)
    const costs = Object.entries(product.hpp || {})
      .filter(([, cost]) => Number(cost) > 0)
      .map(([unit, cost]) => rupiah(cost) + '/' + unit)
    return '• **' + product.name + '** — Stok ' + product.stock +
      (data.include_cost && costs.length ? ' · HPP ' + costs.join(', ') : '') +
      (prices.length ? ' · Harga jual ' + prices.join(', ') : '')
  })
  if (data.truncated || matches.length > 10) lines.push('Masih ada produk lainnya; buka rincian data untuk daftar lengkap.')
  const orderLabel = data.low_stock_only
    ? 'Produk dengan stok rendah (maksimal 5 satuan utama):'
    : data.stock_order === 'asc'
    ? 'Produk dengan stok paling sedikit (diurutkan berdasarkan jumlah PCS):'
    : data.stock_order === 'desc'
      ? 'Produk dengan stok paling banyak (diurutkan berdasarkan jumlah PCS):'
      : ''
  return [orderLabel, ...lines].filter(Boolean).join('\n')
}

function summarizeDebts(data) {
  const customers = (data.customers || []).filter((customer) => Number(customer.balance_due) > 0)
  if (data.answer_mode === 'count') {
    return 'Jumlah pelanggan yang masih berhutang: ' + customers.length + '.'
  }
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
  const filterLabel = [
    data.payment_type === 'credit' ? 'kredit' : data.payment_type === 'cash' ? 'tunai' : '',
    data.unpaid_only ? 'belum lunas' : ''
  ].filter(Boolean).join(' ')
  const transactionLabel = 'transaksi' + (filterLabel ? ' ' + filterLabel : '')
  function transactionDetails(transaction) {
    if (!data.include_details) return ''
    const items = (transaction.items || []).map((item) =>
      String(item.name || 'Produk') + ' × ' + (Number(item.qty) || 0) +
      (item.unit ? ' ' + item.unit : '')
    )
    const payments = (transaction.payments || []).map((payment) =>
      rupiah(payment.amount) + ' (' + date(payment.date) + ')'
    )
    return [
      ...(items.length ? ['Barang: ' + items.join(', ')] : []),
      ...(transaction.paidAmount != null ? ['Dibayar: ' + rupiah(transaction.paidAmount)] : []),
      ...(payments.length ? ['Riwayat bayar: ' + payments.join(', ')] : []),
      ...(transaction.expedition ? ['Ekspedisi: ' + transaction.expedition] : [])
    ].join(' · ')
  }
  if (data.answer_mode === 'existence') {
    return matchingCount
      ? 'Ya, ada ' + matchingCount + ' ' + transactionLabel + (periodLabel ? ' ' + periodLabel : '') + '.'
      : 'Belum ada ' + transactionLabel + (periodLabel ? ' ' + periodLabel : '') + '.'
  }
  if (data.answer_mode === 'count') {
    return 'Jumlah ' + transactionLabel + (periodLabel ? ' ' + periodLabel : '') + ': ' + matchingCount + '.'
  }
  if (!transactions.length) {
    return data.answer_mode === 'latest'
      ? 'Belum ada transaksi yang tercatat' + (periodLabel ? ' ' + periodLabel : '') + '.'
      : 'Tidak ada transaksi yang cocok' + (periodLabel ? ' ' + periodLabel : '') + '.'
  }
  if (data.answer_mode === 'latest') {
    const transaction = transactions[0]
    return 'Transaksi terakhir' + (filterLabel ? ' ' + filterLabel : '') +
      (data.matching_customer ? ' pelanggan ' + data.matching_customer : '') +
      ': ' + (transaction.invoiceNo || '#' + transaction.id) + ' · ' +
      (transaction.customerName || 'Pelanggan') + ' · ' + dateTime(transaction.createdAt) +
      ' · ' + rupiah(transaction.total) +
      (transaction.paymentType === 'credit' ? ' · Sisa hutang ' + rupiah(transaction.balanceDue) : ' · Tunai') +
      (transactionDetails(transaction) ? ' · ' + transactionDetails(transaction) : '')
  }
  const lines = transactions.slice(0, 10).map((transaction) =>
    (transaction.invoiceNo || '#' + transaction.id) + ' · ' +
    (transaction.customerName || 'Pelanggan') + ' · ' +
    date(transaction.createdAt) + ' · ' + rupiah(transaction.total) +
    (transaction.paymentType === 'credit' ? ' · Sisa hutang ' + rupiah(transaction.balanceDue) : ' · Tunai') +
    (transactionDetails(transaction) ? ' · ' + transactionDetails(transaction) : '')
  )
  if (filterLabel) lines.unshift('Daftar ' + transactionLabel + (periodLabel ? ' ' + periodLabel : '') + ':')
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

  if (intent === 'operational_insights') {
    const dateRange = data.date_range
    const periodLabel = dateRange?.from || dateRange?.to
      ? 'Periode ' + [dateRange.from, dateRange.to].filter(Boolean).map(formatDate).join(' sampai ')
      : ''
    return [
      'Briefing operasional VOLTKER',
      ...(periodLabel ? [periodLabel] : []),
      ...(data.alerts?.length
        ? ['PERINGATAN:', ...data.alerts.map((alert) => '• ' + alert.message)]
        : ['Peringatan prioritas: tidak ada.']),
      'Penjualan: ' + rupiah(data.sales_total) + ' · ' + (Number(data.transaction_count) || 0) + ' transaksi',
      'Laba kotor: ' + rupiah(data.gross_profit) + ' · Laba bersih: ' + rupiah(data.net_profit),
      'Saldo kas: ' + rupiah(data.cash_balance),
      'Persediaan: ' + (Number(data.product_count) || 0) + ' produk · Nilai modal ' + rupiah(data.inventory_asset),
      'Hutang pelanggan berjalan: ' + rupiah(data.customer_debt),
      'Biaya ekspedisi tertunda: ' + (Number(data.pending_expedition_count) || 0),
      ...(data.low_stock_products?.length
        ? ['Produk dengan stok rendah: ' + data.low_stock_products.map((product) =>
            product.name + ' (' + product.stock + ')'
          ).join(', ') + (Number(data.low_stock_count) > data.low_stock_products.length
            ? ', dan ' + (Number(data.low_stock_count) - data.low_stock_products.length) + ' lainnya.'
            : '.')]
        : ['Produk dengan stok rendah: tidak ada.']),
      ...(data.watched_products?.length
        ? [
            'Produk pantauan:',
            ...data.watched_products.map((product) => product.not_found
              ? '• ' + product.name + ': tidak ditemukan, periksa nama di Preferensi.'
              : '• ' + product.name + ': ' + product.stock + (product.low_stock ? ' · stok rendah' : ''))
          ]
        : []),
      'Saran tindak lanjut:',
      ...(data.recommendations || []).map((recommendation) => '• ' + recommendation),
      ...(data.restock
        ? [
            'Estimasi restok (riwayat 30 hari, target cakupan 14 hari):',
            ...(data.restock.data_sufficient
              ? data.restock.products.length
                ? data.restock.products.map((product) =>
                    '• ' + product.name + ': stok ' + product.stock +
                    ', perkiraan cukup ' + product.estimated_stock_days + ' hari' +
                    ', tambahan sekitar ' + (product.suggested_additional || product.suggested_additional_stock_units + ' satuan stok')
                  )
                : ['• Belum ada produk yang diperkirakan habis dalam 14 hari berdasarkan rata-rata penjualan.']
              : ['• Belum cukup riwayat penjualan pada periode pengamatan untuk membuat estimasi.']),
            ...(Number(data.restock.insufficient_product_count) > 0
              ? ['• Estimasi hanya mencakup produk dengan minimal 3 transaksi; ' +
                    data.restock.insufficient_product_count + ' produk tidak memiliki riwayat yang cukup.']
              : []),
            'Estimasi ini advisory, memakai rata-rata sederhana, dan tidak mengubah stok.'
          ]
        : []),
      'Analisis ini hanya membaca data toko dan tidak mengubah apa pun.'
    ].join('\n')
  }

  if (intent === 'sales_trend') {
    const currentPeriod = data.current_range
    const previousPeriod = data.previous_range
    const change = data.change_percent == null
      ? 'Persentase perubahan belum dapat dihitung karena penjualan periode pembanding bernilai nol.'
      : 'Perubahan: ' + (data.change_percent > 0 ? '+' : '') + data.change_percent + '%.'
    return [
      'Perbandingan penjualan',
      'Periode saat ini: ' + [currentPeriod?.from, currentPeriod?.to].filter(Boolean).map(formatDate).join(' sampai '),
      'Periode sebelumnya: ' + [previousPeriod?.from, previousPeriod?.to].filter(Boolean).map(formatDate).join(' sampai '),
      'Penjualan: ' + rupiah(data.current_sales) + ' vs ' + rupiah(data.previous_sales),
      change,
      'Perbedaan nominal: ' + rupiah(data.change_amount),
      'Transaksi: ' + (Number(data.current_transaction_count) || 0) + ' vs ' +
        (Number(data.previous_transaction_count) || 0),
      ...(data.significant_change
        ? ['Perubahan tajam terdeteksi (ambang ±50% dan minimal 3 transaksi di tiap periode); ini indikator sederhana, bukan diagnosis penyebab.']
        : data.sufficient_data
          ? ['Tidak melewati ambang perubahan tajam ±50%.']
          : ['Data transaksi belum cukup untuk menandai perubahan tajam (minimal 3 transaksi di tiap periode).'])
    ].join('\n')
  }

  if (intent === 'product_stock_performance') {
    if (!data.products?.length) {
      return Number(data.low_stock_count) > 0
        ? 'Ada produk dengan stok rendah, tetapi tidak ditemukan penjualan yang cocok pada periode ini.'
        : 'Tidak ada produk dengan stok rendah pada saat ini.'
    }
    return [
      'Produk terlaris dengan stok rendah (ambang stok aplikasi: maksimal 5 satuan utama):',
      ...data.products.map((product, index) =>
        (index + 1) + '. ' + product.name + ' · stok ' + product.stock +
        ' · penjualan ' + rupiah(product.sales) +
        ' · terjual ' + (product.quantity_label || product.quantity_pcs + ' pcs')
      ),
      'Stok adalah kondisi saat ini; penjualan mengikuti periode yang diminta.'
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
        ? ['Ringkasan pengeluaran', 'Total pengeluaran: ' + rupiah(data.totals?.expense)]
        : data.type === 'income'
          ? ['Ringkasan pemasukan', 'Total pemasukan: ' + rupiah(data.totals?.income)]
          : data.type === 'capital'
            ? ['Ringkasan modal', 'Total modal: ' + rupiah(data.totals?.capital)]
            : [
                'Ringkasan Buku Kas',
                'Pemasukan: ' + rupiah(data.totals?.income),
                'Pengeluaran: ' + rupiah(data.totals?.expense),
                'Modal: ' + rupiah(data.totals?.capital),
                'Saldo bersih: ' + rupiah(data.net_amount)
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
    const dateRange = data.date_range
    const periodLabel = dateRange?.from || dateRange?.to
      ? 'Periode ' + [dateRange.from, dateRange.to].filter(Boolean).map(formatDate).join(' sampai ')
      : ''
    return [
      'Ringkasan penjualan',
      ...(periodLabel ? [periodLabel] : []),
      'Transaksi: ' + (Number(data.transaction_count) || 0),
      'Total penjualan: ' + rupiah(data.sales_total),
      'Laba kotor: ' + rupiah(data.gross_profit),
      'Laba bersih: ' + rupiah(data.net_profit),
      'Pemasukan: ' + rupiah(data.income) + ' · Pengeluaran: ' + rupiah(data.expense),
      'Saldo kas: ' + rupiah(data.cash_balance),
      'Hutang pelanggan: ' + rupiah(data.customer_debt),
      ...(Number(data.pending_expedition_count) > 0
        ? ['Biaya ekspedisi tertunda: ' + data.pending_expedition_count]
        : [])
    ].join('\n')
  }

  if (intent === 'finance_summary') {
    return [
      'Ringkasan keuangan',
      'Pemasukan: ' + rupiah(data.income),
      'Pengeluaran: ' + rupiah(data.expense),
      'Modal: ' + rupiah(data.capital),
      'Laba kotor: ' + rupiah(data.gross_profit),
      'Laba bersih: ' + rupiah(data.net_profit),
      'Saldo kas: ' + rupiah(data.cash_balance),
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
    const matchingCount = Number(data.matching_count ?? entries.length) || 0
    if (data.answer_mode === 'existence') {
      return matchingCount
        ? 'Ya, ada ' + matchingCount + ' catatan pembelian' + (periodLabel ? ' ' + periodLabel : '') + '.'
        : 'Belum ada catatan pembelian' + (periodLabel ? ' ' + periodLabel : '') + '.'
    }
    if (data.answer_mode === 'count') {
      return 'Jumlah catatan pembelian' + (periodLabel ? ' ' + periodLabel : '') + ': ' + matchingCount + '.'
    }
    if (!entries.length) {
      return data.answer_mode === 'latest'
        ? 'Belum ada catatan pembelian' + (periodLabel ? ' ' + periodLabel : '') + '.'
        : 'Tidak ada catatan pembelian yang cocok' + (periodLabel ? ' ' + periodLabel : '') + '.'
    }
    if (data.answer_mode === 'latest') {
      const entry = entries[0]
      return 'Pembelian terakhir' + (periodLabel ? ' ' + periodLabel : '') +
        ': ' + date(entry.date) + ' · ' + (entry.purchase || entry.note || 'Pembelian') +
        (entry.vendor ? ' · Vendor ' + entry.vendor : '') + ' · ' + rupiah(entry.amount)
    }
    return entries.slice(0, 10).map((entry) =>
      date(entry.date) + ' · ' + (entry.purchase || entry.note || entry.category || 'Pembelian') +
      (entry.vendor ? ' · Vendor ' + entry.vendor : '') +
      ' · ' + rupiah(entry.amount)
    ).join('\n')
  }

  if (['customers', 'vendors', 'expeditions'].includes(intent)) {
    const entries = data.entries || []
    if (data.answer_mode === 'count') {
      return 'Jumlah ' + ({ customers: 'pelanggan', vendors: 'vendor', expeditions: 'ekspedisi' }[intent] || intent) +
        ': ' + (Number(data.matching_count) || 0) + '.'
    }
    if (!entries.length) {
      return data.searched_text
        ? 'Tidak ditemukan ' + ({ customers: 'pelanggan', vendors: 'vendor', expeditions: 'ekspedisi' }[intent] || intent) +
            ' yang cocok dengan "' + data.searched_text + '".'
        : 'Daftar ' + intent + ' masih kosong.'
    }
    return entries.slice(0, 20).map((entry) =>
      entry.name +
      (data.include_details && intent === 'customers' && entry.phone ? ' · Telepon ' + entry.phone : '') +
      (data.include_details && intent === 'customers' && entry.address ? ' · Alamat ' + entry.address : '')
    ).join('\n')
  }

  if (['categories', 'units'].includes(intent)) {
    const entries = data.entries || []
    if (data.answer_mode === 'count') {
      return 'Jumlah ' + (intent === 'categories' ? 'kategori' : 'pilihan satuan') +
        ': ' + (Number(data.matching_count) || 0) + '.'
    }
    if (!entries.length) {
      return data.searched_text
        ? 'Tidak ditemukan ' + (intent === 'categories' ? 'kategori' : 'satuan') +
            ' yang cocok dengan "' + data.searched_text + '".'
        : 'Daftar ' + (intent === 'categories' ? 'kategori' : 'satuan') + ' masih kosong.'
    }
    return entries.slice(0, 30).map((entry) => entry.name).join('\n')
  }

  return 'Data berhasil diambil. Buka rincian untuk melihat hasilnya.'
}
