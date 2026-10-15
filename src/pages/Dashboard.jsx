import { useEffect, useState } from 'react'
import { getAll, onRefresh } from '../db'
import { rupiah, dateTime, isToday } from '../format'
import DateRangeFilter from '../components/DateRangeFilter'
import { hasDateRange, isInDateRange } from '../dateFilter'
import TransactionDetails from '../components/TransactionDetails'
import { getInvoiceNumber } from '../invoice'
import { availableQuantity, stockCostValue } from '../productUnits'

const TRANSACTIONS_PER_PAGE = 15

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [txs, setTxs] = useState([])
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [transactionPage, setTransactionPage] = useState(1)
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
  const cashOmzet = selectedTx
    .filter((t) => t.paymentType !== 'credit')
    .reduce((sum, t) => sum + t.total, 0)
  const creditOmzet = selectedTx
    .filter((t) => t.paymentType === 'credit')
    .reduce((sum, t) => sum + t.total, 0)
  const profit = selectedTx.reduce(
    (s, t) => s + t.items.reduce((a, i) => a + (i.price - (i.cost || 0)) * i.qty, 0), 0
  )
  const visibleTx = hasFilter
    ? txs.filter((t) => isInDateRange(t.createdAt, dateRange))
    : txs
  const pageCount = Math.max(1, Math.ceil(visibleTx.length / TRANSACTIONS_PER_PAGE))
  const currentPage = Math.min(transactionPage, pageCount)
  const pageStart = (currentPage - 1) * TRANSACTIONS_PER_PAGE
  const pageTransactions = visibleTx.slice(pageStart, pageStart + TRANSACTIONS_PER_PAGE)
  const totalAsset = products.reduce((sum, product) => sum + stockCostValue(product), 0)
  const lowStock = products.filter((product) => availableQuantity(product, product.unit || 'pcs') <= 5)

  function updateSelectedTransaction(updatedTransaction) {
    setTxs((current) => current.map((transaction) =>
      transaction.id === updatedTransaction.id ? updatedTransaction : transaction
    ))
    setSelectedTransaction(updatedTransaction)
  }

  return (
    <div className="page">
      <div className="dashboard-filter-row">
        <div className="date-filter-caption">
          <strong>{hasFilter ? 'Ringkasan periode' : 'Ringkasan hari ini'}</strong>
          <span className="muted">{hasFilter ? 'Sesuaikan rentang untuk melihat performa.' : 'Pilih rentang tanggal untuk melihat laporan lain.'}</span>
        </div>
        <DateRangeFilter value={dateRange} onChange={(range) => {
          setDateRange(range)
          setTransactionPage(1)
        }} />
      </div>
      <div className="stats-grid dashboard-stats-grid">
        <div className="stat-card highlight dashboard-revenue-card">
          <span>{hasFilter ? 'Omzet Periode' : 'Omzet Hari Ini'}</span>
          <strong>{rupiah(omzet)}</strong>
          <div className="dashboard-revenue-breakdown" aria-label="Rincian omzet berdasarkan metode pembayaran">
            <div><span>Tunai</span><strong>{rupiah(cashOmzet)}</strong></div>
            <div><span>Kredit</span><strong>{rupiah(creditOmzet)}</strong></div>
          </div>
        </div>
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
            <tr><th>No</th><th>Nama</th><th>Tanggal Transaksi</th><th>Pembayaran</th><th className="right">Nominal / Sisa Tagihan</th><th className="right">Detail</th></tr>
          </thead>
          <tbody>
            {visibleTx.length === 0 && <tr><td colSpan="6" className="muted center">
              {hasFilter ? 'Tidak ada transaksi pada rentang tanggal ini.' : 'Belum ada transaksi.'}
            </td></tr>}
            {pageTransactions.map((t, index) => {
              const balanceDue = getTransactionBalanceDue(t)
              const isCredit = t.paymentType === 'credit'
              const isPaid = isCredit && balanceDue === 0
              return (
                <tr key={t.id}>
                  <td className="dashboard-row-number">{pageStart + index + 1}</td>
                  <td>
                    <strong className="transaction-customer">{t.customerName || 'Pelanggan lama'}</strong>
                    <span className="transaction-invoice">{getInvoiceNumber(t)}</span>
                  </td>
                  <td>{dateTime(t.createdAt)}</td>
                  <td><span className={'badge ' + (isCredit && !isPaid ? 'badge-danger' : 'badge-ok')}>
                    {isPaid ? 'Lunas' : isCredit ? 'Kredit' : 'Tunai'}
                  </span></td>
                  <td className="right accent"><strong>{rupiah(isCredit ? balanceDue : t.total)}</strong></td>
                  <td className="right">
                    <button className="btn btn-sm btn-primary" onClick={() => setSelectedTransaction(t)}>Detail</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {visibleTx.length > 0 && (
          <div className="dashboard-pagination">
            <span className="muted small">
              Menampilkan {pageStart + 1}–{Math.min(pageStart + TRANSACTIONS_PER_PAGE, visibleTx.length)} dari {visibleTx.length} transaksi
            </span>
            {pageCount > 1 && (
              <div className="dashboard-pagination-controls" aria-label="Navigasi halaman transaksi">
                <button
                  className="btn btn-sm"
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setTransactionPage(currentPage - 1)}>
                  Sebelumnya
                </button>
                <span className="small">Halaman {currentPage} dari {pageCount}</span>
                <button
                  className="btn btn-sm"
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => setTransactionPage(currentPage + 1)}>
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {selectedTransaction && (
        <TransactionDetails
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onTransactionUpdated={updateSelectedTransaction}
        />
      )}
    </div>
  )
}

function getTransactionBalanceDue(transaction) {
  if (transaction.balanceDue != null && Number.isFinite(Number(transaction.balanceDue))) {
    return Math.max(0, Number(transaction.balanceDue))
  }
  const total = Number(transaction.total) || 0
  const paidAmount = transaction.paidAmount != null && Number.isFinite(Number(transaction.paidAmount))
    ? Number(transaction.paidAmount)
    : Math.min(total, Number(transaction.payment) || 0)
  return Math.max(0, total - paidAmount)
}
