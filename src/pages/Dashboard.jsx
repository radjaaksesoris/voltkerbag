import { useEffect, useState } from 'react'
import { getAll, onRefresh } from '../db'
import { rupiah, dateTime, isToday } from '../format'
import DateRangeFilter from '../components/DateRangeFilter'
import { hasDateRange, isInDateRange } from '../dateFilter'
import TransactionDetails from '../components/TransactionDetails'
import { getInvoiceNumber } from '../invoice'
import { availableQuantity, stockInPcs, unitFactor } from '../productUnits'

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [txs, setTxs] = useState([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [productRows, transactionRows] = await Promise.all([
          getAll('products'),
          getAll('transactions')
        ])
        setProducts(productRows)
        setTxs(transactionRows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
        setLoadError('')
      } catch (error) {
        setLoadError(error.message || 'Gagal memuat data dashboard dari server.')
      } finally {
        setLoaded(true)
      }
    }
    load()
    return onRefresh(load)
  }, [])

  if (!loaded) return <div className="page"><p className="muted">Memuat data dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

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
  const totalAsset = products.reduce(
    (sum, product) => sum + (Number(product.cost) || 0) * stockInPcs(product) / unitFactor(product.unit),
    0
  )
  const lowStock = products.filter((product) => availableQuantity(product, product.unit || 'pcs') <= 5)

  return (
    <div className="page">
      <div className="dashboard-filter-row">
        <div className="date-filter-caption">
          <strong>{hasFilter ? 'Ringkasan periode' : 'Ringkasan hari ini'}</strong>
          <span className="muted">{hasFilter ? 'Sesuaikan rentang untuk melihat performa.' : 'Pilih rentang tanggal untuk melihat laporan lain.'}</span>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>
      <div className="stats-grid dashboard-stats-grid">
        <div className="stat-card highlight"><span>{hasFilter ? 'Omzet Periode' : 'Omzet Hari Ini'}</span><strong>{rupiah(omzet)}</strong></div>
        <div className="stat-card"><span>{hasFilter ? 'Laba Kotor Periode' : 'Laba Kotor Hari Ini'}</span><strong className="ok">{rupiah(profit)}</strong></div>
        <div className="stat-card dashboard-stock-summary">
          <div className="dashboard-stock-metric">
            <span>Nilai Stok (Modal)</span>
            <strong>{rupiah(totalAsset)}</strong>
          </div>
          <div className="dashboard-stock-metric">
            <span>Total Produk</span>
            <strong>{products.length}</strong>
          </div>
        </div>
        <div className="stat-card"><span>Stok Menipis</span><strong className={lowStock.length ? 'danger' : ''}>{lowStock.length}</strong></div>
      </div>

      <div className="card table-card dashboard-transactions">
        <h3>Transaksi Terakhir</h3>
        <table className="dashboard-transaction-table">
          <thead>
            <tr><th>No</th><th>Nama <span className="th-subtitle">No. Faktur</span></th><th>Tanggal Transaksi</th><th className="right">Nominal Transaksi</th><th className="right">Detail</th></tr>
          </thead>
          <tbody>
            {visibleTx.length === 0 && <tr><td colSpan="5" className="muted center">
              {hasFilter ? 'Tidak ada transaksi pada rentang tanggal ini.' : 'Belum ada transaksi.'}
            </td></tr>}
            {visibleTx.slice(0, 8).map((t, index) => (
              <tr key={t.id}>
                <td className="dashboard-row-number">{index + 1}</td>
                <td>
                  <strong className="transaction-customer">{t.customerName || 'Pelanggan lama'}</strong>
                  <span className="transaction-invoice">{getInvoiceNumber(t)}</span>
                </td>
                <td>{dateTime(t.createdAt)}</td>
                <td className="right accent"><strong>{rupiah(t.total)}</strong></td>
                <td className="right">
                  <button className="btn btn-sm btn-primary" onClick={() => setSelectedTransaction(t)}>Detail</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedTransaction && (
        <TransactionDetails transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
      )}
    </div>
  )
}
