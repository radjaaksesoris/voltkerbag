import { useEffect, useMemo, useState } from 'react'
import { getAll, remove, onRefresh } from '../db'
import { rupiah, dateTime } from '../format'
import DateRangeFilter from '../components/DateRangeFilter.jsx'
import { hasDateRange, isInDateRange } from '../dateFilter'

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

  if (!loaded) return <div className="page"><p className="muted">Memuat data keuangan dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  return (
    <div className="page">
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <div className="stats-grid">
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
          <h3>Buku Kas</h3>
          <table className="finance-ledger-table">
            <thead><tr><th>Waktu</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th className="right">Nominal</th><th></th></tr></thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan="6" className="muted center">
                {hasFilter ? 'Tidak ada catatan pada rentang tanggal ini.' : 'Belum ada catatan.'}
              </td></tr>}
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td>{dateTime(e.date || e.createdAt)}</td>
                  <td><span className={'badge ' + TYPES[e.type].cls}>{TYPES[e.type].label}</span></td>
                  <td>{e.category || '-'}</td>
                  <td>{e.note || '-'}</td>
                  <td className={'right ' + (e.type === 'expense' ? 'danger' : 'ok')}>
                    {e.type === 'expense' ? '−' : '+'}{rupiah(e.amount)}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={async () => {
                      if (!confirm('Hapus catatan ini?')) return
                      try {
                        await remove('finance', e.id)
                        setActionError('')
                      } catch (error) {
                        setActionError(error.message || 'Gagal menghapus catatan dari server.')
                      }
                    }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
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
