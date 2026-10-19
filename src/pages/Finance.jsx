import { useEffect, useMemo, useState } from 'react'
import { getAll, put, remove, onRefresh } from '../db'
import { rupiah, dateOnly, dateTime } from '../format'
import DateRangeFilter from '../components/DateRangeFilter.jsx'
import { hasDateRange, isInDateRange, localDateValue } from '../dateFilter'
import MoneyInput from '../components/MoneyInput.jsx'

const TYPES = {
  income: { label: 'Pemasukan', cls: 'badge-ok' },
  expense: { label: 'Pengeluaran', cls: 'badge-danger' },
  capital: { label: 'Modal', cls: 'badge-neutral' }
}

export default function Finance() {
  const [entries, setEntries] = useState([])
  const [txs, setTxs] = useState([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
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

  async function load() {
    try {
      const [financeRows, transactionRows] = await Promise.all([
        getAll('finance'),
        getAll('transactions')
      ])
      setEntries(financeRows)
      setTxs(transactionRows)
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat data keuangan dari server.')
    } finally {
      setLoaded(true)
    }
  }
  useEffect(() => {
    load()
    return onRefresh(load)
  }, [])

  const hasFilter = hasDateRange(dateRange)
  const filteredEntries = useMemo(
    () => entries.filter((entry) => !hasFilter || isInDateRange(entry.date || entry.createdAt, dateRange)),
    [entries, hasFilter, dateRange]
  )
  const sorted = useMemo(
    () => [...filteredEntries].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    [filteredEntries]
  )
  const sum = (t) => filteredEntries.filter((e) => e.type === t).reduce((s, e) => s + Number(e.amount), 0)
  const income = sum('income'), expense = sum('expense'), capital = sum('capital')
  const balance = income + capital - expense

  const totalCredit = txs.reduce((total, transaction) => {
    if (transaction.paymentType !== 'credit') return total
    return total + getBalanceDue(transaction)
  }, 0)

  const filteredTransactions = txs.filter((transaction) =>
    !hasFilter || isInDateRange(transaction.createdAt, dateRange)
  )
  const grossProfit = filteredTransactions.reduce(
    (s, t) => s + t.items.reduce((a, i) => a + (i.price - (i.cost || 0)) * i.qty, 0), 0
  )
  const netProfit = grossProfit - expense

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
        <div className="stat-card"><span>Total Kredit</span><strong className="danger">{rupiah(totalCredit)}</strong></div>
        <div className="stat-card highlight"><span>Saldo Kas</span><strong>{rupiah(balance)}</strong></div>
        <div className="stat-card"><span>Laba</span><strong className={netProfit >= 0 ? 'ok' : 'danger'}>{rupiah(netProfit)}</strong></div>
      </div>

      <div className="finance-date-filter">
        <div className="date-filter-caption">
          <strong>Filter periode keuangan</strong>
          <span className="muted">Pemasukan, pengeluaran, saldo, dan laba mengikuti tanggal yang dipilih.</span>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
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
              {sorted.length === 0 && <tr><td colSpan="6" className="muted center">
                {hasFilter ? 'Tidak ada catatan pada rentang tanggal ini.' : 'Belum ada catatan.'}
              </td></tr>}
              {sorted.map((e) => (
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

function getBalanceDue(transaction) {
  if (transaction.balanceDue != null && Number.isFinite(Number(transaction.balanceDue))) {
    return Math.max(0, Number(transaction.balanceDue))
  }
  const total = Number(transaction.total) || 0
  const paidAmount = transaction.paidAmount != null && Number.isFinite(Number(transaction.paidAmount))
    ? Number(transaction.paidAmount)
    : Math.min(total, Number(transaction.payment) || 0)
  return Math.max(0, total - paidAmount)
}
