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
const DEBT_TERMS = new Set(['hutang', 'hutangnya', 'piutang', 'piutangnya'])
const DEBT_QUESTION_TERMS = new Set([
  'berapa', 'sisa', 'sisanya', 'tersisa', 'total', 'jumlah', 'cek', 'lihat',
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

function normalizeMessage(message) {
  const normalized = String(message || '')
    .normalize('NFKC')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
  return { normalized, words: normalized.split(/\s+/).filter(Boolean) }
}

function queryPeriod(normalized) {
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
  const asksDebtPaymentHistory = words.some((word) => DEBT_TERMS.has(word))
    && words.some((word) => ['pembayaran', 'cicilan', 'pelunasan', 'terakhir', 'terbaru', 'kapan'].includes(word))
  if (asksDebtPaymentHistory) {
    const customer = removeTerms(words, DEBT_PAYMENT_HISTORY_TERMS)
    return {
      kind: 'query',
      query: 'debt_payments',
      args: customer ? { customer } : {}
    }
  }

  if (words.some((word) => WRITE_TERMS.has(word))) return null

  if (words.some((word) => DEBT_TERMS.has(word))) {
    const customer = removeTerms(words, new Set([...DEBT_TERMS, ...DEBT_QUESTION_TERMS]))
    return {
      kind: 'query',
      query: 'debts',
      args: customer ? { customer } : {}
    }
  }

  const period = queryPeriod(normalized)
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
    return {
      kind: 'query',
      query: 'product_performance',
      args: { sortBy, ...(period ? { period } : {}) }
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
      'milik', 'punya', 'dari', 'nya'
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

  const asksDaily = words.some((word) =>
    ['penjualan', 'omzet', 'omset', 'pemasukan', 'pengeluaran', 'laba', 'ringkasan'].includes(word)
  )
  const asksFinance = words.some((word) => ['keuangan', 'kas'].includes(word))
  if (asksDaily || asksFinance) {
    const asksFinanceOnly = words.some((word) => ['keuangan', 'kas', 'modal'].includes(word))
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
  const asksCost = words.includes('hpp') || words.includes('modal')
    || words.includes('pokok') && words.includes('harga')
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
  if (hasAttachment || assistantPlan?.kind !== 'reply') return null
  return resolveFastQuery(message)
}

export function resolveDirectQuery(message, hasAttachment = false) {
  if (hasAttachment) return null

  const { words } = normalizeMessage(message)
  const plan = resolveFastQuery(message)
  if (!plan) return null

  const ambiguousTerms = new Set([
    'bagaimana', 'kenapa', 'mengapa', 'sebaiknya', 'rekomendasi', 'prediksi',
    'bandingkan', 'perlu', 'harus', 'butuh', 'strategi', 'analisis'
  ])
  if (words.some((word) => ambiguousTerms.has(word))) return null

  const hasStockAnchor = words.some((word) => STOCK_TERMS.has(word))
    || words.some((word) => ['hpp', 'modal'].includes(word))
  const hasPerformanceAnchor = words.some((word) =>
    PERFORMANCE_TERMS.has(word)
  ) || words.includes('produk') && words.some((word) =>
    ['penjualan', 'omzet', 'omset', 'laba'].includes(word)
  )
  const hasOtherDataAnchor = words.some((word) =>
    [...DEBT_TERMS, 'transaksi', 'transaksinya', 'nota', 'pembelian', 'belanja'].includes(word)
  )
  if (hasPerformanceAnchor && (hasStockAnchor || hasOtherDataAnchor)) return null

  const directIntents = new Set([
    'debts', 'debt_payments', 'cashbook', 'inventory_summary', 'daily_summary', 'finance_summary',
    'product_performance', 'transactions', 'purchases', 'customers',
    'vendors', 'expeditions', 'categories', 'units'
  ])

  if (plan.query === 'stock') return hasStockAnchor ? plan : null
  if (directIntents.has(plan.query)) return plan

  return null
}
