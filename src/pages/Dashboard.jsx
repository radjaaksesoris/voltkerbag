import { useEffect, useState } from 'react'
import { getAll, onRefresh } from '../db'
import { rupiah, dateTime, isToday } from '../format'
import DateRangeFilter from '../components/DateRangeFilter'
import { hasDateRange, isInDateRange } from '../dateFilter'

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [txs, setTxs] = useState([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  useEffect(() => {
    async function load() {
      setProducts(await getAll('products'))
      const t = await getAll('transactions')
      setTxs(t.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    }
    load()
    return onRefresh(load)
  }, [])

  const hasFilter = hasDateRange(dateRange)
  const selectedTx = hasFilter
    ? txs.filter((t) => isInDateRange(t.createdAt, dateRange))
    : txs.filter((t) => isToday(t.createdAt))
  const omzet = selectedTx.reduce((s, t) => s + t.total, 0)
  const profit = selectedTx.reduce(
    (s, t) => s + t.items.reduce((a, i) => a + (i.price - (i.cost || 0)) * i.qty, 0), 0
  )
  const visibleTx = hasFilter
    ? txs.filter((t) => isInDateRange(t.createdAt, dateRange))
    : txs
  const totalAsset = products.reduce((s, p) => s + (p.cost || 0) * p.stock, 0)
  const lowStock = products.filter((p) => Number(p.stock) <= 5)

  return (
    <div className="page">
      <div className="dashboard-filter-row">
        <div className="date-filter-caption">
          <strong>{hasFilter ? 'Ringkasan periode' : 'Ringkasan hari ini'}</strong>
          <span className="muted">{hasFilter ? 'Sesuaikan rentang untuk melihat performa.' : 'Pilih rentang tanggal untuk melihat laporan lain.'}</span>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>
      <div className="stats-grid">
        <div className="stat-card highlight"><span>{hasFilter ? 'Omzet Periode' : 'Omzet Hari Ini'}</span><strong>{rupiah(omzet)}</strong></div>
        <div className="stat-card"><span>{hasFilter ? 'Laba Kotor Periode' : 'Laba Kotor Hari Ini'}</span><strong className="ok">{rupiah(profit)}</strong></div>
        <div className="stat-card"><span>Nilai Stok (Modal)</span><strong>{rupiah(totalAsset)}</strong></div>
        <div className="stat-card"><span>Total Produk</span><strong>{products.length}</strong></div>
        <div className="stat-card"><span>Stok Menipis</span><strong className={lowStock.length ? 'danger' : ''}>{lowStock.length}</strong></div>
      </div>

      <div className="card table-card dashboard-transactions">
        <h3>Transaksi Terakhir</h3>
        <table>
          <thead><tr><th>Waktu</th><th>Item</th><th className="right">Total</th></tr></thead>
          <tbody>
            {visibleTx.length === 0 && <tr><td colSpan="3" className="muted center">
              {hasFilter ? 'Tidak ada transaksi pada rentang tanggal ini.' : 'Belum ada transaksi.'}
            </td></tr>}
            {visibleTx.slice(0, 8).map((t) => (
              <tr key={t.id}>
                <td>{dateTime(t.createdAt)}</td>
                <td>{t.items.map((i) => i.name + ' ×' + i.qty).join(', ')}</td>
                <td className="right accent"><strong>{rupiah(t.total)}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
