import { getAll, getDashboardData, getFinanceData, getPurchaseEntries, getTransactionPayments, getTransactionSummary } from '../db'
import { formatPurchaseNote, parsePurchaseNote } from '../purchaseNote'
import { dateRangeTimestamps, localDateValue } from '../dateFilter'
import { isSafeRupiahAmount } from '../money'
import { filterCustomerDebts } from './customerDebt'
import {
  purchaseCostPerPiece,
  saleMarkupPrice,
  saleUnitPrice,
  saleUnits,
  stockInPcs,
  stockLabel,
  stockEntryUnit,
  isWholeStockQuantity,
  saleMarkupPercentage,
  unitFactor,
  quantityToPcs
} from '../productUnits'

const PAGE_SIZE = 100
const PRODUCT_NAME_COLLATOR = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })
const MASTER_ACTIONS = new Map([
  ['add_customer', ['customers', 'Pelanggan']],
  ['add_vendor', ['vendors', 'Vendor']],
  ['add_expedition', ['expeditions', 'Ekspedisi']],
  ['add_category', ['categories', 'Kategori']],
  ['add_unit', ['units', 'Satuan']]
])
const MASTER_EDIT_ACTIONS = new Map([
  ['edit_customer', ['customers', 'Pelanggan']],
  ['edit_vendor', ['vendors', 'Vendor']],
  ['edit_expedition', ['expeditions', 'Ekspedisi']]
])
const MASTER_DELETE_ACTIONS = new Map([
  ['delete_customer', ['customers', 'Pelanggan']],
  ['delete_vendor', ['vendors', 'Vendor']],
  ['delete_expedition', ['expeditions', 'Ekspedisi']],
  ['delete_category', ['categories', 'Kategori']],
  ['delete_unit', ['units', 'Satuan']]
])

function isAutomaticFinanceEntry(entry) {
  const category = String(entry.category || '').trim().toLocaleLowerCase('id-ID')
  const note = String(entry.note || '')
  return entry.refId != null
    || entry.requestId != null
    || ['penjualan', 'dp kredit', 'cicilan kredit', 'pembelian bahan produksi'].includes(category)
    || note.startsWith('Penjualan ·')
    || note.startsWith('Cicilan transaksi ')
}

function findFinanceEntry(entries, args) {
  if (args.entry_id != null) {
    const entry = entries.find((candidate) => String(candidate.id) === String(args.entry_id))
    if (!entry) throw new Error('Catatan keuangan tidak ditemukan.')
    return entry
  }
  const search = String(args.category || args.search || args.note || '').trim().toLocaleLowerCase('id-ID')
  if (!search) throw new Error('Sebutkan kategori/catatan atau nomor catatan keuangan.')
  const matches = entries.filter((entry) =>
    [entry.category, entry.note].some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(search))
  )
  if (matches.length === 0) throw new Error('Catatan keuangan yang sesuai tidak ditemukan.')
  if (matches.length > 1) throw new Error('Ada beberapa catatan yang cocok. Sertakan tanggal atau nomor catatan agar tidak salah.')
  return matches[0]
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' perlu disebutkan.')
  return value.trim()
}

function amount(value, label, allowZero = false) {
  if (!isSafeRupiahAmount(value, allowZero)) {
    throw new Error(label + ' harus berupa Rupiah utuh' + (allowZero ? ' nol atau lebih.' : ' lebih dari Rp0.'))
  }
  return Number(value)
}

function positiveQuantity(value, label = 'Jumlah') {
  const quantity = Number(value)
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error(label + ' harus bilangan bulat lebih dari nol.')
  return quantity
}

function findByName(rows, name, label) {
  const cleanName = text(name, label)
  const exact = rows.find((row) => row.name.toLocaleLowerCase('id-ID') === cleanName.toLocaleLowerCase('id-ID'))
  if (exact) return exact
  const matches = rows.filter((row) => row.name.toLocaleLowerCase('id-ID').includes(cleanName.toLocaleLowerCase('id-ID')))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) throw new Error('Nama ' + label.toLocaleLowerCase('id-ID') + ' cocok dengan beberapa pilihan: ' + matches.map((row) => row.name).join(', ') + '. Sebutkan nama yang lebih spesifik.')
  throw new Error(label + ' "' + cleanName + '" tidak ditemukan.')
}

function dateRangeForQuery(args = {}) {
  const today = localDateValue(new Date())
  const range = String(args.period || '').toLocaleLowerCase('id-ID')
  if (range.includes('bulan')) {
    if (range.includes('lalu') || range.includes('kemarin')) {
      const current = new Date()
      return {
        from: localDateValue(new Date(current.getFullYear(), current.getMonth() - 1, 1)),
        to: localDateValue(new Date(current.getFullYear(), current.getMonth(), 0))
      }
    }
    const current = new Date()
    return {
      from: localDateValue(new Date(current.getFullYear(), current.getMonth(), 1)),
      to: localDateValue(new Date(current.getFullYear(), current.getMonth() + 1, 0))
    }
  }
  if (range.includes('tahun')) {
    const current = new Date()
    const year = current.getFullYear() - (range.includes('lalu') || range.includes('kemarin') ? 1 : 0)
    return {
      from: localDateValue(new Date(year, 0, 1)),
      to: localDateValue(new Date(year, 11, 31))
    }
  }
  if (range.includes('minggu')) {
    const current = new Date()
    const mondayOffset = (current.getDay() + 6) % 7
    const monday = new Date(current.getFullYear(), current.getMonth(), current.getDate() - mondayOffset)
    return { from: localDateValue(monday), to: today }
  }
  if (range.includes('kemarin')) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const date = localDateValue(yesterday)
    return { from: date, to: date }
  }
  if (typeof args.from === 'string' || typeof args.to === 'string') {
    return { from: args.from || '', to: args.to || '' }
  }
  return { from: today, to: today }
}

function formatStockQuery(product) {
  return {
    name: product.name,
    category: product.category || 'Umum',
    unit: product.unit || 'pcs',
    stock: stockLabel(product),
    stock_pcs: stockInPcs(product),
    average_cost: Number(product.cost) || 0,
    hpp: Object.fromEntries(
      saleUnits(product.unit || 'pcs').map((unit) => [unit, (Number(product.cost) || 0) * unitFactor(unit)])
    ),
    sale_prices: Object.fromEntries(
      saleUnits(product.unit || 'pcs').map((unit) => [unit, saleUnitPrice(product, unit)])
    )
  }
}

function financeEntryCustomerName(entry) {
  if (entry.type !== 'income') return ''
  const note = String(entry.note || '').trim()
  const manualPaymentPrefix = 'Cicilan kredit pelanggan · '
  if (note.startsWith(manualPaymentPrefix)) return note.slice(manualPaymentPrefix.length).trim()
  if (note.startsWith('Cicilan transaksi ')) {
    const separatorIndex = note.lastIndexOf(' · ')
    if (separatorIndex !== -1) return note.slice(separatorIndex + 3).trim()
  }
  return ''
}

function matchesCashbookEntry(entry, { type, search, pending }) {
  if (type && entry.type !== type) return false
  if (typeof pending === 'boolean' && Boolean(entry.pending) !== pending) return false
  const query = String(search || '').trim().toLocaleLowerCase('id-ID')
  if (!query) return true
  return [entry.category, entry.note, financeEntryCustomerName(entry)]
    .some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(query))
}

export async function queryStore(intent, args = {}) {
  if (intent === 'inventory_summary') {
    const products = await getAll('products')
    return {
      title: 'Ringkasan persediaan saat ini',
      data: {
        product_count: products.length,
        low_stock_count: products.filter((product) =>
          Math.floor(stockInPcs(product) / unitFactor(product.unit || 'pcs')) <= 5
        ).length,
        total_asset: products.reduce((total, product) =>
          total + (Number(product.stock_cost_value) || (Number(product.cost) || 0) * stockInPcs(product)), 0
        )
      }
    }
  }

  if (intent === 'stock' || intent === 'products') {
    const products = await getAll('products')
    const query = String(args.product || args.search || '').trim().toLocaleLowerCase('id-ID')
    const stockOrder = ['asc', 'desc'].includes(args.stockOrder) ? args.stockOrder : ''
    const matches = products
      .filter((product) => !query || (product.name + ' ' + (product.category || '')).toLocaleLowerCase('id-ID').includes(query))
      .filter((product) => !args.lowStockOnly
        || Math.floor(stockInPcs(product) / unitFactor(product.unit || 'pcs')) <= 5)
      .sort((left, right) => stockOrder
        ? (stockOrder === 'asc' ? 1 : -1) * (stockInPcs(left) - stockInPcs(right))
          || PRODUCT_NAME_COLLATOR.compare(left.name, right.name)
        : PRODUCT_NAME_COLLATOR.compare(left.name, right.name))
    return {
      title: 'Data produk dan stok',
      data: {
        total_products: products.length,
        searched_product: String(args.product || args.search || '').trim(),
        matches: matches.slice(0, 40).map(formatStockQuery),
        truncated: matches.length > 40,
        include_cost: args.includeCost === true,
        stock_order: stockOrder,
        low_stock_only: args.lowStockOnly === true
      }
    }
  }

  if (intent === 'debts' || intent === 'finance_summary') {
    const range = intent === 'debts' ? { from: null, to: null } : dateRangeTimestamps(dateRangeForQuery(args))
    const finance = await getFinanceData({ ...range, page: 1, pageSize: PAGE_SIZE })
    const customers = intent === 'debts'
      ? filterCustomerDebts(finance.credit_balances, args.customer)
      : finance.credit_balances
    const debtTotal = args.customer
      ? customers.reduce((total, customer) => total + Number(customer.balance_due || 0), 0)
      : finance.total_credit
    return {
      title: intent === 'debts' ? 'Saldo hutang pelanggan saat ini' : 'Ringkasan keuangan',
      data: intent === 'debts'
        ? {
            total_debt: debtTotal,
            customers,
            ...(args.customer ? { searched_customer: args.customer } : {})
          }
        : {
            income: finance.income,
            expense: finance.expense,
            capital: finance.capital,
            cash_balance: Number(finance.income) + Number(finance.capital) - Number(finance.expense),
            total_debt: finance.total_credit,
            gross_profit: finance.gross_profit,
            net_profit: Number(finance.gross_profit) - Number(finance.expense),
            pending_expedition_count: finance.pending_expedition_count,
            entries: finance.entries.slice(0, 30)
          }
    }
  }

  if (intent === 'debt_payments') {
    const customer = String(args.customer || '').trim()
    if (!customer) {
      return {
        title: 'Riwayat pembayaran hutang pelanggan',
        data: { searched_customer: '', payment: null }
      }
    }

    const normalizedCustomer = customer.toLocaleLowerCase('id-ID')
    let exactPayment = null
    let partialPayment = null
    for (let page = 1; ; page += 1) {
      const finance = await getFinanceData({ from: null, to: null, page, pageSize: PAGE_SIZE })
      const customerPayments = (finance.entries || []).filter((entry) => {
        if (String(entry.category || '').trim().toLocaleLowerCase('id-ID') !== 'cicilan kredit') return false
        const entryCustomer = financeEntryCustomerName(entry).toLocaleLowerCase('id-ID')
        return entryCustomer.includes(normalizedCustomer)
      })
      exactPayment = customerPayments.find((entry) =>
        financeEntryCustomerName(entry).toLocaleLowerCase('id-ID') === normalizedCustomer
      ) || null
      partialPayment ||= customerPayments[0] || null
      if (exactPayment || (finance.entries || []).length < PAGE_SIZE || page * PAGE_SIZE >= Number(finance.total_count || 0)) break
    }

    const payment = exactPayment || partialPayment
    const paymentCustomer = payment ? financeEntryCustomerName(payment) : ''
    return {
      title: 'Riwayat pembayaran hutang pelanggan',
      data: {
        searched_customer: customer,
        payment: payment ? {
          customer_name: paymentCustomer,
          date: payment.date || payment.createdAt || null,
          amount: Number(payment.amount) || 0
        } : null
      }
    }
  }

  if (intent === 'cashbook') {
    const period = String(args.period || 'semua').toLocaleLowerCase('id-ID')
    if (args.type && !['income', 'expense', 'capital'].includes(args.type)) {
      throw new Error('Jenis Buku Kas harus pemasukan, pengeluaran, atau modal.')
    }
    if (args.pending != null && typeof args.pending !== 'boolean') {
      throw new Error('Status catatan tertunda tidak valid.')
    }
    const supportedPeriods = new Set([
      'semua', 'semua waktu', 'all', 'hari ini', 'kemarin',
      'minggu ini', 'bulan ini', 'bulan lalu', 'tahun ini', 'tahun lalu'
    ])
    if (!supportedPeriods.has(period) && !(typeof args.from === 'string' && typeof args.to === 'string')) {
      throw new Error('Periode Buku Kas belum didukung. Sebutkan hari ini, kemarin, minggu ini, bulan ini, bulan lalu, tahun ini, atau rentang tanggal.')
    }
    const range = period === 'semua' || period === 'semua waktu' || period === 'all'
      ? { from: null, to: null }
      : dateRangeTimestamps(typeof args.from === 'string' && typeof args.to === 'string'
        ? { from: args.from, to: args.to }
        : dateRangeForQuery(args))
    const matches = []
    let totalCount = 0
    for (let page = 1; ; page += 1) {
      const finance = await getFinanceData({ ...range, page, pageSize: PAGE_SIZE })
      const pageEntries = finance.entries || []
      totalCount = Number(finance.total_count) || 0
      matches.push(...pageEntries.filter((entry) => matchesCashbookEntry(entry, args)))
      if (pageEntries.length < PAGE_SIZE || page * PAGE_SIZE >= totalCount) break
    }
    const finalized = matches.filter((entry) => !entry.pending)
    const pending = matches.filter((entry) => entry.pending)
    const totals = finalized.reduce((sum, entry) => {
      sum[entry.type] += Number(entry.amount) || 0
      return sum
    }, { income: 0, expense: 0, capital: 0 })
    return {
      title: 'Rincian Buku Kas',
      data: {
        searched_text: String(args.search || '').trim(),
        type: args.type || '',
        period,
        totals,
        net_amount: totals.income + totals.capital - totals.expense,
        matched_count: matches.length,
        pending_count: pending.length,
        entries: matches.slice(0, 30).map((entry) => ({
          date: entry.date || entry.createdAt || null,
          type: entry.type,
          category: entry.category || '',
          note: entry.note || '',
          amount: Number(entry.amount) || 0,
          pending: Boolean(entry.pending)
        })),
        truncated: matches.length > 30
      }
    }
  }

  if (intent === 'daily_summary' || intent === 'sales_summary') {
    const range = dateRangeForQuery(args)
    const timestamps = dateRangeTimestamps(range)
    const [summary, dashboard, finance] = await Promise.all([
      getTransactionSummary(timestamps),
      getDashboardData({
        ...timestamps,
        summaryFrom: timestamps.from,
        summaryTo: timestamps.to,
        page: 1,
        pageSize: PAGE_SIZE,
        creditFirst: false,
        nameSort: 'date'
      }),
      getFinanceData({ ...timestamps, page: 1, pageSize: PAGE_SIZE })
    ])
    return {
      title: range.from === range.to ? 'Ringkasan penjualan ' + range.from : 'Ringkasan penjualan',
      data: {
        date_range: range,
        transaction_count: summary.transaction_count,
        sales_total: summary.total,
        gross_profit: dashboard.gross_profit,
        income: finance.income,
        expense: finance.expense,
        capital: finance.capital,
        cash_balance: Number(finance.income) + Number(finance.capital) - Number(finance.expense),
        customer_debt: finance.total_credit,
        net_profit: Number(dashboard.gross_profit) - Number(finance.expense),
        pending_expedition_count: finance.pending_expedition_count,
        inventory: dashboard.inventory,
        transactions: dashboard.transactions.slice(0, 20).map((transaction) => ({
          invoiceNo: transaction.invoiceNo,
          customerName: transaction.customerName,
          total: transaction.total,
          paymentType: transaction.paymentType,
          balanceDue: transaction.balanceDue,
          createdAt: transaction.createdAt
        }))
      }
    }
  }

  if (intent === 'transactions') {
    const [transactions, customers] = await Promise.all([getAll('transactions'), getAll('customers')])
    const name = String(args.customer || '').trim().toLocaleLowerCase('id-ID')
    const search = String(args.search || args.product || '').trim().toLocaleLowerCase('id-ID')
    const hasDateFilter = Boolean(
      args.from || args.to || args.period && !['semua', 'semua waktu', 'all'].includes(String(args.period).toLocaleLowerCase('id-ID'))
    )
    if (args.paymentType && !['cash', 'credit'].includes(args.paymentType)) {
      throw new Error('Jenis pembayaran transaksi harus tunai atau kredit.')
    }
    if (args.answerMode && !['existence', 'count', 'latest'].includes(args.answerMode)) {
      throw new Error('Jenis jawaban transaksi tidak didukung.')
    }
    const { from, to } = hasDateFilter ? dateRangeTimestamps(dateRangeForQuery(args)) : { from: null, to: null }
    const filtered = transactions
      .filter((transaction) => {
        const time = new Date(transaction.createdAt || 0).getTime()
        const balanceDue = Number(transaction.balanceDue) || Math.max(
          0,
          (Number(transaction.total) || 0) - (Number(transaction.paidAmount ?? transaction.payment) || 0)
        )
        const searchMatches = !search
          || String(transaction.invoiceNo || '').toLocaleLowerCase('id-ID').includes(search)
          || (transaction.items || []).some((item) => String(item.name || '').toLocaleLowerCase('id-ID').includes(search))
        return (!name || String(transaction.customerName || '').toLocaleLowerCase('id-ID').includes(name))
          && (!args.paymentType || transaction.paymentType === args.paymentType)
          && (!args.unpaidOnly || transaction.paymentType === 'credit' && balanceDue > 0)
          && searchMatches
          && (!from || time >= new Date(from).getTime())
          && (!to || time < new Date(to).getTime())
      })
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
    const matchingCount = filtered.length
    const matching = (args.answerMode === 'latest' ? filtered.slice(0, 1) : filtered.slice(0, 30))
    const transactionRows = await Promise.all(matching.map(async (transaction) => ({
      id: transaction.id,
      invoiceNo: transaction.invoiceNo,
      customerName: transaction.customerName,
      customerPhone: transaction.customerPhone || '',
      customerAddress: transaction.customerAddress || '',
      items: transaction.items,
      total: transaction.total,
      paymentType: transaction.paymentType,
      payment: transaction.payment,
      paidAmount: transaction.paidAmount,
      payments: args.includeDetails && transaction.paymentType === 'credit'
        ? await getTransactionPayments(transaction.id)
        : transaction.payments || [],
      balanceDue: transaction.balanceDue,
      change: transaction.change,
      expedition: transaction.expedition || '',
      createdAt: transaction.createdAt
    })))
    return {
      title: 'Riwayat transaksi',
      data: {
        matching_customer: name ? customers.find((customer) => customer.name.toLocaleLowerCase('id-ID').includes(name))?.name || null : null,
        period: args.period || '',
        answer_mode: args.answerMode || '',
        matching_count: matchingCount,
        payment_type: args.paymentType || '',
        unpaid_only: args.unpaidOnly === true,
        include_details: args.includeDetails === true,
        transactions: transactionRows,
        truncated: matchingCount > matching.length
      }
    }
  }

  if (intent === 'product_performance') {
    const transactions = await getAll('transactions')
    const range = dateRangeForQuery(args)
    const { from, to } = dateRangeTimestamps(range)
    const selected = transactions.filter((transaction) => {
      const time = new Date(transaction.createdAt || 0).getTime()
      return (!from || time >= new Date(from).getTime()) && (!to || time < new Date(to).getTime())
    })
    const totals = new Map()
    for (const transaction of selected) {
      for (const item of transaction.items || []) {
        const key = String(item.name || 'Produk tanpa nama')
        const aggregate = totals.get(key) || { name: key, quantity: 0, sales: 0, gross_profit: 0 }
        aggregate.quantity += Number(item.qty) || 0
        aggregate.sales += (Number(item.price) || 0) * (Number(item.qty) || 0)
        aggregate.gross_profit += ((Number(item.price) || 0) - (Number(item.cost) || 0)) * (Number(item.qty) || 0)
        totals.set(key, aggregate)
      }
    }
    const sortBy = ['quantity', 'sales', 'gross_profit'].includes(args.sortBy)
      ? args.sortBy
      : 'quantity'
    return {
      title: 'Performa produk ' + range.from + ' s.d. ' + range.to,
      data: {
        transaction_count: selected.length,
        sort_by: sortBy,
        products: [...totals.values()]
          .sort((left, right) => right[sortBy] - left[sortBy] || PRODUCT_NAME_COLLATOR.compare(left.name, right.name))
          .slice(0, 30)
      }
    }
  }

  if (intent === 'purchases') {
    if (args.answerMode && !['existence', 'count', 'latest'].includes(args.answerMode)) {
      throw new Error('Jenis jawaban pembelian tidak didukung.')
    }
    const search = String(args.search || args.vendor || '').trim().toLocaleLowerCase('id-ID')
    const hasDateFilter = Boolean(
      args.from || args.to || args.period && !['semua', 'semua waktu', 'all'].includes(String(args.period).toLocaleLowerCase('id-ID'))
    )
    const range = hasDateFilter ? dateRangeTimestamps(dateRangeForQuery(args)) : null
    const entries = []
    let totalCount = 0
    for (let page = 1; ; page += 1) {
      const result = await getPurchaseEntries(page, PAGE_SIZE)
      totalCount = result.totalCount
      entries.push(...result.entries.filter((entry) => {
        const time = new Date(entry.date || entry.createdAt || 0).getTime()
        const { purchase, vendor } = parsePurchaseNote(entry.note)
        const matchesSearch = !search || [purchase, vendor, entry.category]
          .some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(search))
        return matchesSearch
          && (!range?.from || time >= new Date(range.from).getTime())
          && (!range?.to || time < new Date(range.to).getTime())
      }))
      if (result.entries.length < PAGE_SIZE || page * PAGE_SIZE >= totalCount) break
    }
    const matchingCount = entries.length
    const selected = args.answerMode === 'latest' ? entries.slice(0, 1) : entries.slice(0, 30)
    return {
      title: 'Riwayat pembelian (dicatat sebagai pengeluaran lunas)',
      data: {
        total_count: totalCount,
        matching_count: matchingCount,
        answer_mode: args.answerMode || '',
        period: args.period || '',
        entries: selected.map((entry) => ({
          ...entry,
          ...parsePurchaseNote(entry.note)
        })),
        truncated: matchingCount > selected.length
      }
    }
  }

  if (['customers', 'vendors', 'expeditions', 'categories', 'units'].includes(intent)) {
    const store = intent
    const rows = await getAll(store)
    const search = String(args.search || '').trim().toLocaleLowerCase('id-ID')
    const entries = rows
      .filter((row) => !search || [row.name, row.phone, row.address]
        .some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(search)))
      .map(({ name, phone, address }) => ({ name, phone, address }))
    return {
      title: 'Daftar ' + intent,
      data: {
        entries,
        matching_count: entries.length,
        searched_text: search,
        include_details: args.includeDetails === true,
        answer_mode: args.answerMode || ''
      }
    }
  }

  throw new Error('Jenis pertanyaan "' + intent + '" belum didukung.')
}

export async function prepareAction(action, args = {}, attachment = null) {
  if (action === 'add_stock') {
    const products = await getAll('products')
    const product = findByName(products, args.product, 'produk')
    const quantity = positiveQuantity(args.quantity, 'Jumlah stok')
    const unit = stockEntryUnit(product.unit || 'pcs')
    if (args.unit && String(args.unit).toLocaleLowerCase('id-ID') !== unit.toLocaleLowerCase('id-ID')) {
      throw new Error('Stok produk "' + product.name + '" dicatat dalam satuan ' + unit + '.')
    }
    const enteredCost = amount(args.unit_cost, 'Harga modal batch', true)
    const quantityPcs = quantityToPcs(quantity, unit)
    const previousPcs = stockInPcs(product)
    if (!Number.isSafeInteger(quantityPcs) || previousPcs + quantityPcs > 2147483647) {
      throw new Error('Jumlah stok melebihi batas yang dapat disimpan.')
    }
    const pricePolicy = args.pricePolicy || 'markup'
    if (!['markup', 'keep', 'replace'].includes(pricePolicy)) {
      throw new Error('Pilihan harga jual tidak valid.')
    }
    const salePricePcs = pricePolicy === 'replace' && saleUnits(product.unit || 'pcs').includes('pcs')
      ? amount(args.sale_price_pcs, 'Harga jual PCS')
      : null
    const salePriceLusin = pricePolicy === 'replace' && saleUnits(product.unit || 'pcs').includes('lusin')
      ? amount(args.sale_price_lusin, 'Harga jual lusin')
      : null
    const salePrice = pricePolicy === 'replace' && !saleUnits(product.unit || 'pcs').includes('pcs')
      ? amount(args.sale_price, 'Harga jual ' + product.unit)
      : null
    return {
      action, title: 'Tambah stok ' + product.name,
      details: [
        'Stok saat ini: ' + stockLabel(product),
        'Penambahan: ' + quantity + ' ' + unit,
        'Harga modal batch: Rp' + enteredCost.toLocaleString('id-ID') + '/' + unit,
        ...(pricePolicy === 'keep'
          ? ['Harga jual dipertahankan: ' + saleUnits(product.unit || 'pcs')
            .map((saleUnit) => saleUnit.toUpperCase() + ' Rp' + saleUnitPrice(product, saleUnit).toLocaleString('id-ID'))
            .join(', ')]
          : []),
        ...(pricePolicy === 'replace'
          ? ['Harga jual baru: ' + saleUnits(product.unit || 'pcs')
            .map((saleUnit) => saleUnit.toUpperCase() + ' Rp' +
              (saleUnit === 'pcs' ? salePricePcs : saleUnit === 'lusin' ? salePriceLusin : salePrice)
                .toLocaleString('id-ID'))
            .join(', ')]
          : []),
        'Stok sesudah: ' + stockLabel({ ...product, stock_pcs: previousPcs + quantityPcs })
      ],
      payload: {
        productId: product.id, quantity, quantityPcs, enteredCost, unit, previousPcs, product,
        pricePolicy, salePricePcs, salePriceLusin, salePrice
      }
    }
  }

  if (action === 'sale') {
    const products = await getAll('products')
    const customers = await getAll('customers')
    const expeditions = await getAll('expeditions')
    const customer = findByName(customers, args.customer, 'pelanggan')
    if (!Array.isArray(args.items) || args.items.length === 0) throw new Error('Daftar barang transaksi belum disebutkan.')
    const items = args.items.map((row) => {
      const product = findByName(products, row.product, 'produk')
      const unit = row.unit || product.unit || 'pcs'
      if (!saleUnits(product.unit || 'pcs').some((option) => option.toLocaleLowerCase('id-ID') === String(unit).toLocaleLowerCase('id-ID'))) {
        throw new Error('Satuan ' + unit + ' tidak tersedia untuk ' + product.name + '.')
      }
      const qty = positiveQuantity(row.quantity, 'Jumlah ' + product.name)
      const price = saleUnitPrice(product, unit)
      const usedPcs = qty * unitFactor(unit)
      if (!isSafeRupiahAmount(price) || stockInPcs(product) < usedPcs) {
        throw new Error('Stok atau harga jual untuk "' + product.name + '" tidak valid/cukup.')
      }
      return { productId: product.id, name: product.name, unit, price, cost: Number(product.cost) * unitFactor(unit), qty, saleUnits: saleUnits(product.unit || 'pcs') }
    })
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
    if (!isSafeRupiahAmount(total)) throw new Error('Total transaksi melebihi batas nominal Rupiah aman.')
    const paymentType = args.payment_type === 'credit' ? 'credit' : args.payment_type === 'cash' ? 'cash' : null
    if (!paymentType) throw new Error('Metode pembayaran harus disebut tunai/cash atau kredit.')
    const paidAmount = amount(args.paid_amount ?? (paymentType === 'cash' ? total : 0), 'Pembayaran', true)
    if ((paymentType === 'cash' && paidAmount < total) || (paymentType === 'credit' && paidAmount > total)) {
      throw new Error(paymentType === 'cash' ? 'Uang tunai kurang dari total transaksi.' : 'Pembayaran awal melebihi total transaksi.')
    }
    const expedition = String(args.expedition || '').trim()
    if (expedition && !expeditions.some((entry) => entry.name === expedition)) {
      throw new Error('Ekspedisi "' + expedition + '" tidak ditemukan di daftar.')
    }
    return {
      action, title: 'Simpan transaksi',
      details: [
        'Pelanggan: ' + customer.name,
        ...items.map((item) => item.name + ' · ' + item.qty + ' ' + item.unit + ' · Rp' + (item.price * item.qty).toLocaleString('id-ID')),
        'Metode: ' + (paymentType === 'cash' ? 'Tunai' : 'Kredit'),
        'Total: Rp' + total.toLocaleString('id-ID'),
        'Dibayar: Rp' + paidAmount.toLocaleString('id-ID'),
        ...(paymentType === 'credit' ? ['Sisa hutang: Rp' + (total - paidAmount).toLocaleString('id-ID')] : []),
        ...(expedition ? ['Ekspedisi: ' + expedition] : [])
      ],
      payload: {
        customer, items, total, paymentType, paidAmount, expedition,
        transaction: {
          customerName: customer.name,
          customerPhone: customer.phone || '',
          customerAddress: customer.address || '',
          expedition,
          paymentType,
          items: items.map(({ productId, name, unit, price, cost, qty }) => ({ productId, name, unit, price, cost, qty })),
          total,
          payment: paidAmount,
          paidAmount: paymentType === 'cash' ? total : paidAmount,
          balanceDue: total - (paymentType === 'cash' ? total : paidAmount),
          payments: [],
          change: paymentType === 'cash' ? paidAmount - total : 0
        }
      }
    }
  }

  if (action === 'credit_payment' || action === 'manual_debt') {
    const customerName = text(args.customer, 'Nama pelanggan')
    const customerRows = await getAll('customers')
    const customer = findByName(customerRows, customerName, 'pelanggan')
    const finance = await getFinanceData({ from: null, to: null, page: 1, pageSize: PAGE_SIZE })
    const balance = Number(finance.credit_balances.find((entry) =>
      entry.customer_name.toLocaleLowerCase('id-ID') === customer.name.toLocaleLowerCase('id-ID')
    )?.balance_due || 0)
    const value = args.amount === 'lunas' || args.amount === 'full' ? balance : amount(args.amount, 'Nominal')
    if (action === 'credit_payment' && (value <= 0 || value > balance)) {
      throw new Error(balance <= 0 ? customer.name + ' tidak memiliki hutang berjalan.' : 'Pembayaran melebihi sisa hutang ' + customer.name + '.')
    }
    if (action === 'manual_debt' && !isSafeRupiahAmount(value)) throw new Error('Hutang baru harus lebih dari Rp0.')
    return {
      action,
      title: action === 'credit_payment' ? 'Catat pembayaran hutang' : 'Tambah hutang pelanggan',
      details: [
        'Pelanggan: ' + customer.name,
        ...(action === 'credit_payment' ? ['Sisa sebelum pembayaran: Rp' + balance.toLocaleString('id-ID')] : []),
        (action === 'credit_payment' ? 'Pembayaran' : 'Hutang') + ': Rp' + value.toLocaleString('id-ID'),
        ...(action === 'credit_payment' ? ['Sisa setelah pembayaran: Rp' + Math.max(0, balance - value).toLocaleString('id-ID')] : [])
      ],
      payload: { customerName: customer.name, amount: value }
    }
  }

  if (action === 'transaction_payment') {
    const invoice = text(args.invoice || args.transaction_id, 'Nomor invoice atau ID transaksi')
    const transactions = await getAll('transactions')
    const matches = transactions.filter((transaction) =>
      String(transaction.id) === invoice
      || String(transaction.invoiceNo || '').toLocaleLowerCase('id-ID') === invoice.toLocaleLowerCase('id-ID')
    )
    if (matches.length !== 1) throw new Error(matches.length ? 'Nomor transaksi cocok dengan beberapa data.' : 'Transaksi tidak ditemukan.')
    const transaction = matches[0]
    if (transaction.paymentType !== 'credit' || Number(transaction.balanceDue) <= 0) {
      throw new Error('Transaksi tersebut tidak memiliki sisa hutang.')
    }
    const paymentAmount = amount(args.amount, 'Nominal cicilan')
    if (paymentAmount > Number(transaction.balanceDue)) throw new Error('Cicilan melebihi sisa hutang transaksi.')
    return {
      action, title: 'Catat cicilan transaksi',
      details: [
        'Invoice: ' + (transaction.invoiceNo || '#' + transaction.id),
        'Pelanggan: ' + transaction.customerName,
        'Sisa sebelum: Rp' + Number(transaction.balanceDue).toLocaleString('id-ID'),
        'Pembayaran: Rp' + paymentAmount.toLocaleString('id-ID'),
        'Sisa setelah: Rp' + (Number(transaction.balanceDue) - paymentAmount).toLocaleString('id-ID')
      ],
      payload: { transaction, amount: paymentAmount }
    }
  }

  if (action === 'finance_entry' || action === 'purchase') {
    const entryAmount = amount(args.amount, 'Nominal')
    const date = args.date || localDateValue(new Date())
    if (dateRangeTimestamps({ from: date, to: date }).from === null) throw new Error('Tanggal tidak valid.')
    if (action === 'purchase') {
      const vendor = findByName(await getAll('vendors'), args.vendor, 'vendor')
      const material = text(args.material, 'Nama pembelian')
      return {
        action, title: 'Catat pembelian bahan',
        details: [
          'Pembelian: ' + material,
          'Vendor: ' + vendor.name,
          'Total: Rp' + entryAmount.toLocaleString('id-ID'),
          'Tanggal: ' + date,
          'Dicatat sebagai pengeluaran lunas; tidak mengubah stok produk.'
        ],
        payload: { material, vendor: vendor.name, amount: entryAmount, date }
      }
    }
    if (!['expense', 'capital'].includes(args.type)) throw new Error('Jenis catatan harus pengeluaran atau modal.')
    return {
      action, title: 'Catat keuangan',
      details: [
        'Jenis: ' + (args.type === 'expense' ? 'Pengeluaran' : 'Modal'),
        'Kategori: ' + text(args.category, 'Kategori'),
        'Nominal: Rp' + entryAmount.toLocaleString('id-ID'),
        'Tanggal: ' + date,
        ...(args.note ? ['Catatan: ' + String(args.note).trim()] : [])
      ],
      payload: { type: args.type, category: text(args.category, 'Kategori'), amount: entryAmount, note: String(args.note || '').trim(), date }
    }
  }

  if (action === 'edit_finance_entry' || action === 'delete_finance_entry') {
    const entries = await getAll('finance')
    const entry = findFinanceEntry(entries, args)
    if (isAutomaticFinanceEntry(entry)) {
      throw new Error('Catatan otomatis tidak dapat diubah/dihapus melalui chat. Cicilan, penjualan, dan biaya ekspedisi harus dikelola melalui alur khusus.')
    }
    if (entry.pending) throw new Error('Biaya ekspedisi belum diisi. Gunakan perintah catat biaya ekspedisi.')
    if (action === 'edit_finance_entry') {
      const update = {}
      if (args.new_category !== undefined) update.category = text(args.new_category, 'Kategori baru')
      if (args.note !== undefined) update.note = String(args.note).trim() || null
      if (args.amount !== undefined) update.amount = amount(args.amount, 'Nominal')
      if (args.date !== undefined) {
        dateRangeTimestamps({ from: args.date, to: args.date })
        update.date = new Date(args.date + 'T12:00:00').toISOString()
      }
      if (!Object.keys(update).length) throw new Error('Sebutkan perubahan catatan yang ingin dilakukan.')
      return {
        action, title: 'Ubah catatan keuangan',
        details: [
          'Catatan: ' + (entry.category || entry.note || '#' + entry.id),
          ...Object.entries(update).map(([key, value]) => key + ': ' + value)
        ],
        payload: { entry, update }
      }
    }
    return {
      action, title: 'Hapus catatan keuangan',
      details: [
        'Catatan: ' + (entry.category || entry.note || '#' + entry.id),
        'Nominal: Rp' + Number(entry.amount).toLocaleString('id-ID'),
        'Tindakan ini tidak dapat dibatalkan.'
      ],
      payload: { entry }
    }
  }

  if (action === 'record_expedition_cost') {
    const finance = await getFinanceData({ from: null, to: null, page: 1, pageSize: PAGE_SIZE })
    const pending = finance.entries.filter((entry) => entry.pending)
    let entry
    if (args.entry_id != null) {
      entry = pending.find((candidate) => String(candidate.id) === String(args.entry_id))
    } else {
      const search = String(args.customer || args.search || '').trim().toLocaleLowerCase('id-ID')
      const matches = pending.filter((candidate) =>
        !search || [candidate.note, candidate.category].some((value) => String(value || '').toLocaleLowerCase('id-ID').includes(search))
      )
      if (matches.length > 1) throw new Error('Ada beberapa biaya ekspedisi yang cocok. Sebutkan pelanggan atau nomor transaksi dengan lebih spesifik.')
      entry = matches[0]
    }
    if (!entry) throw new Error('Biaya ekspedisi tertunda tidak ditemukan.')
    const entryAmount = amount(args.amount, 'Biaya ekspedisi')
    return {
      action, title: 'Lengkapi biaya ekspedisi',
      details: [
        'Catatan: ' + (entry.note || entry.category || '#' + entry.id),
        'Biaya aktual: Rp' + entryAmount.toLocaleString('id-ID')
      ],
      payload: { entry, amount: entryAmount }
    }
  }

  if (action === 'add_product') {
    const name = text(args.name, 'Nama produk')
    const requestedUnit = text(args.unit, 'Satuan produk')
    const units = await getAll('units')
    const selectedUnit = units.find((option) =>
      option.name.toLocaleLowerCase('id-ID') === requestedUnit.toLocaleLowerCase('id-ID')
      && option.name.toLocaleLowerCase('id-ID') !== 'kodi'
    )
    if (!selectedUnit) throw new Error('Satuan "' + requestedUnit + '" belum tersedia. Tambahkan satuan lebih dahulu melalui chat.')
    const unit = selectedUnit.name
    const category = String(args.category || '').trim()
    if (category) {
      const categories = await getAll('categories')
      if (!categories.some((option) => option.name.toLocaleLowerCase('id-ID') === category.toLocaleLowerCase('id-ID'))) {
        throw new Error('Kategori "' + category + '" belum tersedia. Tambahkan kategori lebih dahulu melalui chat.')
      }
    }
    const stockQuantity = Number(args.stock_quantity ?? 0)
    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) throw new Error('Stok awal harus nol atau lebih.')
    const standard = saleUnits(unit).length === 2
    if (stockQuantity > 0 && !isWholeStockQuantity(stockQuantity, stockEntryUnit(unit))) {
      throw new Error('Stok awal harus menghasilkan jumlah PCS utuh.')
    }
    const cost = amount(args.unit_cost, 'Harga modal', !standard)
    const price = standard ? null : amount(args.sale_price, 'Harga jual')
    if (standard && ['pcs', 'lusin'].some((saleUnit) =>
      args['sale_price_' + saleUnit] == null && args['sale_markup_' + saleUnit + '_pct'] == null
    )) {
      throw new Error('Harga jual PCS dan LUSIN perlu disebutkan.')
    }
    const stockUnit = stockEntryUnit(unit)
    const stockPcs = quantityToPcs(stockQuantity, stockUnit)
    if (!Number.isSafeInteger(stockPcs) || stockPcs > 2147483647) throw new Error('Stok awal melebihi batas penyimpanan.')
    const costPerPiece = purchaseCostPerPiece(unit, cost)
    const prices = standard
      ? Object.fromEntries(['pcs', 'lusin'].map((saleUnit) => {
          const directPrice = args['sale_price_' + saleUnit]
          const rawMarkup = args['sale_markup_' + saleUnit + '_pct']
          const hasDirectPrice = directPrice != null && directPrice !== ''
          if (!hasDirectPrice && (rawMarkup == null || rawMarkup === '' || !Number.isFinite(Number(rawMarkup)))) {
            throw new Error('Harga jual atau markup ' + saleUnit + ' harus disebutkan.')
          }
          const markup = Number(rawMarkup)
          return [saleUnit, hasDirectPrice
            ? amount(directPrice, 'Harga jual ' + saleUnit)
            : saleMarkupPrice(costPerPiece, saleUnit, markup)]
        }))
      : { [unit]: price }
    for (const [priceUnit, priceAmount] of Object.entries(prices)) {
      if (!isSafeRupiahAmount(priceAmount)) throw new Error('Harga jual ' + priceUnit + ' harus lebih dari Rp0.')
    }
    const markupPcs = standard
      ? saleMarkupPercentage(prices.pcs, costPerPiece, 'pcs')
      : null
    const markupLusin = standard
      ? saleMarkupPercentage(prices.lusin, costPerPiece, 'lusin')
      : null
    return {
      action, title: 'Tambah produk ' + name,
      details: [
        'Nama: ' + name,
        'Kategori: ' + (category || 'Umum'),
        'Satuan: ' + unit,
        'Stok awal: ' + stockQuantity + ' ' + stockUnit,
        'Modal: Rp' + cost.toLocaleString('id-ID') + '/' + stockUnit,
        ...Object.entries(prices).map(([priceUnit, value]) => 'Harga ' + priceUnit + ': Rp' + value.toLocaleString('id-ID'))
      ],
      payload: {
        record: {
          name, category, unit,
          price: standard ? prices[unit.toLowerCase()] || prices.pcs : price,
          price_pcs: prices.pcs || 0,
          price_lusin: prices.lusin || 0,
          sale_markup_pcs_pct: standard ? markupPcs : null,
          sale_markup_lusin_pct: standard ? markupLusin : null,
          price_kodi: 0,
          cost: costPerPiece,
          stock: stockPcs / unitFactor(unit),
          stock_pcs: stockPcs,
          stock_cost_value: costPerPiece * stockPcs,
          image_path: null
        },
        attachment
      }
    }
  }

  if (action === 'delete_product') {
    const product = findByName(await getAll('products'), args.product || args.name, 'produk')
    return {
      action, title: 'Hapus produk ' + product.name,
      details: ['Produk: ' + product.name, 'Stok saat ini: ' + stockLabel(product), 'Produk dan stoknya akan dihapus.'],
      payload: { product }
    }
  }

  if (MASTER_ACTIONS.has(action)) {
    const [store, label] = MASTER_ACTIONS.get(action)
    const name = text(args.name, 'Nama ' + label.toLocaleLowerCase('id-ID'))
    const rows = await getAll(store)
    if (rows.some((row) => row.name.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID'))) {
      throw new Error(label + ' "' + name + '" sudah ada.')
    }
    return {
      action, title: 'Tambah ' + label.toLocaleLowerCase('id-ID'),
      details: ['Nama baru: ' + name],
      payload: { store, record: store === 'customers'
        ? { name, phone: String(args.phone || '').trim() || null, address: String(args.address || '').trim() || null }
        : { name } }
    }
  }

  if (MASTER_EDIT_ACTIONS.has(action)) {
    const [store, label] = MASTER_EDIT_ACTIONS.get(action)
    const rows = await getAll(store)
    const record = findByName(rows, args.name, label)
    const newName = args.new_name == null ? record.name : text(args.new_name, 'Nama baru')
    if (newName === record.name && args.phone === undefined && args.address === undefined) {
      throw new Error('Sebutkan nama baru atau perubahan nomor telepon/alamat.')
    }
    if (rows.some((row) => row.id !== record.id && row.name.toLocaleLowerCase('id-ID') === newName.toLocaleLowerCase('id-ID'))) {
      throw new Error(label + ' "' + newName + '" sudah ada.')
    }
    return {
      action, title: 'Ubah nama ' + label.toLocaleLowerCase('id-ID'),
      details: [
        'Nama lama: ' + record.name,
        'Nama baru: ' + newName,
        ...(store === 'customers' && args.phone !== undefined ? ['Telepon: ' + (args.phone || 'dihapus')] : []),
        ...(store === 'customers' && args.address !== undefined ? ['Alamat: ' + (args.address || 'dihapus')] : [])
      ],
      payload: { store, record: {
        ...record,
        name: newName,
        ...(store === 'customers' && args.phone !== undefined ? { phone: args.phone == null ? null : String(args.phone).trim() || null } : {}),
        ...(store === 'customers' && args.address !== undefined ? { address: args.address == null ? null : String(args.address).trim() || null } : {})
      } }
    }
  }

  if (MASTER_DELETE_ACTIONS.has(action)) {
    const [store, label] = MASTER_DELETE_ACTIONS.get(action)
    const record = findByName(await getAll(store), args.name, label)
    return {
      action, title: 'Hapus ' + label.toLocaleLowerCase('id-ID'),
      details: ['Nama: ' + record.name, 'Pastikan data ini tidak sedang digunakan.'],
      payload: { store, record }
    }
  }

  if (action === 'backup') {
    return { action, title: 'Buat backup seluruh data toko', details: ['Data dan foto produk akan diarsipkan di Storage toko.'], payload: {} }
  }
  if (action === 'restore_backup') {
    if (!attachment || !/\.zip$/i.test(attachment.name)) throw new Error('Lampirkan file backup ZIP melalui tombol lampiran chat.')
    return {
      action, title: 'Pulihkan backup data toko',
      details: ['File: ' + attachment.name, 'Seluruh data toko saat ini akan diganti. Tindakan ini tidak dapat dibatalkan.'],
      payload: { attachment }
    }
  }
  if (action === 'reset_store') {
    return {
      action, title: 'Reset data toko',
      details: ['Produk, stok, transaksi, keuangan, hutang, pelanggan, vendor, ekspedisi, kategori, dan satuan akan dihapus.', 'Akun, backup, dan foto di Storage tetap dipertahankan.'],
      payload: { requiresTypedConfirmation: true }
    }
  }

  if (action === 'edit_product') {
    const product = findByName(await getAll('products'), args.product || args.name, 'produk')
    const update = {}
    if (args.new_name) update.name = text(args.new_name, 'Nama produk baru')
    if (args.category !== undefined) {
      const category = String(args.category).trim()
      if (category) {
        const categories = await getAll('categories')
        if (!categories.some((option) => option.name.toLocaleLowerCase('id-ID') === category.toLocaleLowerCase('id-ID'))) {
          throw new Error('Kategori "' + category + '" belum tersedia. Tambahkan kategori lebih dahulu melalui chat.')
        }
      }
      update.category = category
    }
    if (args.sale_price !== undefined) {
      const price = amount(args.sale_price, 'Harga jual')
      const unit = String(args.price_unit || product.unit || 'pcs').toLocaleLowerCase('id-ID')
      const baseUnit = String(product.unit || 'pcs').toLocaleLowerCase('id-ID')
      if (!saleUnits(product.unit || 'pcs').some((option) => option.toLocaleLowerCase('id-ID') === unit)) {
        throw new Error('Satuan harga ' + unit + ' tidak tersedia untuk ' + product.name + '.')
      }
      if (unit === 'pcs' || unit === 'lusin') {
        update['price_' + unit] = price
        if (unit === baseUnit) update.price = price
      } else {
        update.price = price
      }
    }
    if (args.sale_markup_pcs_pct !== undefined) {
      const markup = Number(args.sale_markup_pcs_pct)
      if (!Number.isFinite(markup)) throw new Error('Markup PCS tidak valid.')
      update.sale_markup_pcs_pct = markup
      update.price_pcs = saleMarkupPrice(Number(product.cost), 'pcs', markup)
      if (!isSafeRupiahAmount(update.price_pcs)) throw new Error('Markup PCS menghasilkan harga jual yang tidak aman.')
      if (String(product.unit || 'pcs').toLocaleLowerCase('id-ID') === 'pcs') update.price = update.price_pcs
    }
    if (args.sale_markup_lusin_pct !== undefined) {
      const markup = Number(args.sale_markup_lusin_pct)
      if (!Number.isFinite(markup)) throw new Error('Markup LUSIN tidak valid.')
      update.sale_markup_lusin_pct = markup
      update.price_lusin = saleMarkupPrice(Number(product.cost), 'lusin', markup)
      if (!isSafeRupiahAmount(update.price_lusin)) throw new Error('Markup LUSIN menghasilkan harga jual yang tidak aman.')
      if (String(product.unit || 'pcs').toLocaleLowerCase('id-ID') === 'lusin') update.price = update.price_lusin
    }
    if (args.stock_quantity !== undefined) {
      const quantity = Number(args.stock_quantity)
      const stockPcs = quantityToPcs(quantity, 'pcs')
      if (!Number.isSafeInteger(quantity) || quantity < 0 || stockPcs > 2147483647) throw new Error('Stok baru harus berupa PCS utuh nol atau lebih.')
      update.stock_pcs = stockPcs
    }
    if (!Object.keys(update).length) throw new Error('Tidak ada perubahan produk yang disebutkan.')
    if (attachment?.type?.startsWith('image/')) update.image_path = '[uploaded]'
    else if (args.remove_image === true) update.image_path = null
    return {
      action, title: 'Ubah produk ' + product.name,
      details: [
        'Produk: ' + product.name,
        ...Object.entries(update).map(([key, value]) => key + ': ' + value),
        'Perubahan stok memakai modal rata-rata saat ini; modal batch baru harus memakai perintah tambah stok.'
      ],
      payload: { product, update, attachment }
    }
  }

  throw new Error('Tindakan "' + action + '" belum tersedia.')
}

export async function executeAction(draft) {
  const { addManualCustomerCredit, addProductStock, completeSale, createBackupArchive, recordCustomerCreditPayment, remove, removeProductImage, resetStoreData, restoreBackupArchive, updateProductDetails, put } = await import('../db')
  const id = draft.requestId || crypto.randomUUID()

  if (draft.action === 'add_stock') {
    const afterPcs = await addProductStock(
      draft.payload.productId,
      draft.payload.quantityPcs,
      purchaseCostPerPiece(draft.payload.product.unit, draft.payload.enteredCost),
      id,
      {
        mode: draft.payload.pricePolicy,
        price: draft.payload.salePrice,
        pricePcs: draft.payload.salePricePcs,
        priceLusin: draft.payload.salePriceLusin
      }
    )
    const beforePcs = afterPcs - draft.payload.quantityPcs
    return 'Berhasil menambahkan stok "' + draft.payload.product.name + '". Stok sebelumnya ' +
      stockLabel({ ...draft.payload.product, stock_pcs: beforePcs }) + ', ditambah ' +
      draft.payload.quantity + ' ' + draft.payload.unit + ' (' + draft.payload.quantityPcs +
      ' pcs), menjadi ' + stockLabel({ ...draft.payload.product, stock_pcs: afterPcs }) + '.' +
      (draft.payload.pricePolicy === 'keep' ? ' Harga jual lama dipertahankan.' :
        draft.payload.pricePolicy === 'replace' ? ' Harga jual diperbarui sesuai pilihan Anda.' : '')
  }

  if (draft.action === 'sale') {
    const now = new Date().toISOString()
    const transaction = {
      ...draft.payload.transaction,
      payments: draft.payload.paymentType === 'credit' && draft.payload.paidAmount > 0
        ? [{ amount: draft.payload.paidAmount, date: now }]
        : []
    }
    const transactionId = await completeSale(transaction, draft.payload.items, id)
    return {
      text: 'Transaksi #' + transactionId + ' berhasil disimpan. Total Rp' +
        draft.payload.total.toLocaleString('id-ID') + (draft.payload.paymentType === 'credit'
          ? ' · sisa hutang Rp' + (draft.payload.total - draft.payload.paidAmount).toLocaleString('id-ID')
          : ' · tunai'),
      transaction: { ...transaction, id: transactionId, createdAt: now }
    }
  }

  if (draft.action === 'credit_payment') {
    await recordCustomerCreditPayment(draft.payload.customerName, draft.payload.amount, id)
    return 'Pembayaran hutang ' + draft.payload.customerName + ' sebesar Rp' + draft.payload.amount.toLocaleString('id-ID') + ' berhasil dicatat.'
  }
  if (draft.action === 'transaction_payment') {
    const { recordTransactionPayment } = await import('../db')
    await recordTransactionPayment(draft.payload.transaction.id, draft.payload.amount, id)
    return 'Cicilan untuk invoice ' + (draft.payload.transaction.invoiceNo || '#' + draft.payload.transaction.id) +
      ' sebesar Rp' + draft.payload.amount.toLocaleString('id-ID') + ' berhasil dicatat.'
  }
  if (draft.action === 'manual_debt') {
    await addManualCustomerCredit(draft.payload.customerName, draft.payload.amount, id)
    return 'Hutang lama ' + draft.payload.customerName + ' sebesar Rp' + draft.payload.amount.toLocaleString('id-ID') + ' berhasil ditambahkan.'
  }
  if (draft.action === 'finance_entry') {
    await put('finance', {
      type: draft.payload.type,
      category: draft.payload.category,
      note: draft.payload.note || null,
      amount: draft.payload.amount,
      date: new Date(draft.payload.date + 'T12:00:00').toISOString(),
      refId: null,
      requestId: null
    })
    return 'Catatan keuangan berhasil disimpan: ' + draft.payload.category + ' · Rp' + draft.payload.amount.toLocaleString('id-ID') + '.'
  }
  if (draft.action === 'purchase') {
    await put('finance', {
      type: 'expense',
      category: 'Pembelian bahan produksi',
      note: formatPurchaseNote(draft.payload.material, draft.payload.vendor),
      amount: draft.payload.amount,
      date: new Date(draft.payload.date + 'T12:00:00').toISOString(),
      refId: null,
      requestId: null
    })
    return 'Pembelian ' + draft.payload.material + ' dari ' + draft.payload.vendor + ' berhasil dicatat sebagai pengeluaran lunas.'
  }
  if (draft.action === 'edit_finance_entry') {
    await put('finance', { ...draft.payload.entry, ...draft.payload.update })
    return 'Catatan keuangan berhasil diperbarui.'
  }
  if (draft.action === 'delete_finance_entry') {
    await remove('finance', draft.payload.entry.id)
    return 'Catatan keuangan berhasil dihapus.'
  }
  if (draft.action === 'record_expedition_cost') {
    const { recordExpeditionCost } = await import('../db')
    await recordExpeditionCost(draft.payload.entry.id, draft.payload.amount)
    return 'Biaya ekspedisi berhasil dilengkapi dan dicatat sebagai pengeluaran.'
  }
  if (draft.action === 'add_product') {
    const existing = (await getAll('products')).find((product) =>
      product.name.toLocaleLowerCase('id-ID') === draft.payload.record.name.toLocaleLowerCase('id-ID')
    )
    if (existing) {
      throw new Error('Produk dengan nama tersebut sudah ada. Periksa stok produk sebelum mencoba lagi.')
    }
    if (draft.payload.record.category) {
      const categories = await getAll('categories')
      if (!categories.some((category) => category.name.toLocaleLowerCase('id-ID') === draft.payload.record.category.toLocaleLowerCase('id-ID'))) {
        await put('categories', { name: draft.payload.record.category })
      }
    }
    let imagePath = null
    if (draft.payload.attachment) imagePath = await (await import('../db')).uploadProductImage(draft.payload.attachment)
    try {
      await put('products', { ...draft.payload.record, image_path: imagePath })
    } catch (error) {
      if (imagePath) {
        try {
          await removeProductImage(imagePath)
        } catch (cleanupError) {
          throw new Error(error.message + ' Foto yang sudah diunggah juga gagal dibersihkan: ' + cleanupError.message)
        }
      }
      throw error
    }
    return 'Produk "' + draft.payload.record.name + '" berhasil ditambahkan.'
  }
  if (draft.action === 'delete_product') {
    await remove('products', draft.payload.product.id)
    if (draft.payload.product.image_path) {
      try {
        await removeProductImage(draft.payload.product.image_path)
      } catch (error) {
        return 'Produk "' + draft.payload.product.name + '" berhasil dihapus, tetapi foto gagal dihapus: ' + error.message
      }
    }
    return 'Produk "' + draft.payload.product.name + '" dan stoknya berhasil dihapus.'
  }
  if (draft.action.startsWith('add_') && draft.payload.store) {
    await put(draft.payload.store, draft.payload.record)
    return draft.title + ' "' + draft.payload.record.name + '" berhasil disimpan.'
  }
  if (draft.action.startsWith('edit_') && draft.payload.store) {
    await put(draft.payload.store, draft.payload.record)
    return draft.title + ' "' + draft.payload.record.name + '" berhasil disimpan.'
  }
  if (draft.action.startsWith('delete_') && draft.payload.store) {
    await remove(draft.payload.store, draft.payload.record.id)
    return draft.title + ' "' + draft.payload.record.name + '" berhasil dihapus.'
  }
  if (draft.action === 'edit_product') {
    const { product, update } = draft.payload
    const oldImagePath = product.image_path || null
    if (update.image_path === '[uploaded]') {
      const { uploadProductImage } = await import('../db')
      update.image_path = await uploadProductImage(draft.payload.attachment)
    }
    const stockPcs = update.stock_pcs
    delete update.stock_pcs
    if (Object.keys(update).length) {
      try {
        await updateProductDetails(product.id, update)
      } catch (error) {
        if (update.image_path && update.image_path !== oldImagePath) {
          try {
            await removeProductImage(update.image_path)
          } catch (cleanupError) {
            throw new Error(error.message + ' Foto sementara juga gagal dibersihkan: ' + cleanupError.message)
          }
        }
        throw error
      }
    }
    if (Object.hasOwn(update, 'image_path') && update.image_path !== oldImagePath && oldImagePath) {
      try {
        await removeProductImage(oldImagePath)
      } catch (error) {
        return 'Perubahan produk berhasil, tetapi foto lama gagal dihapus: ' + error.message
      }
    }
    if (stockPcs !== undefined) {
      const { setProductStock } = await import('../db')
      await setProductStock(product.id, stockPcs)
    }
    return 'Perubahan produk "' + product.name + '" berhasil disimpan.'
  }
  if (draft.action === 'backup') {
    const result = await createBackupArchive()
    return 'Backup berhasil dibuat. ' + result.recordCount + ' baris data; ukuran ' +
      new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(result.size / 1024 / 1024) + ' MB.'
  }
  if (draft.action === 'restore_backup') {
    const result = await restoreBackupArchive(draft.payload.attachment)
    return 'Backup berhasil dipulihkan: ' + result.recordCount + ' baris data dan ' + result.imageCount + ' foto.' +
      (result.warning ? ' ' + result.warning : '')
  }
  if (draft.action === 'reset_store') {
    await resetStoreData()
    return 'Reset data toko berhasil. Akun, backup, dan foto di Storage tetap dipertahankan.'
  }

  throw new Error('Tindakan ini belum bisa dijalankan melalui chat.')
}
