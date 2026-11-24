import { useEffect, useRef, useState } from 'react'
import { getAll, getFinanceData, getFinanceInvoices, put, remove, onRefresh, requestPageRefresh, recordExpeditionCost } from '../db'
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
import { getFinanceEntryCustomerName } from '../financeEntryPresentation.js'

const TYPES = {
  income: { label: 'Pemasukan', cls: 'badge-ok' },
  expense: { label: 'Pengeluaran', cls: 'badge-danger' },
  capital: { label: 'Modal', cls: 'badge-neutral' }
}
const FINANCE_PAGE_SIZE = 20
const FINANCE_INVOICE_PAGE_SIZE = 20

function formatInvoiceListDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(date)
}

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

export default function Finance({ onNavigateToDebts }) {
  const [report, setReport] = useState({
    entries: [],
    total_count: 0,
    income: 0,
    expense: 0,
    capital: 0,
    pending_expedition_count: 0,
    total_credit: 0,
    total_vendor_debt: 0,
    gross_profit: 0,
    profit_expense: 0
  })
  const [dateRange, setDateRange] = useState(getCurrentMonthDateRange)
  const [customers, setCustomers] = useState([])
  const [customerLoadError, setCustomerLoadError] = useState('')
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [showLedgerFilters, setShowLedgerFilters] = useState(false)
  const [ledgerSearchInput, setLedgerSearchInput] = useState('')
  const [ledgerFilters, setLedgerFilters] = useState({ search: '' })
  const [loaded, setLoaded] = useState(false)
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
  const requestId = useRef(0)
  const salesInvoiceRequestId = useRef(0)
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
          pageSize: FINANCE_PAGE_SIZE,
          ...ledgerFilters
        })
        if (!active || currentRequest !== requestId.current) return
        if (typeof data.pending_expedition_count !== 'number') {
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
  }, [dateRange, page, ledgerFilters])

  useEffect(() => {
    if (!showSalesInvoices) return undefined
    let active = true

    async function loadInvoices() {
      const currentRequest = ++salesInvoiceRequestId.current
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
  const profitExpense = Number(report.profit_expense ?? report.expense)
  const netProfit = grossProfit - profitExpense
  const pageCount = Math.max(1, Math.ceil(report.total_count / FINANCE_PAGE_SIZE))
  const pageStart = (page - 1) * FINANCE_PAGE_SIZE
  const hasFilter = hasDateRange(dateRange)
  const hasLedgerFilters = Boolean(ledgerFilters.search)
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

  function openSalesInvoices() {
    setSalesInvoicePage(1)
    setSalesInvoices([])
    setSalesInvoicesLoading(true)
    setSalesInvoicesError('')
    setShowSalesInvoices(true)
    setInvoiceDownloadError('')
    setInvoiceDownloadStatus('')
  }

  function applyLedgerFilters(event) {
    event.preventDefault()
    setPage(1)
    setLedgerFilters({ search: ledgerSearchInput.trim() })
  }

  function clearLedgerFilters() {
    setLedgerSearchInput('')
    setLedgerFilters({ search: '' })
    setPage(1)
  }

  function changeSalesInvoicePage(nextPage) {
    setSalesInvoices([])
    setSalesInvoicesLoading(true)
    setSalesInvoicesError('')
    setSalesInvoicePage(nextPage)
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
          <button
            className="stat-card dashboard-stat-card finance-debt-summary-card finance-debt-summary-card-trigger"
            type="button"
            aria-label="Buka halaman Utang/Piutang"
            onClick={onNavigateToDebts}>
            <span className="dashboard-stat-icon"><Icon name="coins" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Ringkasan hutang</span>
              <div className="finance-debt-breakdown">
                <div className="finance-debt-line">
                  <span>Hutang pelanggan</span>
                  <strong><LoadingNumber label="hutang pelanggan" /></strong>
                </div>
                <div className="finance-debt-line">
                  <span>Hutang vendor</span>
                  <strong><LoadingNumber label="hutang vendor" /></strong>
                </div>
              </div>
            </div>
          </button>
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
          <div className="stat-card dashboard-stat-card finance-debt-summary-card">
            <span className="dashboard-stat-icon"><Icon name="coins" size={27} /></span>
            <div className="dashboard-stat-content">
              <span>Ringkasan hutang</span>
              <div className="finance-debt-breakdown">
                <div className="finance-debt-line">
                  <span>Hutang pelanggan</span>
                  <strong>{rupiah(totalCredit)}</strong>
                </div>
                <div className="finance-debt-line">
                  <span>Hutang vendor</span>
                  <strong>{rupiah(Number(report.total_vendor_debt))}</strong>
                </div>
              </div>
            </div>
          </div>
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
              <span>Ringkasan laba</span>
              <div className="finance-profit-breakdown">
                <div className="finance-profit-line">
                  <span>Laba kotor</span>
                  <strong>{rupiah(grossProfit)}</strong>
                </div>
                <div className="finance-profit-line">
                  <span>Laba bersih</span>
                  <strong className={netProfit >= 0 ? 'ok' : 'danger'}>{rupiah(netProfit)}</strong>
                </div>
              </div>
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
            {customerLoadError && <p className="form-error" role="alert">{customerLoadError}</p>}
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
                        <th>No.</th>
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
                      {salesInvoices.map((invoice, index) => {
                        const paidAmount = getInvoicePaidAmount(invoice)
                        const balanceDue = getInvoiceBalanceDue(invoice, paidAmount)
                        return (
                          <tr key={invoice.id}>
                            <td className="finance-invoice-index" data-label="No.">
                              {(salesInvoicePage - 1) * FINANCE_INVOICE_PAGE_SIZE + index + 1}
                            </td>
                            <td data-label="No. faktur">
                              <button
                                className="finance-invoice-number"
                                type="button"
                                onClick={() => setSelectedInvoice(invoiceWithCustomerDetails(invoice))}>
                                {getInvoiceNumber(invoice)}
                              </button>
                            </td>
                            <td data-label="Pelanggan">
                              <CustomerIdentity
                                name={invoice.customerName || 'Pelanggan'}
                                customer={customers.find((customer) => customer.name === invoice.customerName)}
                                className="finance-invoice-customer"
                              />
                            </td>
                            <td data-label="Tanggal">{formatInvoiceListDate(invoice.createdAt)}</td>
                            <td
                              className={'right finance-invoice-total ' + (invoice.paymentType === 'credit' ? 'is-credit' : 'is-cash')}
                              data-label="Total">
                              {rupiah(invoice.total)}
                            </td>
                            <td className="right" data-label="Dibayar">
                              <strong>{rupiah(paidAmount)}</strong>
                              {invoice.payments.length > 0 && (
                                <span className="finance-invoice-payment-history">
                                  {invoice.payments.map((payment, index) => (
                                    <span key={index}>{dateTime(payment.date)} · {rupiah(payment.amount)}</span>
                                  ))}
                                </span>
                              )}
                            </td>
                            <td className="right" data-label="Sisa tagihan">
                              <strong className={balanceDue > 0 ? 'danger' : 'ok'}>{rupiah(balanceDue)}</strong>
                            </td>
                            <td data-label="Aksi">
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
                      <button className="btn btn-sm" type="button" disabled={salesInvoicePage === 1} onClick={() => changeSalesInvoicePage(salesInvoicePage - 1)}>Sebelumnya</button>
                      <span className="small">Halaman {salesInvoicePage} dari {salesInvoicePageCount}</span>
                      <button className="btn btn-sm" type="button" disabled={salesInvoicePage === salesInvoicePageCount} onClick={() => changeSalesInvoicePage(salesInvoicePage + 1)}>Berikutnya</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <div className="finance-grid">
        <div className="card table-card finance-ledger">
          <div className="finance-ledger-heading">
            <div className="finance-ledger-title">
              <h3>Buku Kas</h3>
              <button
                className={'btn finance-ledger-filter-toggle' + (hasLedgerFilters ? ' is-active' : '')}
                type="button"
                aria-expanded={showLedgerFilters}
                aria-controls="finance-ledger-filter-panel"
                onClick={() => setShowLedgerFilters((visible) => !visible)}>
                <Icon name="search" size={16} />
                <span>Filter</span>
                {hasLedgerFilters && <span className="finance-ledger-filter-indicator" aria-label="Filter aktif" />}
              </button>
            </div>
            <button className="btn btn-primary finance-add-entry-button" type="button" onClick={openNewEntry}>+ Tambah catatan</button>
          </div>
          {showLedgerFilters && (
            <form id="finance-ledger-filter-panel" className="finance-ledger-filter-panel" onSubmit={applyLedgerFilters}>
              <label className="finance-ledger-search-field">
                <span>Cari nama, ekspedisi, kategori, catatan, atau nominal</span>
                <input
                  className="input"
                  type="search"
                  value={ledgerSearchInput}
                  onChange={(event) => setLedgerSearchInput(event.target.value)}
                  placeholder="Contoh: JNE, nama pelanggan, atau biaya"
                />
              </label>
              <div className="finance-ledger-filter-actions">
                <button className="btn btn-primary" type="submit">Terapkan</button>
                <button className="btn" type="button" onClick={clearLedgerFilters}>Reset</button>
              </div>
            </form>
          )}
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
                {hasLedgerFilters
                  ? 'Tidak ada catatan yang cocok dengan filter.'
                  : hasFilter ? 'Tidak ada catatan pada rentang tanggal ini.' : 'Belum ada catatan.'}
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
