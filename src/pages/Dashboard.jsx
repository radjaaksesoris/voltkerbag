import { useEffect, useRef, useState } from 'react'
import { getAll, getDashboardData, onRefresh } from '../db'
import { rupiah, dateOnly, dateTime } from '../format'
import DateRangeFilter from '../components/DateRangeFilter'
import { dateRangeTimestamps, hasDateRange, localDateValue } from '../dateFilter'
import TransactionDetails from '../components/TransactionDetails'
import { getInvoiceNumber } from '../invoice'
import Icon from '../components/Icon.jsx'
import CustomerIdentity from '../components/CustomerIdentity.jsx'

const TRANSACTIONS_PER_PAGE = 15

export default function Dashboard() {
  const [report, setReport] = useState({
    transactions: [],
    total_count: 0,
    summary_count: 0,
    revenue: 0,
    gross_profit: 0,
    inventory: { product_count: 0, low_stock_count: 0, total_asset: 0 }
  })
  const [dateRange, setDateRange] = useState(() => {
    const today = localDateValue(new Date())
    return { from: today, to: today }
  })
  const [creditFirst, setCreditFirst] = useState(false)
  const [nameSort, setNameSort] = useState('date')
  const [transactionPage, setTransactionPage] = useState(1)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [customers, setCustomers] = useState([])
  const [customerLoadError, setCustomerLoadError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
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
      setRefreshing(true)
      try {
        const hasFilter = hasDateRange(dateRange)
        const listRange = hasFilter
          ? dateRangeTimestamps(dateRange)
          : { from: null, to: null }
        const summaryRange = hasFilter
          ? listRange
          : dateRangeTimestamps({ from: localDateValue(new Date()), to: localDateValue(new Date()) })
        const dashboardData = await getDashboardData({
          ...listRange,
          summaryFrom: summaryRange.from,
          summaryTo: summaryRange.to,
          page: transactionPage,
          pageSize: TRANSACTIONS_PER_PAGE,
          creditFirst,
          nameSort
        })
        if (!active || currentRequest !== requestId.current) return
        if (!dashboardData.inventory) {
          throw new Error('Ringkasan stok belum tersedia. Jalankan pembaruan supabase/schema.sql, lalu muat ulang.')
        }
        const pageCount = Math.max(1, Math.ceil(dashboardData.total_count / TRANSACTIONS_PER_PAGE))
        if (transactionPage > pageCount) {
          setTransactionPage(pageCount)
          return
        }
        setReport(dashboardData)
        setLoadError('')
      } catch (error) {
        if (!active || currentRequest !== requestId.current) return
        setLoadError(error.message || 'Gagal memuat data dashboard dari server.')
      } finally {
        if (active && currentRequest === requestId.current) {
          setLoaded(true)
          setRefreshing(false)
        }
      }
    }
    load()
    const unsubscribe = onRefresh(load)
    return () => {
      active = false
      unsubscribe()
    }
  }, [dateRange, transactionPage, creditFirst, nameSort])

  if (!loaded) return <div className="page"><p className="muted">Memuat data dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  const today = localDateValue(new Date())
  const isTodayRange = dateRange.from === today && dateRange.to === today
  const hasFilter = hasDateRange(dateRange)
  const pageCount = Math.max(1, Math.ceil(report.total_count / TRANSACTIONS_PER_PAGE))
  const currentPage = Math.min(transactionPage, pageCount)
  const pageStart = (currentPage - 1) * TRANSACTIONS_PER_PAGE
  const pageTransactions = report.transactions
  const totalAsset = Number(report.inventory?.total_asset || 0)
  const lowStockCount = Number(report.inventory?.low_stock_count || 0)
  const productCount = Number(report.inventory?.product_count || 0)

  function updateSelectedTransaction(updatedTransaction) {
    setReport((current) => ({
      ...current,
      transactions: current.transactions.map((transaction) =>
        transaction.id === updatedTransaction.id ? updatedTransaction : transaction
      )
    }))
    setSelectedTransaction(updatedTransaction)
  }

  return (
    <div className="page">
      <div className="dashboard-filter-row">
        <div className="date-filter-caption">
          <strong>{isTodayRange ? 'Ringkasan hari ini' : 'Ringkasan periode'}</strong>
          <span className="muted">{isTodayRange ? 'Pilih rentang tanggal untuk melihat laporan lain.' : 'Sesuaikan rentang untuk melihat performa.'}</span>
        </div>
        <DateRangeFilter value={dateRange} onChange={(range) => {
          setDateRange(range)
          setTransactionPage(1)
        }} resetValue={{ from: today, to: today }} resetLabel="Hari ini" />
      </div>
      <div className="stats-grid dashboard-stats-grid">
        <div className="stat-card highlight dashboard-revenue-card">
          <span>{isTodayRange ? 'Omzet Hari Ini' : 'Omzet Periode'}</span>
          <strong>{rupiah(report.revenue)}</strong>
        </div>
        <div className="stat-card"><span>{isTodayRange ? 'Laba Kotor Hari Ini' : 'Laba Kotor Periode'}</span><strong className="ok">{rupiah(report.gross_profit)}</strong></div>
        <div className="stat-card dashboard-stock-summary">
          <span>Nilai Stok (Modal)</span>
          <strong>{rupiah(totalAsset)}</strong>
        </div>
        <div className="stat-card dashboard-stock-counts">
          <div className="dashboard-stock-metric">
            <span>Stok Menipis</span>
            <strong className={lowStockCount ? 'danger' : ''}>{lowStockCount}</strong>
          </div>
          <div className="dashboard-stock-metric">
            <span>Total Produk</span>
            <strong>{productCount}</strong>
          </div>
        </div>
      </div>

      <div className="card table-card dashboard-transactions">
        {customerLoadError && <p className="form-error" role="alert">{customerLoadError}</p>}
        <div className="dashboard-transactions-heading">
          <h3>Transaksi Terakhir</h3>
          <button
            className="btn btn-sm"
            type="button"
            disabled={refreshing}
            aria-label={refreshing ? 'Memuat data dashboard' : 'Refresh data dashboard'}
            onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>
            <Icon name="sync" size={14} />
            {refreshing ? 'Memuat...' : 'Refresh'}
          </button>
        </div>
        <table className="dashboard-transaction-table">
          <thead>
            <tr>
              <th className="dashboard-row-number">No</th>
              <th>
                <button
                  type="button"
                  className={'dashboard-payment-sort' + (nameSort !== 'date' ? ' active' : '')}
                  aria-pressed={nameSort !== 'date'}
                  aria-label={
                    nameSort === 'asc'
                      ? 'Urutkan nama Z ke A'
                      : nameSort === 'desc'
                        ? 'Urutkan nama berdasarkan tanggal transaksi'
                        : 'Urutkan nama A ke Z'
                  }
                  onClick={() => {
                    setCreditFirst(false)
                    setNameSort((current) => current === 'date' ? 'asc' : current === 'asc' ? 'desc' : 'date')
                    setTransactionPage(1)
                  }}>
                  <span>NAMA</span>
                  <span className="dashboard-payment-sort-indicator" aria-hidden="true">
                    {nameSort === 'asc' ? '↑' : nameSort === 'desc' ? '↓' : '↕'}
                  </span>
                </button>
              </th>
              <th>TANGGAL</th>
              <th>
                <button
                  type="button"
                  className={'dashboard-payment-sort' + (creditFirst ? ' active' : '')}
                  aria-pressed={creditFirst}
                  aria-label={creditFirst ? 'Urutkan kembali berdasarkan tanggal' : 'Tampilkan kredit yang belum lunas di atas'}
                  onClick={() => {
                    setCreditFirst((current) => !current)
                    setNameSort('date')
                    setTransactionPage(1)
                  }}>
                  <span>PEMBAYARAN</span>
                  <span className="dashboard-payment-sort-indicator" aria-hidden="true">{creditFirst ? '↑' : '↕'}</span>
                </button>
              </th>
              <th className="right">NOMINAL</th>
              <th className="right">DETAIL</th>
            </tr>
          </thead>
          <tbody>
            {report.total_count === 0 && <tr><td colSpan="6" className="muted center">
              {hasFilter ? 'Tidak ada transaksi pada rentang tanggal ini.' : 'Belum ada transaksi.'}
            </td></tr>}
            {pageTransactions.map((t, index) => {
              const balanceDue = getTransactionBalanceDue(t)
              const isCredit = t.paymentType === 'credit'
              const isPaid = isCredit && balanceDue === 0
              const isPartiallyPaid = isCredit && !isPaid && getTransactionPaidAmount(t) > 0
              return (
                <tr key={t.id}>
                  <td className="dashboard-row-number">{pageStart + index + 1}</td>
                  <td>
                    <div className="dashboard-customer-cell">
                      <CustomerIdentity
                        name={t.customerName}
                        customer={customers.find((customer) => customer.name === t.customerName)}
                        className="transaction-customer"
                      />
                      <span className="transaction-invoice">{getInvoiceNumber(t)}</span>
                    </div>
                  </td>
                  <td>
                    <span className="dashboard-date-desktop">{dateTime(t.createdAt)}</span>
                    <span className="dashboard-date-mobile">{dateOnly(t.createdAt)}</span>
                  </td>
                  <td><span className={'badge ' + (isPartiallyPaid ? 'badge-partial' : isCredit && !isPaid ? 'badge-danger' : 'badge-ok')}>
                    {isPaid ? 'Lunas' : isCredit ? 'Kredit' : 'Tunai'}
                  </span></td>
                  <td className="right accent">
                    <strong className="dashboard-amount-desktop">{rupiah(t.total)}</strong>
                    <strong className="dashboard-amount-mobile">{rupiah(t.total).replace(/[^\d.,-]/g, '')}</strong>
                  </td>
                  <td className="right">
                    <button className="btn btn-sm btn-primary" onClick={() => setSelectedTransaction({
                      ...t,
                      customerPhone: customers.find((customer) => customer.name === t.customerName)?.phone || '',
                      customerAddress: customers.find((customer) => customer.name === t.customerName)?.address || '',
                      expedition: t.expedition || ''
                    })}>Detail</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {report.total_count > 0 && (
          <div className="dashboard-pagination">
            <span className="muted small">
              Menampilkan {pageStart + 1}–{Math.min(pageStart + TRANSACTIONS_PER_PAGE, report.total_count)} dari {report.total_count} transaksi
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
          allowPayment={false}
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
  return Math.max(0, total - getTransactionPaidAmount(transaction))
}

function getTransactionPaidAmount(transaction) {
  if (transaction.paidAmount != null && Number.isFinite(Number(transaction.paidAmount))) {
    return Number(transaction.paidAmount)
  }
  return Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
}
