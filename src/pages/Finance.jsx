import { useEffect, useRef, useState } from 'react'
import { getAll, getFinanceData, put, remove, onRefresh, recordCustomerCreditPayment, addManualCustomerCredit } from '../db'
import { rupiah, dateOnly, dateTime } from '../format'
import DateRangeFilter from '../components/DateRangeFilter.jsx'
import { dateRangeTimestamps, hasDateRange, localDateValue } from '../dateFilter'
import MoneyInput from '../components/MoneyInput.jsx'
import CustomerIdentity from '../components/CustomerIdentity.jsx'

const TYPES = {
  income: { label: 'Pemasukan', cls: 'badge-ok' },
  expense: { label: 'Pengeluaran', cls: 'badge-danger' },
  capital: { label: 'Modal', cls: 'badge-neutral' }
}
const FINANCE_PAGE_SIZE = 20

function getTodayDateRange() {
  const today = localDateValue(new Date())
  return { from: today, to: today }
}

export default function Finance() {
  const [report, setReport] = useState({
    entries: [],
    total_count: 0,
    income: 0,
    expense: 0,
    capital: 0,
    total_credit: 0,
    gross_profit: 0,
    credit_balances: []
  })
  const [dateRange, setDateRange] = useState(getTodayDateRange)
  const [customers, setCustomers] = useState([])
  const [customerLoadError, setCustomerLoadError] = useState('')
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
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
    const unsubscribe = onRefresh(loadCustomers)
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
        if (!Array.isArray(data.credit_balances)) {
          throw new Error('Daftar hutang pelanggan belum tersedia. Terapkan pembaruan supabase/schema.sql di Supabase, lalu muat ulang.')
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
    const unsubscribe = onRefresh(load)
    return () => {
      active = false
      unsubscribe()
    }
  }, [dateRange, page])

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
    setEntryAmount(String(entry.amount))
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
    if (!Number.isFinite(amount) || amount <= 0) {
      setManualDebtError('Nominal hutang harus lebih dari Rp0.')
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
    if (!Number.isFinite(amount) || amount <= 0) {
      setCreditPaymentError('Nominal pembayaran harus lebih dari Rp0.')
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
    if (!['expense', 'capital'].includes(entryType)) {
      setActionError('Pilih jenis pengeluaran atau modal.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError('Nominal harus lebih dari Rp0.')
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

  if (!loaded) return <div className="page"><p className="muted">Memuat data keuangan dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  return (
    <div className="page">
      {actionError && !showEntryForm && <p className="form-error" role="alert">{actionError}</p>}
      <div className="stats-grid dashboard-stats-grid">
        <div className="stat-card"><span>Pemasukan Penjualan</span><strong className="ok">+{rupiah(income)}</strong></div>
        <div className="stat-card"><span>Total Hutang</span><strong className="danger">{rupiah(totalCredit)}</strong></div>
        <div className="stat-card highlight"><span>Saldo Kas</span><strong>{rupiah(balance)}</strong></div>
        <div className="stat-card"><span>Laba</span><strong className={netProfit >= 0 ? 'ok' : 'danger'}>{rupiah(netProfit)}</strong></div>
      </div>

      <section className="card credit-balances" aria-labelledby="credit-balances-title">
        <div className="credit-balances-heading">
          <div>
            <h3 id="credit-balances-title">Pelanggan dengan hutang</h3>
            <p className="muted small">Menampilkan sisa hutang yang masih berjalan, tidak dibatasi periode.</p>
          </div>
          <div className="credit-balances-heading-actions">
            <strong className="credit-balances-total">{rupiah(totalCredit)}</strong>
            <button className="btn btn-primary btn-sm" type="button" onClick={openManualDebtForm}>
              + Tambah hutang
            </button>
          </div>
        </div>
        {customerLoadError && <p className="form-error" role="alert">{customerLoadError}</p>}
        {report.credit_balances.length === 0 ? (
          <p className="credit-balances-empty muted">Tidak ada pelanggan dengan hutang saat ini.</p>
        ) : (
          <ul className="credit-balances-list">
            {report.credit_balances.map((debt) => (
              <li key={debt.customer_name}>
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

      <div className="finance-date-filter">
        <div className="date-filter-caption">
          <strong>Filter periode keuangan</strong>
          <span className="muted">Pemasukan, pengeluaran, saldo, dan laba mengikuti tanggal yang dipilih.</span>
        </div>
        <DateRangeFilter value={dateRange} onChange={(range) => {
          setDateRange(range)
          setPage(1)
        }} resetValue={todayDateRange} resetLabel="Hari ini" />
      </div>

      <div className="finance-grid">
        <div className="card table-card finance-ledger">
          <div className="finance-ledger-heading">
            <h3>Buku Kas</h3>
            <button className="btn btn-primary" type="button" onClick={openNewEntry}>+ Tambah catatan</button>
          </div>
          <table className="finance-ledger-table">
            <thead><tr><th><span className="finance-ledger-time-label">Waktu</span><span className="finance-ledger-date-label">Tanggal</span></th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th>Nominal</th><th></th></tr></thead>
            <tbody>
              {report.entries.length === 0 && <tr><td colSpan="6" className="muted center">
                {hasFilter ? 'Tidak ada catatan pada rentang tanggal ini.' : 'Belum ada catatan.'}
              </td></tr>}
              {report.entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="finance-ledger-datetime">{dateTime(e.date || e.createdAt)}</span>
                    <span className="finance-ledger-date">{dateOnly(e.date || e.createdAt)}</span>
                  </td>
                  <td><span className={'badge ' + TYPES[e.type].cls}>{TYPES[e.type].label}</span></td>
                  <td>{e.category || '-'}</td>
                  <td>{e.note || '-'}</td>
                  <td className={'right ' + (e.type === 'expense' ? 'danger' : 'ok')}>
                    {e.type === 'expense' ? '−' : '+'}{rupiah(e.amount)}
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
            <p className="muted">Catat saldo hutang yang sudah ada sebelum aplikasi digunakan. Catatan ini tidak dihitung sebagai penjualan.</p>
            <label htmlFor="manual-debt-customer">Nama pelanggan</label>
            <select
              id="manual-debt-customer"
              className="input"
              value={manualDebtCustomer}
              onChange={(event) => setManualDebtCustomer(event.target.value)}
              required
              disabled={customers.length === 0 || savingManualDebt}>
              <option value="" disabled>Pilih pelanggan</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.name}>{customer.name}</option>
              ))}
            </select>
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
            <h3 id="finance-entry-title">{editingEntry ? 'Edit catatan keuangan' : 'Tambah catatan keuangan'}</h3>
            <label htmlFor="finance-entry-type">Jenis catatan</label>
            <select
              id="finance-entry-type"
              className="input"
              value={entryType}
              onChange={(event) => setEntryType(event.target.value)}>
              <option value="expense">Pengeluaran</option>
              <option value="capital">Modal</option>
            </select>
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
              <button className="btn btn-primary" type="submit" disabled={savingEntry}>
                {savingEntry ? 'Menyimpan...' : 'Simpan catatan'}
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
    </div>
  )
}

function isAutomaticEntry(entry) {
  const category = String(entry.category || '').trim().toLocaleLowerCase('id-ID')
  const note = String(entry.note || '')
  return entry.refId != null
    || entry.requestId != null
    || ['penjualan', 'dp kredit', 'cicilan kredit'].includes(category)
    || note.startsWith('Penjualan ·')
    || note.startsWith('Cicilan transaksi ')
}
