import { useEffect, useRef, useState } from 'react'
import { getAll, getFinanceData, getFinanceInvoices, put, remove, onRefresh, requestPageRefresh, recordCustomerCreditPayment, addManualCustomerCredit, recordExpeditionCost } from '../db'
import { rupiah, dateOnly, dateTime } from '../format'
import { dateRangeTimestamps, hasDateRange, localDateValue } from '../dateFilter'
import MoneyInput from '../components/MoneyInput.jsx'
import CustomerIdentity from '../components/CustomerIdentity.jsx'
import SelectInput from '../components/SelectInput.jsx'
import Icon from '../components/Icon.jsx'
import ReceiptPreview from '../components/ReceiptPreview.jsx'
import { isSafeRupiahAmount } from '../money'
import LoadingNumber from '../components/LoadingNumber.jsx'
import { getInvoiceNumber } from '../invoice.js'
import { downloadInvoiceJpeg } from '../invoiceJpeg.js'

const TYPES = {
  income: { label: 'Pemasukan', cls: 'badge-ok' },
  expense: { label: 'Pengeluaran', cls: 'badge-danger' },
  capital: { label: 'Modal', cls: 'badge-neutral' }
}
const FINANCE_PAGE_SIZE = 20
const FINANCE_INVOICE_PAGE_SIZE = 20

function getTodayDateRange() {
  const today = localDateValue(new Date())
  return { from: today, to: today }
}

function getCurrentMonthDateRange() {
  const now = new Date()
  return {
    from: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: localDateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  }
}

export default function Finance() {
  const [report, setReport] = useState({
    entries: [],
    total_count: 0,
    income: 0,
    expense: 0,
    capital: 0,
    pending_expedition_count: 0,
    total_credit: 0,
    gross_profit: 0,
    credit_balances: []
  })
  const [dateRange, setDateRange] = useState(getCurrentMonthDateRange)
  const [customers, setCustomers] = useState([])
  const [customerLoadError, setCustomerLoadError] = useState('')
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [showCreditBalances, setShowCreditBalances] = useState(false)
  const [showSalesInvoices, setShowSalesInvoices] = useState(false)
  const [salesInvoices, setSalesInvoices] = useState([])
  const [salesInvoiceCount, setSalesInvoiceCount] = useState(0)
  const [salesInvoicePage, setSalesInvoicePage] = useState(1)
  const [salesInvoicesLoading, setSalesInvoicesLoading] = useState(false)
  const [salesInvoicesError, setSalesInvoicesError] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [invoiceDownloadingId, setInvoiceDownloadingId] = useState(null)
  const [invoiceDownloadError, setInvoiceDownloadError] = useState('')
  const [invoiceDownloadStatus, setInvoiceDownloadStatus] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [entryType, setEntryType] = useState('expense')
  const [entryDate, setEntryDate] = useState(() => localDateValue(new Date()))
  const [entryCategory, setEntryCategory] = useState('')
  const [entryNote, setEntryNote] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [selectedDebt, setSelectedDebt] = useState(null)
  const [creditPaymentMode, setCreditPaymentMode] = useState('full')
  const [creditPaymentAmount, setCreditPaymentAmount] = useState('')
  const [creditPaymentError, setCreditPaymentError] = useState('')
  const [savingCreditPayment, setSavingCreditPayment] = useState(false)
  const [showManualDebtForm, setShowManualDebtForm] = useState(false)
  const [manualDebtCustomer, setManualDebtCustomer] = useState('')
  const [manualDebtAmount, setManualDebtAmount] = useState('')
  const [manualDebtError, setManualDebtError] = useState('')
  const [savingManualDebt, setSavingManualDebt] = useState(false)
  const creditPaymentRequest = useRef(null)
  const manualDebtRequest = useRef(null)
  const requestId = useRef(0)
  const salesInvoiceRequestId = useRef(0)
  const creditBalancesTriggerRef = useRef(null)
  const salesInvoicesTriggerRef = useRef(null)

  useEffect(() => {
    let active = true
    async function loadCustomers() {
      try {
        const customerRows = await getAll('customers')
        if (!active) return
        setCustomers(customerRows)
        setCustomerLoadError('')
      } catch (error) {
        if (active) setCustomerLoadError(error.message || 'Gagal memuat data kontak pelanggan.')
      }
    }
    loadCustomers()
    const unsubscribe = onRefresh(loadCustomers, 'finance')
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    async function load() {
      const currentRequest = ++requestId.current
      try {
        const range = dateRangeTimestamps(dateRange)
        const data = await getFinanceData({
          ...range,
          page,
          pageSize: FINANCE_PAGE_SIZE
        })
        if (!active || currentRequest !== requestId.current) return
        if (!Array.isArray(data.credit_balances) || typeof data.pending_expedition_count !== 'number') {
          throw new Error('Pembaruan Buku Kas belum tersedia. Jalankan ulang supabase/schema.sql di Supabase, lalu muat ulang.')
        }
        const pageCount = Math.max(1, Math.ceil(data.total_count / FINANCE_PAGE_SIZE))
        if (page > pageCount) {
          setPage(pageCount)
          return
        }
        setReport(data)
        setLoadError('')
      } catch (error) {
        if (!active || currentRequest !== requestId.current) return
        setLoadError(error.message || 'Gagal memuat data keuangan dari server.')
      } finally {
        if (active && currentRequest === requestId.current) setLoaded(true)
      }
    }

    load()
    const unsubscribe = onRefresh(load, 'finance')
    return () => {
      active = false
      unsubscribe()
    }
  }, [dateRange, page])

  useEffect(() => {
    if (!showSalesInvoices) return undefined
    let active = true

    async function loadInvoices() {
      const currentRequest = ++salesInvoiceRequestId.current
      setSalesInvoicesLoading(true)
      setSalesInvoicesError('')
      try {
        const result = await getFinanceInvoices({
          ...dateRangeTimestamps(dateRange),
          page: salesInvoicePage,
          pageSize: FINANCE_INVOICE_PAGE_SIZE
        })
        if (!active || currentRequest !== salesInvoiceRequestId.current) return
        setSalesInvoices(result.invoices)
        setSalesInvoiceCount(result.totalCount)
      } catch (error) {
        if (active && currentRequest === salesInvoiceRequestId.current) {
          setSalesInvoicesError(error.message || 'Gagal memuat daftar faktur.')
        }
      } finally {
        if (active && currentRequest === salesInvoiceRequestId.current) setSalesInvoicesLoading(false)
      }
    }

    loadInvoices()
    const unsubscribe = onRefresh(loadInvoices, 'finance')
    return () => {
      active = false
      unsubscribe()
    }
  }, [showSalesInvoices, dateRange, salesInvoicePage])

  const income = Number(report.income)
  const expense = Number(report.expense)
  const capital = Number(report.capital)
  const balance = income + capital - expense
  const totalCredit = Number(report.total_credit)
  const grossProfit = Number(report.gross_profit)
  const netProfit = grossProfit - expense
  const pageCount = Math.max(1, Math.ceil(report.total_count / FINANCE_PAGE_SIZE))
  const pageStart = (page - 1) * FINANCE_PAGE_SIZE
  const hasFilter = hasDateRange(dateRange)
  const todayDateRange = getTodayDateRange()
  const currentMonthDateRange = getCurrentMonthDateRange()
  const salesInvoicePageCount = Math.max(1, Math.ceil(salesInvoiceCount / FINANCE_INVOICE_PAGE_SIZE))

  function openNewEntry() {
    setEditingEntry(null)
    setEntryType('expense')
    setEntryDate(localDateValue(new Date()))
    setEntryCategory('')
    setEntryNote('')
    setEntryAmount('')
    setActionError('')
    setShowEntryForm(true)
  }

  function openEditEntry(entry) {
    setEditingEntry(entry)
    setEntryType(entry.type)
    setEntryDate(localDateValue(entry.date || entry.createdAt))
    setEntryCategory(entry.category || '')
    setEntryNote(entry.note || '')
    setEntryAmount(entry.pending ? '' : String(entry.amount))
    setActionError('')
    setShowEntryForm(true)
  }

  function openCreditPayment(debt) {
    setSelectedDebt(debt)
    setCreditPaymentMode('full')
    setCreditPaymentAmount(String(Number(debt.balance_due)))
    setCreditPaymentError('')
    creditPaymentRequest.current = null
  }

  function openManualDebtForm() {
    setManualDebtCustomer('')
    setManualDebtAmount('')
    setManualDebtError('')
    manualDebtRequest.current = null
    setShowManualDebtForm(true)
  }

  function closeCreditBalances() {
    setShowCreditBalances(false)
    requestAnimationFrame(() => creditBalancesTriggerRef.current?.focus())
  }

  function openSalesInvoices() {
    setSalesInvoicePage(1)
    setShowSalesInvoices(true)
    setInvoiceDownloadError('')
    setInvoiceDownloadStatus('')
  }

  function closeSalesInvoices() {
    setShowSalesInvoices(false)
    requestAnimationFrame(() => salesInvoicesTriggerRef.current?.focus())
  }

  function invoiceWithCustomerDetails(invoice) {
    const customer = customers.find((row) => row.name === invoice.customerName)
    return {
      ...invoice,
      customerPhone: customer?.phone || '',
      customerAddress: customer?.address || ''
    }
  }

  async function downloadSalesInvoice(invoice) {
    setInvoiceDownloadingId(invoice.id)
    setInvoiceDownloadError('')
    setInvoiceDownloadStatus('')
    try {
      await downloadInvoiceJpeg(invoiceWithCustomerDetails(invoice))
      setInvoiceDownloadStatus('Faktur ' + getInvoiceNumber(invoice) + ' berhasil diunduh.')
    } catch (error) {
      setInvoiceDownloadError(error.message || 'Gagal mengunduh faktur.')
    } finally {
      setInvoiceDownloadingId(null)
    }
  }

  async function saveManualDebt(event) {
    event.preventDefault()
    if (savingManualDebt) return
    setManualDebtError('')
    const customerName = manualDebtCustomer.trim()
    const amount = Number(manualDebtAmount)
    if (!customers.some((customer) => customer.name === customerName)) {
      setManualDebtError('Pilih nama pelanggan dari master pelanggan.')
      return
    }
    if (!isSafeRupiahAmount(amount)) {
      setManualDebtError('Nominal hutang harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }

    const fingerprint = JSON.stringify([customerName, amount])
    if (manualDebtRequest.current?.fingerprint !== fingerprint) {
      manualDebtRequest.current = { fingerprint, id: crypto.randomUUID() }
    }
    setSavingManualDebt(true)
    try {
      await addManualCustomerCredit(customerName, amount, manualDebtRequest.current.id)
      setShowManualDebtForm(false)
    } catch (error) {
      setManualDebtError(error.message || 'Gagal menambahkan hutang pelanggan.')
    } finally {
      setSavingManualDebt(false)
    }
  }

  async function saveCreditPayment(event) {
    event.preventDefault()
    if (!selectedDebt || savingCreditPayment) return
    setCreditPaymentError('')
    const balanceDue = Number(selectedDebt.balance_due)
    const amount = creditPaymentMode === 'full' ? balanceDue : Number(creditPaymentAmount)
    if (!isSafeRupiahAmount(balanceDue, true)) {
      setCreditPaymentError('Sisa hutang melebihi batas nominal rupiah yang aman. Periksa data hutang.')
      return
    }
    if (!isSafeRupiahAmount(amount)) {
      setCreditPaymentError('Nominal harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (amount > balanceDue) {
      setCreditPaymentError('Pembayaran tidak boleh melebihi sisa hutang ' + rupiah(balanceDue) + '.')
      return
    }

    const fingerprint = selectedDebt.customer_name + ':' + amount
    if (creditPaymentRequest.current?.fingerprint !== fingerprint) {
      creditPaymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }

    setSavingCreditPayment(true)
    try {
      await recordCustomerCreditPayment(
        selectedDebt.customer_name,
        amount,
        creditPaymentRequest.current.id
      )
      setSelectedDebt(null)
      creditPaymentRequest.current = null
    } catch (error) {
      setCreditPaymentError(error.message || 'Gagal menyimpan pembayaran hutang.')
    } finally {
      setSavingCreditPayment(false)
    }
  }

  async function saveEntry(event) {
    event.preventDefault()
    setActionError('')
    const amount = Number(entryAmount)
    if (editingEntry?.pending) {
      if (!isSafeRupiahAmount(amount)) {
        setActionError('Biaya ekspedisi harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
        return
      }
      setSavingEntry(true)
      try {
        await recordExpeditionCost(editingEntry.id, amount)
        setShowEntryForm(false)
        setEditingEntry(null)
      } catch (error) {
        setActionError(error.message || 'Gagal menyimpan biaya ekspedisi.')
      } finally {
        setSavingEntry(false)
      }
      return
    }
    if (!['expense', 'capital'].includes(entryType)) {
      setActionError('Pilih jenis pengeluaran atau modal.')
      return
    }
    if (!isSafeRupiahAmount(amount)) {
      setActionError('Nominal harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || Number.isNaN(new Date(entryDate + 'T12:00:00').getTime())) {
      setActionError('Pilih tanggal yang valid.')
      return
    }

    setSavingEntry(true)
    try {
      await put('finance', {
        id: editingEntry?.id,
        type: entryType,
        category: entryCategory.trim() || null,
        note: entryNote.trim() || null,
        amount,
        date: new Date(entryDate + 'T12:00:00').toISOString(),
        refId: null,
        requestId: null,
        createdAt: editingEntry?.createdAt
      })
      setPage(1)
      setShowEntryForm(false)
      setEditingEntry(null)
    } catch (error) {
      setActionError(error.message || 'Gagal menyimpan catatan keuangan.')
    } finally {
      setSavingEntry(false)
    }
  }

  async function deleteEntry(entry) {
    if (!confirm('Hapus catatan keuangan ini?')) return
    setActionError('')
    try {
      await remove('finance', entry.id)
    } catch (error) {
      setActionError(error.message || 'Gagal menghapus catatan dari server.')
    }
  }

  if (!loaded) return (
    <div className="page finance-page">
      <div className="finance-overview-sticky">
        <div className="finance-date-filter">
          <div className="finance-date-range">
            <label className="dashboard-date-field">
              <Icon name="calendar" size={23} />
              <span>Dari tanggal</span>
              <input type="date" value={dateRange.from} disabled aria-label="Dari tanggal" />
            </label>
            <label className="dashboard-date-field">
              <Icon name="calendar" size={23} />
              <span>Sampai tanggal</span>
              <input type="date" value={dateRange.to} disabled aria-label="Sampai tanggal" />
            </label>
            <div className="finance-date-quick-actions">
              <button className="finance-date-quick" type="button" disabled>Hari ini</button>
              <button className="finance-date-quick" type="button" disabled>Bulan ini</button>
            </div>
          </div>
        </div>
        <div className="stats-grid dashboard-stats-grid finance-summary-grid finance-loading-summary" aria-label="Memuat ringkasan keuangan">
          <div className="stat-card dashboard-stat-card finance-income-card">
            <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Pemasukan Penjualan</span>
              <strong>+<LoadingNumber label="pemasukan penjualan" /></strong>
            </div>
          </div>
          <div className="stat-card dashboard-stat-card debt-stat-card finance-debt-card">
            <span className="dashboard-stat-icon"><Icon name="tag" size={27} /></span>
            <span className="dashboard-stat-content">
              <span>Total Hutang</span>
              <strong><LoadingNumber label="total hutang" /></strong>
              <span className="debt-stat-hint">Memuat data...</span>
            </span>
          </div>
          <div className="stat-card dashboard-stat-card finance-cash-card">
            <span className="dashboard-stat-icon"><Icon name="wallet" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Saldo Kas</span>
              <strong><LoadingNumber label="saldo kas" /></strong>
            </div>
          </div>
          <div className="stat-card dashboard-stat-card finance-profit-card">
            <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Laba</span>
              <strong><LoadingNumber label="laba" /></strong>
            </div>
          </div>
        </div>
      </div>
      <p className="muted">Memuat data keuangan dari server...</p>
    </div>
  )
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => requestPageRefresh('finance')}>Coba lagi</button>
    </div>
  }

  return (
    <div className="page finance-page">
      {actionError && !showEntryForm && <p className="form-error" role="alert">{actionError}</p>}
      <div className="finance-overview-sticky">
        <div className="finance-date-filter">
          <div className="finance-date-range">
            <label className="dashboard-date-field">
              <Icon name="calendar" size={23} />
              <span>Dari tanggal</span>
              <input
                type="date"
                value={dateRange.from}
                max={dateRange.to || undefined}
                onChange={(event) => {
                  setDateRange((range) => ({ ...range, from: event.target.value }))
                  setPage(1)
                }}
                aria-label="Dari tanggal"
              />
            </label>
            <label className="dashboard-date-field">
              <Icon name="calendar" size={23} />
              <span>Sampai tanggal</span>
              <input
                type="date"
                value={dateRange.to}
                min={dateRange.from || undefined}
                onChange={(event) => {
                  setDateRange((range) => ({ ...range, to: event.target.value }))
                  setPage(1)
                }}
                aria-label="Sampai tanggal"
              />
            </label>
            <div className="finance-date-quick-actions">
              <button
                className="finance-date-quick"
                type="button"
                aria-pressed={dateRange.from === todayDateRange.from && dateRange.to === todayDateRange.to}
                onClick={() => {
                  setDateRange(todayDateRange)
                  setPage(1)
                }}>
                Hari ini
              </button>
              <button
                className="finance-date-quick"
                type="button"
                aria-pressed={dateRange.from === currentMonthDateRange.from && dateRange.to === currentMonthDateRange.to}
                onClick={() => {
                  setDateRange(currentMonthDateRange)
                  setPage(1)
                }}>
                Bulan ini
              </button>
            </div>
          </div>
        </div>
        <div className="stats-grid dashboard-stats-grid finance-summary-grid">
          <button
            className="stat-card dashboard-stat-card finance-income-card finance-income-card-trigger"
            type="button"
            ref={salesInvoicesTriggerRef}
            aria-haspopup="dialog"
            aria-expanded={showSalesInvoices}
            onClick={openSalesInvoices}>
            <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Pemasukan Penjualan</span>
              <strong>+{rupiah(income)}</strong>
              <span className="finance-income-hint">Daftar faktur <Icon name="arrowRight" size={14} /></span>
            </div>
          </button>
          <button
            className="stat-card dashboard-stat-card debt-stat-card finance-debt-card"
            type="button"
            ref={creditBalancesTriggerRef}
            aria-haspopup="dialog"
            aria-expanded={showCreditBalances}
            onClick={() => setShowCreditBalances(true)}>
            <span className="dashboard-stat-icon"><Icon name="tag" size={27} /></span>
            <span className="dashboard-stat-content">
              <span>Total Hutang</span>
              <strong>{rupiah(totalCredit)}</strong>
              <span className="debt-stat-hint">
                Nama pelanggan <Icon name="arrowRight" size={14} />
              </span>
            </span>
          </button>
          <div className="stat-card dashboard-stat-card finance-cash-card">
            <span className="dashboard-stat-icon"><Icon name="wallet" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Saldo Kas</span>
              <strong>{rupiah(balance)}</strong>
            </div>
          </div>
          <div className="stat-card dashboard-stat-card finance-profit-card">
            <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Laba</span>
              <strong className={netProfit >= 0 ? 'ok' : 'danger'}>{rupiah(netProfit)}</strong>
            </div>
          </div>
        </div>
      </div>

      {showSalesInvoices && (
        <div className="overlay finance-invoices-overlay" onClick={closeSalesInvoices}>
          <section
            className="modal finance-invoices-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-invoices-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeSalesInvoices()
            }}>
            <div className="finance-invoices-heading">
              <div>
                <h3 id="finance-invoices-title">Faktur penjualan</h3>
                <p className="muted small">Daftar faktur pada periode Buku Kas yang dipilih.</p>
              </div>
              <button
                className="btn finance-invoices-close"
                type="button"
                aria-label="Tutup daftar faktur"
                autoFocus
                onClick={closeSalesInvoices}>
                <Icon name="close" size={18} />
              </button>
            </div>
            {invoiceDownloadError && <p className="form-error" role="alert">{invoiceDownloadError}</p>}
            {invoiceDownloadStatus && <p className="backup-success" role="status">{invoiceDownloadStatus}</p>}
            {salesInvoicesError && <p className="form-error" role="alert">{salesInvoicesError}</p>}
            {salesInvoicesLoading ? (
              <p className="muted small">Memuat daftar faktur...</p>
            ) : salesInvoices.length === 0 ? (
              <p className="credit-balances-empty muted">Tidak ada faktur pada periode ini.</p>
            ) : (
              <>
                <div className="finance-invoices-table-wrap">
                  <table className="finance-invoices-table">
                    <thead>
                      <tr>
                        <th>No. faktur</th>
                        <th>Pelanggan</th>
                        <th>Tanggal</th>
                        <th className="right">Total</th>
                        <th className="right">Dibayar</th>
                        <th className="right">Sisa tagihan</th>
                        <th>Faktur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesInvoices.map((invoice) => {
                        const paidAmount = getInvoicePaidAmount(invoice)
                        const balanceDue = getInvoiceBalanceDue(invoice, paidAmount)
                        return (
                          <tr key={invoice.id}>
                            <td>
                              <button
                                className="finance-invoice-number"
                                type="button"
                                onClick={() => setSelectedInvoice(invoiceWithCustomerDetails(invoice))}>
                                {getInvoiceNumber(invoice)}
                              </button>
                            </td>
                            <td>
                              <CustomerIdentity
                                name={invoice.customerName || 'Pelanggan'}
                                customer={customers.find((customer) => customer.name === invoice.customerName)}
                              />
                            </td>
                            <td>{dateOnly(invoice.createdAt)}</td>
                            <td className="right">{rupiah(invoice.total)}</td>
                            <td className="right">
                              <strong>{rupiah(paidAmount)}</strong>
                              {invoice.payments.length > 0 && (
                                <span className="finance-invoice-payment-history">
                                  {invoice.payments.map((payment, index) => (
                                    <span key={index}>{dateTime(payment.date)} · {rupiah(payment.amount)}</span>
                                  ))}
                                </span>
                              )}
                            </td>
                            <td className="right">
                              <strong className={balanceDue > 0 ? 'danger' : 'ok'}>{rupiah(balanceDue)}</strong>
                            </td>
                            <td>
                              <div className="finance-invoice-actions">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  aria-label={'Cetak faktur ' + getInvoiceNumber(invoice)}
                                  title="Lihat / cetak faktur"
                                  onClick={() => setSelectedInvoice(invoiceWithCustomerDetails(invoice))}>
                                  <Icon name="print" size={14} />
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  aria-label={'Download faktur ' + getInvoiceNumber(invoice)}
                                  title="Download faktur"
                                  disabled={invoiceDownloadingId === invoice.id}
                                  onClick={() => downloadSalesInvoice(invoice)}>
                                  <Icon name="download" size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="dashboard-pagination">
                  <span className="muted small">
                    Menampilkan {(salesInvoicePage - 1) * FINANCE_INVOICE_PAGE_SIZE + 1}–{Math.min(salesInvoicePage * FINANCE_INVOICE_PAGE_SIZE, salesInvoiceCount)} dari {salesInvoiceCount} faktur
                  </span>
                  {salesInvoicePageCount > 1 && (
                    <div className="dashboard-pagination-controls" aria-label="Navigasi daftar faktur">
                      <button className="btn btn-sm" type="button" disabled={salesInvoicePage === 1} onClick={() => setSalesInvoicePage(salesInvoicePage - 1)}>Sebelumnya</button>
                      <span className="small">Halaman {salesInvoicePage} dari {salesInvoicePageCount}</span>
                      <button className="btn btn-sm" type="button" disabled={salesInvoicePage === salesInvoicePageCount} onClick={() => setSalesInvoicePage(salesInvoicePage + 1)}>Berikutnya</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {showCreditBalances && (
        <div className="overlay credit-balances-overlay" onClick={closeCreditBalances}>
          <section
            className="modal credit-balances-modal"
            id="credit-balances-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credit-balances-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeCreditBalances()
            }}>
            <div className="credit-balances-heading">
              <div>
                <h3 id="credit-balances-title">Pelanggan dengan hutang</h3>
                <p className="muted small">Menampilkan sisa hutang yang masih berjalan, tidak dibatasi periode.</p>
              </div>
              <button
                className="btn credit-balances-close"
                type="button"
                aria-label="Tutup daftar pelanggan dengan hutang"
                autoFocus
                onClick={closeCreditBalances}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="credit-balances-heading-actions">
              <strong className="credit-balances-total">{rupiah(totalCredit)}</strong>
              <button className="btn btn-primary btn-sm" type="button" onClick={openManualDebtForm}>
                + Tambah hutang
              </button>
            </div>
            {customerLoadError && <p className="form-error" role="alert">{customerLoadError}</p>}
            {report.credit_balances.length === 0 ? (
              <p className="credit-balances-empty muted">Tidak ada pelanggan dengan hutang saat ini.</p>
            ) : (
              <ul className={'credit-balances-list' + (report.credit_balances.length >= 5 ? ' is-scrollable' : '')}>
                {report.credit_balances.map((debt, index) => (
                  <li key={debt.customer_name}>
                    <span className="finance-row-number">{index + 1}</span>
                    <CustomerIdentity
                      name={debt.customer_name}
                      customer={customers.find((customer) => customer.name === debt.customer_name)}
                    />
                    <div className="credit-balances-actions">
                      <strong>{rupiah(Number(debt.balance_due))}</strong>
                      <button className="btn btn-sm btn-primary" type="button" onClick={() => openCreditPayment(debt)}>
                        Bayar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="finance-grid">
        <div className="card table-card finance-ledger">
          <div className="finance-ledger-heading">
            <h3>Buku Kas</h3>
            <button className="btn btn-primary finance-add-entry-button" type="button" onClick={openNewEntry}>+ Tambah catatan</button>
          </div>
          {report.pending_expedition_count > 0 && (
            <div className="finance-pending-alert" role="alert">
              <strong>Biaya ekspedisi belum diisi</strong>
              <span>
                {report.pending_expedition_count} transaksi perlu dilengkapi. Masukkan biaya sesuai bukti pembayaran agar tercatat sebagai beban toko.
              </span>
            </div>
          )}
          <table className="finance-ledger-table">
            <thead><tr><th>No.</th><th>Jenis</th><th>Tanggal</th><th>Kategori</th><th>Catatan</th><th>Nominal</th><th></th></tr></thead>
            <tbody>
              {report.entries.length === 0 && <tr><td colSpan="7" className="muted center">
                {hasFilter ? 'Tidak ada catatan pada rentang tanggal ini.' : 'Belum ada catatan.'}
              </td></tr>}
              {report.entries.map((e, index) => (
                <tr key={e.id}>
                  <td className="finance-row-number">{pageStart + index + 1}</td>
                  <td>
                    <span className={'badge finance-entry-type-label ' + TYPES[e.type].cls}>{TYPES[e.type].label}</span>
                    {(e.type === 'income' || e.type === 'expense') && (
                      <span className={'badge finance-entry-type-icon ' + TYPES[e.type].cls} role="img" aria-label={TYPES[e.type].label} title={TYPES[e.type].label}>
                        <Icon name={e.type === 'income' ? 'income' : 'expense'} size={14} />
                      </span>
                    )}
                  </td>
                  <td>{dateOnly(e.date || e.createdAt)}</td>
                  <td>
                    {e.category || '-'}
                    {getFinanceEntryCustomerName(e) && (
                      <span className="finance-entry-customer">{getFinanceEntryCustomerName(e)}</span>
                    )}
                  </td>
                  <td>
                    {e.pending && <strong className="finance-pending-label">Belum diisi · </strong>}
                    {e.note || '-'}
                  </td>
                  <td className={'right ' + (e.type === 'expense' ? 'danger' : 'ok')}>
                    {e.pending ? (
                      <div className="finance-pending-cell">
                        <span className="finance-pending-amount">Wajib diisi</span>
                        <button className="btn btn-sm btn-primary" type="button" onClick={() => openEditEntry(e)}>
                          Isi biaya
                        </button>
                      </div>
                    ) : (e.type === 'expense' ? '−' : '+') + rupiah(e.amount)}
                  </td>
                  <td className="finance-ledger-actions">
                    {isAutomaticEntry(e) ? (
                      <span className="muted small">Otomatis</span>
                    ) : (
                      <div>
                        {['expense', 'capital'].includes(e.type) && (
                          <button className="btn btn-sm" type="button" onClick={() => openEditEntry(e)}>Edit</button>
                        )}
                        <button className="btn btn-sm btn-danger" type="button" onClick={() => deleteEntry(e)}>Hapus</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.total_count > 0 && (
            <div className="dashboard-pagination">
              <span className="muted small">
                Menampilkan {pageStart + 1}–{Math.min(pageStart + FINANCE_PAGE_SIZE, report.total_count)} dari {report.total_count} catatan
              </span>
              {pageCount > 1 && (
                <div className="dashboard-pagination-controls" aria-label="Navigasi halaman buku kas">
                  <button className="btn btn-sm" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
                  <span className="small">Halaman {page} dari {pageCount}</span>
                  <button className="btn btn-sm" type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Berikutnya</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showManualDebtForm && (
        <div className="overlay" onClick={() => !savingManualDebt && setShowManualDebtForm(false)}>
          <form
            className="modal credit-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-debt-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={saveManualDebt}>
            <h3 id="manual-debt-title">Tambah hutang lama</h3>
            <label htmlFor="manual-debt-customer">Nama pelanggan</label>
            <SelectInput
              id="manual-debt-customer"
              className="finance-customer-select"
              ariaLabel="Nama pelanggan"
              value={manualDebtCustomer}
              onChange={setManualDebtCustomer}
              required
              disabled={customers.length === 0 || savingManualDebt}
              placeholder="Pilih pelanggan"
              options={customers.map((customer) => ({
                value: customer.name,
                label: customer.name
              }))} />
            {customers.length === 0 && (
              <p className="muted small">Belum ada pelanggan di master. Tambahkan pelanggan terlebih dahulu di tab Setting.</p>
            )}
            <label htmlFor="manual-debt-amount">Nominal hutang</label>
            <MoneyInput
              id="manual-debt-amount"
              value={manualDebtAmount}
              onChange={setManualDebtAmount}
              placeholder="Masukkan nominal hutang"
              required
            />
            {manualDebtError && <p className="form-error" role="alert">{manualDebtError}</p>}
            <div className="modal-actions">
              <button className="btn" type="button" disabled={savingManualDebt} onClick={() => setShowManualDebtForm(false)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={savingManualDebt || customers.length === 0}>
                {savingManualDebt ? 'Menyimpan...' : 'Simpan hutang'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showEntryForm && (
        <div className="overlay" onClick={() => !savingEntry && setShowEntryForm(false)}>
          <form
            className="modal finance-entry-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-entry-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={saveEntry}>
            <h3 id="finance-entry-title">{editingEntry?.pending ? 'Lengkapi biaya ekspedisi' : editingEntry ? 'Edit catatan keuangan' : 'Tambah catatan keuangan'}</h3>
            {editingEntry?.pending ? (
              <p className="finance-pending-instructions" role="status">
                {entryNote}. Masukkan nominal yang dibayar toko. Biaya ini akan dicatat sebagai pengeluaran.
              </p>
            ) : (
              <>
                <label htmlFor="finance-entry-type">Jenis catatan</label>
                <SelectInput
                  id="finance-entry-type"
                  className="finance-entry-type-select"
                  ariaLabel="Jenis catatan"
                  value={entryType}
                  onChange={setEntryType}
                  options={[
                    { value: 'expense', label: 'Pengeluaran' },
                    { value: 'capital', label: 'Modal' }
                  ]} />
                <label htmlFor="finance-entry-date">Tanggal</label>
                <input
                  id="finance-entry-date"
                  className="input"
                  type="date"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                  required
                />
                <label htmlFor="finance-entry-category">Kategori</label>
                <input
                  id="finance-entry-category"
                  className="input"
                  value={entryCategory}
                  onChange={(event) => setEntryCategory(event.target.value)}
                  maxLength={100}
                  placeholder="Contoh: Belanja perlengkapan"
                />
                <label htmlFor="finance-entry-note">Catatan</label>
                <textarea
                  id="finance-entry-note"
                  className="input"
                  value={entryNote}
                  onChange={(event) => setEntryNote(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Catatan tambahan (opsional)"
                />
              </>
            )}
            <label htmlFor="finance-entry-amount">Nominal</label>
            <MoneyInput
              id="finance-entry-amount"
              value={entryAmount}
              onChange={setEntryAmount}
              placeholder="Masukkan nominal"
              required
            />
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            <div className="modal-actions">
              <button className="btn" type="button" disabled={savingEntry} onClick={() => setShowEntryForm(false)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={savingEntry || (editingEntry?.pending && !entryAmount)}>
                {savingEntry ? 'Menyimpan...' : editingEntry?.pending ? 'Simpan biaya ekspedisi' : 'Simpan catatan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedDebt && (
        <div className="overlay" onClick={() => !savingCreditPayment && setSelectedDebt(null)}>
          <form
            className="modal credit-payment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credit-payment-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={saveCreditPayment}>
            <h3 id="credit-payment-title">Pembayaran hutang pelanggan</h3>
            <p className="muted">
              {selectedDebt.customer_name} · Sisa hutang {rupiah(Number(selectedDebt.balance_due))}
            </p>
            <div className="credit-payment-modes" role="group" aria-label="Jenis pembayaran">
              <button
                className={'btn ' + (creditPaymentMode === 'full' ? 'btn-primary' : '')}
                type="button"
                aria-pressed={creditPaymentMode === 'full'}
                onClick={() => setCreditPaymentMode('full')}>
                Lunasi penuh
              </button>
              <button
                className={'btn ' + (creditPaymentMode === 'partial' ? 'btn-primary' : '')}
                type="button"
                aria-pressed={creditPaymentMode === 'partial'}
                onClick={() => {
                  setCreditPaymentMode('partial')
                  setCreditPaymentAmount('')
                }}>
                Bayar sebagian
              </button>
            </div>
            <label htmlFor="customer-credit-payment-amount">Jumlah pembayaran</label>
            <MoneyInput
              id="customer-credit-payment-amount"
              value={creditPaymentMode === 'full' ? String(Number(selectedDebt.balance_due)) : creditPaymentAmount}
              onChange={setCreditPaymentAmount}
              placeholder="Masukkan nominal pembayaran"
              disabled={creditPaymentMode === 'full'}
              required
            />
            {creditPaymentError && <p className="form-error" role="alert">{creditPaymentError}</p>}
            <div className="modal-actions">
              <button className="btn" type="button" disabled={savingCreditPayment} onClick={() => setSelectedDebt(null)}>Batal</button>
              <button className="btn btn-primary" type="submit" disabled={savingCreditPayment}>
                {savingCreditPayment ? 'Menyimpan...' : creditPaymentMode === 'full' ? 'Lunasi hutang' : 'Simpan pembayaran'}
              </button>
            </div>
          </form>
        </div>
      )}
      {selectedInvoice && (
        <ReceiptPreview
          transaction={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}

function getInvoicePaidAmount(invoice) {
  if (invoice.paidAmount != null && Number.isFinite(Number(invoice.paidAmount))) {
    return Number(invoice.paidAmount)
  }
  return invoice.paymentType === 'credit'
    ? Math.min(Number(invoice.total) || 0, Number(invoice.payment) || 0)
    : Number(invoice.total) || 0
}

function getInvoiceBalanceDue(invoice, paidAmount) {
  if (invoice.balanceDue != null && Number.isFinite(Number(invoice.balanceDue))) {
    return Math.max(0, Number(invoice.balanceDue))
  }
  return Math.max(0, (Number(invoice.total) || 0) - paidAmount)
}

function isAutomaticEntry(entry) {
  if (entry.pending) return true
  const category = String(entry.category || '').trim().toLocaleLowerCase('id-ID')
  const note = String(entry.note || '')
  return entry.refId != null
    || entry.requestId != null
    || ['penjualan', 'dp kredit', 'cicilan kredit', 'pembelian bahan produksi'].includes(category)
    || note.startsWith('Penjualan ·')
    || note.startsWith('Cicilan transaksi ')
}

function getFinanceEntryCustomerName(entry) {
  if (entry.type !== 'income') return ''

  const note = String(entry.note || '').trim()
  const prefixes = ['Penjualan · ', 'Cicilan kredit pelanggan · ']
  const prefix = prefixes.find((value) => note.startsWith(value))
  if (prefix) return note.slice(prefix.length).trim()

  if (note.startsWith('Cicilan transaksi ')) {
    const separatorIndex = note.lastIndexOf(' · ')
    if (separatorIndex !== -1) return note.slice(separatorIndex + 3).trim()
  }
  return ''
}
