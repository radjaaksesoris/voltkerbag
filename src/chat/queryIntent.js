const STOCK_TERMS = new Set(['stok', 'stoknya', 'stock', 'stocknya', 'persediaan'])
const STOCK_QUESTION_TERMS = new Set([
  'berapa', 'cek', 'lihat', 'cari', 'tampilkan', 'jumlah', 'ada', 'tersedia', 'menipis',
  'masih', 'sisa', 'sisanya', 'tersisa', 'sekarang', 'saat', 'ini', 'apakah',
  'tolong', 'dong', 'produk', 'barang', 'item', 'apa', 'nya', 'di', 'toko',
  'yang', 'dengan', 'untuk', 'harga', 'harganya', 'hpp', 'modal', 'pokok',
  'jual', 'per', 'pcs', 'lusin', 'paling', 'sedikit', 'minim', 'minimum', 'rendah',
  'terendah', 'terkecil', 'banyak', 'terbanyak', 'tinggi', 'tertinggi',
  'terbesar', 'low', 'lowest', 'high', 'highest', 'saja', 'semua', 'seluruh'
])
const STOCK_ACTION_TERMS = new Set([
  'tambah', 'tambahkan', 'menambah', 'masukkan', 'catat', 'kurangi', 'ubah',
  'setel', 'hapus', 'edit', 'perbarui', 'restok'
])
const PERFORMANCE_TERMS = new Set(['laku', 'laris', 'terjual', 'performa'])
const DEBT_TERMS = new Set([
  'hutang', 'hutangnya', 'berhutang', 'utang', 'utangnya', 'berutang',
  'piutang', 'piutangnya'
])
const DEBT_QUESTION_TERMS = new Set([
  'berapa', 'banyak', 'sisa', 'sisanya', 'tersisa', 'total', 'jumlah', 'cek', 'lihat',
  'cari', 'tampilkan', 'apakah', 'tolong', 'dong', 'ada', 'siapa', 'pelanggan',
  'customer', 'yang', 'masih', 'punya', 'milik', 'atas', 'nama', 'saja', 'dari',
  'semua', 'seluruh', 'seluruhnya', 'keseluruhan'
])
const DEBT_PAYMENT_HISTORY_TERMS = new Set([
  ...DEBT_TERMS, 'pembayaran', 'bayar', 'bayarkan', 'membayar', 'dibayar',
  'cicilan', 'mencicil', 'pelunasan',
  'terakhir', 'terbaru', 'kapan', 'tanggal', 'riwayat', 'catatan', 'buku',
  'kas', 'pelanggan', 'customer', 'yang', 'di', 'dari', 'atas', 'nama',
  'saya', 'berapa', 'apa', 'tolong', 'dong'
])
const DEBT_ACTION_TERMS = new Set([
  'bayar', 'bayarkan', 'membayar', 'lunasi', 'melunasi', 'catat', 'tambahkan',
  'tambah', 'ubah', 'hapus', 'kurangi', 'setor'
])
const WRITE_TERMS = new Set([
  ...STOCK_ACTION_TERMS, ...DEBT_ACTION_TERMS, 'jualkan', 'buat',
  'belikan', 'simpan', 'ganti'
])
const PERIOD_MONTHS = [
  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
  'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
]

function normalizeMessage(message) {
  const normalized = String(message || '')
    .normalize('NFKC')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
  return { normalized, words: normalized.split(/\s+/).filter(Boolean) }
}

function queryPeriod(normalized) {
  const dateMatch = normalized.match(new RegExp(
    String.raw`\b(?:tanggal\s+)?(\d{1,2})\s+(${PERIOD_MONTHS.join('|')})(?:\s+(\d{4}))?\b`
  ))
  if (dateMatch) {
    return ['tanggal', dateMatch[1], dateMatch[2], dateMatch[3]].filter(Boolean).join(' ')
  }
  const previousMonthDay = normalized.match(/\btanggal\s+(\d{1,2})\s+bulan\s+(?:lalu|kemarin)\b/)
  if (previousMonthDay) return 'tanggal ' + previousMonthDay[1] + ' bulan lalu'
  const previousWeekday = normalized.match(
    /\b(?:hari\s+)?(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+kemarin\b/
  )
  if (previousWeekday) return 'hari ' + previousWeekday[1] + ' kemarin'
  const monthMatch = normalized.match(new RegExp(
    String.raw`\b(?:bulan\s+)?(${PERIOD_MONTHS.join('|')})(?:\s+(\d{4}))?\b`
  ))
  if (monthMatch) return [monthMatch[1], monthMatch[2]].filter(Boolean).join(' ')
  if (/\b(kemarin|kemaren)\b/.test(normalized)) return 'kemarin'
  if (/\b(minggu ini|minggu)\b/.test(normalized)) return 'minggu ini'
  if (/\b(bulan lalu|bulan kemarin)\b/.test(normalized)) return 'bulan lalu'
  if (/\b(bulan ini|bulan)\b/.test(normalized)) return 'bulan ini'
  if (/\b(tahun lalu|tahun kemarin)\b/.test(normalized)) return 'tahun lalu'
  if (/\b(tahun ini)\b/.test(normalized)) return 'tahun ini'
  if (/\b(hari ini|hari|sekarang|today)\b/.test(normalized)) return 'hari ini'
  return ''
}

function removeTerms(words, terms) {
  return words.filter((word) => !terms.has(word)).join(' ')
}

export function resolveFastQuery(message) {
  const { normalized, words } = normalizeMessage(message)
  const asksOperationalInsights = words.some((word) =>
    ['analisis', 'analisa', 'insight', 'evaluasi'].includes(word)
  ) && words.some((word) => ['toko', 'operasional', 'bisnis'].includes(word))
  if (asksOperationalInsights) {
    const period = queryPeriod(normalized)
    return {
      kind: 'query',
      query: 'operational_insights',
      args: period ? { period } : {}
    }
  }

  const asksDebtPaymentHistory = words.some((word) => DEBT_TERMS.has(word))
    && words.some((word) => ['pembayaran', 'cicilan', 'pelunasan', 'terakhir', 'terbaru', 'kapan'].includes(word))
  const asksDebtPaymentTotal = words.some((word) =>
    ['cicilan', 'pembayaran', 'pelunasan', 'dibayar', 'membayar'].includes(word)
  ) && words.some((word) => ['berapa', 'jumlah', 'total'].includes(word))
  if (asksDebtPaymentTotal) {
    const search = removeTerms(words, new Set([
      ...DEBT_PAYMENT_HISTORY_TERMS, 'total', 'jumlah', 'semua', 'seluruh',
      'hari', 'ini', 'kemarin', 'kemaren', 'minggu', 'bulan', 'tahun', 'lalu',
      'periode', 'berapa', 'nominal', 'yang', 'sudah', 'telah'
    ]))
    return {
      kind: 'query',
      query: 'cashbook',
      args: {
        type: 'income',
        ...(search ? { search } : {}),
        period: queryPeriod(normalized) || 'semua'
      }
    }
  }
  if (asksDebtPaymentHistory) {
    const customer = removeTerms(words, DEBT_PAYMENT_HISTORY_TERMS)
    return {
      kind: 'query',
      query: 'debt_payments',
      args: customer ? { customer } : {}
    }
  }

  const asksRestockForecast = words.some((word) => ['rekomendasi', 'perkiraan', 'estimasi'].includes(word))
    && words.some((word) => ['restok', 'restock', 'stok'].includes(word))
  if (asksRestockForecast) {
    return {
      kind: 'query',
      query: 'operational_insights',
      args: { includeRestock: true }
    }
  }

  if (words.some((word) => WRITE_TERMS.has(word))) return null

  if (words.some((word) => DEBT_TERMS.has(word))) {
    const customer = removeTerms(words, new Set([...DEBT_TERMS, ...DEBT_QUESTION_TERMS]))
    const asksCustomerCount = words.some((word) => ['pelanggan', 'customer'].includes(word))
      && (words.includes('banyak') || words.includes('jumlah'))
    return {
      kind: 'query',
      query: 'debts',
      args: {
        ...(customer ? { customer } : {}),
        ...(asksCustomerCount ? { answerMode: 'count' } : {})
      }
    }
  }

  const period = queryPeriod(normalized)
  const comparisonPeriod = /\b(?:hari ini|minggu ini|bulan ini|tahun ini)\b/.exec(normalized)?.[0]
    || period
  const asksSalesComparison = words.some((word) =>
    ['bandingkan', 'dibanding', 'dibandingkan', 'perbandingan', 'tren', 'trend', 'anomali', 'vs', 'naik', 'turun'].includes(word)
  ) && words.some((word) => ['penjualan', 'omzet', 'omset', 'pendapatan', 'sales'].includes(word))
  if (asksSalesComparison) {
    return {
      kind: 'query',
      query: 'sales_trend',
      args: comparisonPeriod ? { period: comparisonPeriod } : {}
    }
  }

  const asksCombinedProductStock = words.some((word) => PERFORMANCE_TERMS.has(word))
    && words.some((word) => STOCK_TERMS.has(word))
    && words.some((word) => ['menipis', 'rendah', 'sedikit', 'tipis', 'minim'].includes(word))
  if (asksCombinedProductStock) {
    return {
      kind: 'query',
      query: 'product_stock_performance',
      args: period ? { period } : {}
    }
  }

  const asksInventoryValue = words.includes('nilai')
    && (words.some((word) => [...STOCK_TERMS, 'persediaan', 'inventaris', 'aset'].includes(word))
      || words.includes('modal')
        && !words.some((word) => ['keuangan', 'kas', 'pemasukan', 'pengeluaran', 'untung', 'rugi'].includes(word)))
  if (asksInventoryValue) {
    return { kind: 'query', query: 'inventory_summary', args: {} }
  }

  const financeTerms = new Set([
    'kas', 'keuangan', 'pemasukan', 'pengeluaran', 'modal', 'biaya',
    'income', 'expense', 'catatan', 'buku'
  ])
  const cashbookSearchTerms = new Set([
    ...financeTerms, 'apa', 'saja', 'daftar', 'tampilkan', 'lihat', 'cari',
    'tolong', 'dong', 'terakhir', 'terbaru', 'riwayat', 'detail', 'rincian',
    'hari', 'ini', 'kemarin', 'kemaren', 'minggu', 'bulan', 'lalu',
    'tahun', 'semua', 'seluruh', 'sepanjang', 'periode', 'dari', 'untuk',
    'tanggal', 'berapa', 'jumlah', 'total', 'saldo', 'bersih', 'ada', 'apakah',
    'pernah', 'sudah', 'yang', 'belum', 'diisi', 'tertunda', 'pending',
    'lunas', 'tercatat'
  ])
  const cashbookSearch = removeTerms(words, cashbookSearchTerms)
  const explicitCashbook = words.includes('buku') && words.includes('kas')
    || words.some((word) => ['catatan', 'riwayat', 'daftar', 'detail', 'rincian'].includes(word))
      && words.some((word) => financeTerms.has(word))
  const asksCashbook = explicitCashbook
    || words.some((word) => ['pemasukan', 'pengeluaran', 'biaya', 'income', 'expense'].includes(word))
      && (words.some((word) => ['apa', 'saja', 'catatan', 'terakhir', 'terbaru', 'riwayat'].includes(word))
        || Boolean(cashbookSearch))
  if (asksCashbook) {
    const type = words.some((word) => ['pengeluaran', 'biaya', 'expense'].includes(word))
      ? 'expense'
      : words.some((word) => ['pemasukan', 'income'].includes(word))
        ? 'income'
        : words.includes('modal')
          ? 'capital'
          : ''
    return {
      kind: 'query',
      query: 'cashbook',
      args: {
        ...(type ? { type } : {}),
        ...(cashbookSearch ? { search: cashbookSearch } : {}),
        ...(words.some((word) => ['belum', 'tertunda', 'pending'].includes(word)) ? { pending: true } : {}),
        ...(words.some((word) => ['sudah', 'tercatat', 'lunas'].includes(word)) ? { pending: false } : {}),
        period: period || 'semua'
      }
    }
  }

  const asksProductPerformance = words.some((word) => PERFORMANCE_TERMS.has(word))
    || words.includes('produk') && words.some((word) => ['penjualan', 'omzet', 'omset', 'laba'].includes(word))
  if (asksProductPerformance) {
    const sortBy = words.some((word) => ['laba', 'untung', 'profit'].includes(word))
      ? 'gross_profit'
      : words.some((word) => ['omzet', 'omset', 'pendapatan', 'penjualan'].includes(word))
        ? 'sales'
        : 'quantity'
    const product = removeTerms(words, new Set([
      'produk', 'barang', 'item', 'apa', 'yang', 'paling', 'banyak', 'terbanyak',
      'laku', 'laris', 'terjual', 'performa', 'penjualan', 'omzet', 'omset',
      'pendapatan', 'laba', 'untung', 'profit', 'berapa', 'jumlah', 'total',
      'tertinggi', 'terbesar', 'terendah', 'terkecil', 'dan', 'di', 'pada',
      'hari', 'ini', 'kemarin', 'kemaren', 'minggu', 'bulan', 'tahun', 'lalu',
      ...PERIOD_MONTHS, ...STOCK_TERMS, ...STOCK_QUESTION_TERMS
    ]))
    return {
      kind: 'query',
      query: 'product_performance',
      args: { sortBy, ...(product ? { product } : {}), ...(period ? { period } : {}) }
    }
  }

  const asksPurchaseActivity = words.some((word) => ['beli', 'membeli'].includes(word))
    && words.some((word) => ['ada', 'apakah', 'sudah', 'pernah', 'siapa', 'berapa'].includes(word))
  const asksTransactions = words.some((word) => ['transaksi', 'transaksinya', 'nota', 'invoice', 'faktur'].includes(word))
    || asksPurchaseActivity
  if (asksTransactions) {
    const customerTerms = new Set([
      'berapa', 'ada', 'apakah', 'sudah', 'belum', 'pernah', 'cek', 'tolong',
      'dong', 'lihat', 'cari', 'tampilkan', 'daftar', 'riwayat', 'semua',
      'seluruh', 'jumlah', 'total', 'transaksi', 'transaksinya', 'bertransaksi',
      'nota', 'invoice', 'faktur', 'produk', 'barang', 'beli', 'membeli', 'pelanggan', 'customer', 'milik', 'atas',
      'nama', 'yang', 'di', 'pada', 'kapan', 'terjadi', 'terjadinya', 'detail',
      'rincian', 'pembayaran', 'cicilan', 'dp', 'dibayar', 'isi',
      'hari', 'ini', 'kemarin', 'kemaren', 'minggu', 'bulan', 'tahun',
      'sekarang', 'tadi', 'saja', 'terakhir', 'terbaru', 'paling', 'baru',
      'kredit', 'tunai', 'cash', 'lunas', 'lunasnya', 'utang', 'hutang',
      'sisa', 'menunggak', 'belum', 'dibayar', 'by', 'nomor', 'no'
    ])
    const hasItemOrInvoiceSearch = words.some((word) => ['produk', 'barang', 'invoice', 'faktur'].includes(word))
    const customer = hasItemOrInvoiceSearch ? '' : removeTerms(words, customerTerms)
    const search = hasItemOrInvoiceSearch ? removeTerms(words, customerTerms) : ''
    const asksExistence = words.some((word) => ['apakah', 'ada', 'sudah', 'pernah'].includes(word))
    const asksCount = words.some((word) => ['berapa', 'jumlah', 'total'].includes(word))
    const asksLatest = words.some((word) => ['terakhir', 'terbaru', 'tadi', 'kapan'].includes(word))
    const asksDetails = words.some((word) =>
      ['detail', 'rincian', 'pembayaran', 'cicilan', 'dp', 'dibayar', 'barang', 'produk', 'item'].includes(word)
    )
    const paymentType = words.some((word) => ['kredit', 'hutang', 'utang'].includes(word))
      ? 'credit'
      : words.some((word) => ['tunai', 'cash'].includes(word))
        ? 'cash'
        : ''
    const unpaidOnly = words.some((word) => ['menunggak', 'sisa'].includes(word))
      || words.includes('belum') && words.some((word) => ['lunas', 'dibayar'].includes(word))
    return {
      kind: 'query',
      query: 'transactions',
      args: {
        ...(customer ? { customer } : {}),
        ...(search ? { search } : {}),
        ...(period ? { period } : {}),
        ...(paymentType ? { paymentType } : {}),
        ...(unpaidOnly ? { unpaidOnly: true } : {}),
        ...(asksDetails ? { includeDetails: true } : {}),
        ...(asksExistence ? { answerMode: asksCount ? 'count' : 'existence' } : {}),
        ...(asksCount ? { answerMode: 'count' } : {}),
        ...(asksLatest ? { answerMode: 'latest' } : {})
      }
    }
  }

  const asksPurchases = words.some((word) => ['pembelian', 'belanja'].includes(word))
    || words.some((word) => ['beli', 'membeli'].includes(word))
      && words.some((word) => ['bahan', 'barang', 'vendor', 'pemasok'].includes(word))
  if (asksPurchases) {
    const purchaseTerms = new Set([
      'berapa', 'ada', 'apakah', 'sudah', 'belum', 'pernah', 'jumlah', 'total',
      'terakhir', 'terbaru', 'tadi', 'kapan', 'cek', 'lihat', 'cari', 'tampilkan',
      'daftar', 'riwayat', 'semua', 'seluruh', 'pembelian', 'belanja', 'beli',
      'membeli', 'catatan', 'dari', 'untuk', 'ke', 'vendor', 'pemasok', 'bahan',
      'barang', 'tanggal', 'hari', 'ini', 'kemarin', 'kemaren', 'minggu', 'bulan',
      'tahun', 'lalu', 'sekarang', 'yang', 'di', 'pada'
    ])
    const search = removeTerms(words, purchaseTerms)
    const asksCount = words.some((word) => ['berapa', 'jumlah', 'total'].includes(word))
    const asksExistence = words.some((word) => ['ada', 'apakah', 'sudah', 'belum', 'pernah'].includes(word))
    const asksLatest = words.some((word) => ['terakhir', 'terbaru', 'tadi', 'kapan'].includes(word))
    const vendor = words.some((word) => ['vendor', 'pemasok'].includes(word)) ? search : ''
    return {
      kind: 'query',
      query: 'purchases',
      args: {
        ...(vendor ? { vendor } : search ? { search } : {}),
        ...(period ? { period } : {}),
        ...(asksCount ? { answerMode: 'count' } : {}),
        ...(asksExistence && !asksCount ? { answerMode: 'existence' } : {}),
        ...(asksLatest ? { answerMode: 'latest' } : {})
      }
    }
  }

  const productCatalogTerms = new Set([
    'produk', 'barang', 'item', ...STOCK_TERMS, 'kategori', 'category',
    'daftar', 'list', 'cari', 'tampilkan', 'dalam'
  ])
  const asksProductCatalog = words.some((word) => ['produk', 'barang', 'item'].includes(word))
    && (words.some((word) => ['kategori', 'category'].includes(word))
      || words.some((word) => ['daftar', 'list', 'cari', 'tampilkan'].includes(word))
        && !words.some((word) => STOCK_TERMS.has(word)))
  if (asksProductCatalog) {
    const product = removeTerms(words, new Set([
      ...productCatalogTerms, ...STOCK_QUESTION_TERMS,
      'stok', 'stock', 'persediaan', 'nama', 'semua', 'seluruh', 'di', 'toko'
    ]))
    return {
      kind: 'query',
      query: 'stock',
      args: product ? { product } : {}
    }
  }

  const asksCustomerContact = words.some((word) =>
    ['telepon', 'telp', 'nomor', 'no', 'hp', 'alamat', 'kontak'].includes(word)
  )
  const asksCatalogCount = words.some((word) => ['berapa', 'jumlah', 'total'].includes(word))
    && words.some((word) => ['pelanggan', 'customer', 'vendor', 'pemasok', 'ekspedisi', 'kategori', 'satuan'].includes(word))
  if (asksCustomerContact || asksCatalogCount
    || words.some((word) => ['pelanggan', 'customer', 'vendor', 'pemasok', 'ekspedisi', 'kategori', 'satuan'].includes(word))) {
    const catalog = words.some((word) => ['vendor', 'pemasok'].includes(word))
      ? 'vendors'
      : words.includes('ekspedisi')
        ? 'expeditions'
        : words.includes('kategori')
          ? 'categories'
          : words.includes('satuan')
            ? 'units'
            : 'customers'
    const listTerms = new Set([
      'daftar', 'list', 'semua', 'seluruh', 'nama', 'data', 'tampilkan',
      'lihat', 'cari', 'siapa', 'berapa', 'jumlah', 'total', 'pelanggan',
      'customer', 'vendor', 'pemasok', 'ekspedisi', 'kategori', 'satuan',
      'yang', 'ada', 'di', 'toko', 'tolong', 'dong', 'berapa', 'nomor',
      'no', 'telepon', 'telp', 'hp', 'alamat', 'kontak', 'apa', 'untuk',
      'milik', 'punya', 'dari', 'nya', 'dan'
    ])
    const search = removeTerms(words, listTerms)
    return {
      kind: 'query',
      query: catalog,
      args: {
        ...(search ? { search } : {}),
        ...(asksCustomerContact ? { includeDetails: true } : {}),
        ...(asksCatalogCount ? { answerMode: 'count' } : {})
      }
    }
  }

  const asksProductCost = words.includes('hpp')
    || words.includes('modal')
    || (words.includes('pokok') && words.includes('harga'))
    || (words.includes('harga') && words.includes('modal'))
  if (asksProductCost) {
    const product = removeTerms(words, new Set([
      ...STOCK_TERMS, ...STOCK_QUESTION_TERMS,
      'harga', 'harganya', 'hpp', 'modal', 'pokok', 'produk', 'barang', 'item'
    ]))
    return {
      kind: 'query',
      query: 'stock',
      args: {
        ...(product ? { product } : {}),
        includeCost: true
      }
    }
  }

  const asksSalesSummary = words.some((word) =>
    ['penjualan', 'omzet', 'omset', 'pendapatan', 'laba', 'ringkasan', 'ringkas', 'rekap', 'summary'].includes(word)
  )
  const asksCashFlow = words.some((word) =>
    ['pemasukan', 'pengeluaran', 'biaya', 'income', 'expense'].includes(word)
  )
  const asksFinance = words.some((word) =>
    ['keuangan', 'kas', 'saldo', 'modal', 'untung', 'rugi'].includes(word)
  ) || asksCashFlow
  if (asksCashFlow && !words.some((word) => ['penjualan', 'omzet', 'omset', 'laba'].includes(word))) {
    return {
      kind: 'query',
      query: 'finance_summary',
      args: period ? { period } : {}
    }
  }
  if (asksSalesSummary || asksFinance) {
    const asksFinanceOnly = words.some((word) => ['keuangan', 'kas', 'saldo', 'modal', 'untung', 'rugi'].includes(word))
      && !words.some((word) => ['penjualan', 'omzet', 'omset'].includes(word))
    return {
      kind: 'query',
      query: asksFinanceOnly ? 'finance_summary' : 'daily_summary',
      args: period ? { period } : {}
    }
  }

  const inventorySearch = removeTerms(words, new Set([
    ...STOCK_TERMS, ...STOCK_QUESTION_TERMS, 'produk', 'jumlah', 'total',
    'nilai', 'aset', 'inventaris', 'persediaan'
  ]))
  if (words.some((word) => ['berapa', 'jumlah', 'total', 'nilai', 'aset', 'persediaan', 'inventaris'].includes(word))
    && words.some((word) => ['produk', 'stok', 'persediaan', 'inventaris', 'aset'].includes(word))
    && !inventorySearch) {
    return { kind: 'query', query: 'inventory_summary', args: {} }
  }

  const asksStock = words.some((word) => STOCK_TERMS.has(word))
  const asksCost = words.includes('hpp')
    || words.includes('modal')
    || (words.includes('pokok') && words.includes('harga'))
    || (words.includes('harga') && words.includes('modal'))
  const asksPrice = words.includes('harga') || words.includes('harganya')
  if (!asksStock && !asksCost && !asksPrice) return null

  const asksLowestStock = words.some((word) =>
    ['sedikit', 'minim', 'minimum', 'rendah', 'menipis', 'terendah', 'terkecil', 'low', 'lowest'].includes(word)
  )
  const asksLowStockOnly = words.some((word) => ['menipis', 'rendah', 'minimum', 'low'].includes(word))
  const asksHighestStock = words.some((word) =>
    ['banyak', 'terbanyak', 'tinggi', 'tertinggi', 'terbesar', 'high', 'highest'].includes(word)
  )
  if (asksLowestStock && asksHighestStock) return null

  const product = removeTerms(words, new Set([...STOCK_TERMS, ...STOCK_QUESTION_TERMS]))
  return {
    kind: 'query',
    query: 'stock',
    args: {
      ...(product ? { product } : {}),
      ...(asksLowestStock ? { stockOrder: 'asc' } : {}),
      ...(asksHighestStock ? { stockOrder: 'desc' } : {}),
      ...(asksLowStockOnly ? { lowStockOnly: true } : {}),
      ...(asksCost ? { includeCost: true } : {})
    }
  }
}

export function resolveFallbackQuery(message, assistantPlan, hasAttachment = false) {
  if (hasAttachment || assistantPlan?.kind === 'action') return null
  const verifiedQuery = resolveDirectQuery(message)
  if (verifiedQuery) {
    if (assistantPlan?.kind === 'query'
      && assistantPlan.query === verifiedQuery.query
      && JSON.stringify(sortQueryArgs(assistantPlan.args || {})) === JSON.stringify(sortQueryArgs(verifiedQuery.args))) {
      return null
    }
    return verifiedQuery
  }
  if (!['reply', 'error'].includes(assistantPlan?.kind)) return null
  const { words } = normalizeMessage(message)
  const nonDataQuestionTerms = new Set([
    'bagaimana', 'cara', 'kenapa', 'mengapa', 'fungsi', 'sebaiknya',
    'rekomendasi', 'prediksi', 'bandingkan', 'perlu', 'harus', 'butuh',
    'strategi', 'analisis'
  ])
  if (words.some((word) => nonDataQuestionTerms.has(word))) return null
  return resolveFastQuery(message)
}

function sortQueryArgs(value) {
  if (Array.isArray(value)) return value.map(sortQueryArgs)
  if (!value || typeof value !== 'object') return value
  return Object.keys(value).sort().reduce((sorted, key) => {
    sorted[key] = sortQueryArgs(value[key])
    return sorted
  }, {})
}

export function resolveDirectQuery(message, hasAttachment = false) {
  if (hasAttachment) return null

  const { words } = normalizeMessage(message)
  const plan = resolveFastQuery(message)
  if (!plan) return null
  if (plan.query === 'operational_insights'
    || plan.query === 'sales_trend'
    || plan.query === 'product_stock_performance') return plan

  const ambiguousTerms = new Set([
    'bagaimana', 'kenapa', 'mengapa', 'sebaiknya', 'rekomendasi', 'prediksi',
    'bandingkan', 'perlu', 'harus', 'butuh', 'strategi', 'analisis'
  ])
  if (words.some((word) => ambiguousTerms.has(word))) return null

  const hasStockAnchor = words.some((word) => STOCK_TERMS.has(word))
    || words.some((word) => ['hpp', 'modal'].includes(word))
    || words.some((word) => ['produk', 'barang', 'item'].includes(word))
      && words.some((word) => ['kategori', 'category', 'daftar', 'list', 'cari', 'tampilkan'].includes(word))
  const hasPerformanceAnchor = words.some((word) =>
    PERFORMANCE_TERMS.has(word)
  ) || words.includes('produk') && words.some((word) =>
    ['penjualan', 'omzet', 'omset', 'laba'].includes(word)
  )
  if (plan.query === 'sales_trend' && hasPerformanceAnchor) return plan
  if (plan.query === 'product_stock_performance' && hasPerformanceAnchor && hasStockAnchor) return plan
  const hasOtherDataAnchor = words.some((word) =>
    [...DEBT_TERMS, 'transaksi', 'transaksinya', 'nota', 'pembelian', 'belanja'].includes(word)
  )
  if (hasPerformanceAnchor && (hasStockAnchor || hasOtherDataAnchor)) return null

  const directIntents = new Set([
    'debts', 'debt_payments', 'cashbook', 'inventory_summary', 'daily_summary', 'finance_summary',
    'product_performance', 'operational_insights', 'sales_trend', 'product_stock_performance',
    'transactions', 'purchases', 'customers',
    'vendors', 'expeditions', 'categories', 'units'
  ])

  if (plan.query === 'stock') return hasStockAnchor ? plan : null
  if (directIntents.has(plan.query)) return plan

  return null
}
