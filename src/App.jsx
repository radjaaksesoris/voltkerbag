import { useEffect, useRef, useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Products from './pages/Products.jsx'
import Finance from './pages/Finance.jsx'
import SyncButton from './components/SyncButton.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', description: 'Ringkasan performa tokomu hari ini.', icon: '📊' },
  { id: 'pos', label: 'Kasir / Transaksi', description: 'Pilih produk, atur pembayaran, dan simpan transaksi.', icon: '🛒' },
  { id: 'stok', label: 'Stok Barang', description: 'Kelola katalog produk, harga, dan ketersediaan stok.', icon: '👜' },
  { id: 'finance', label: 'Keuangan', description: 'Pantau pemasukan, pengeluaran, dan saldo kas toko.', icon: '💰' }
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [navHidden, setNavHidden] = useState(false)
  const currentPage = NAV.find((n) => n.id === page)
  const contentRef = useRef(null)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [page])

  return (
    <div className={'app ' + (navHidden ? 'nav-hidden' : '')}>
      <aside className="sidebar" id="primary-navigation" hidden={navHidden}>
        <div className="logo">
          <span className="logo-bolt">⚡</span> VOLTKER
          <span className="logo-sub">Toko Tas</span>
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id}
              className={'nav-item ' + (page === n.id ? 'active' : '')}
              onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot-online"></span> Mode Offline · IndexedDB
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="nav-toggle"
              type="button"
              aria-label={navHidden ? 'Tampilkan navigasi' : 'Sembunyikan navigasi'}
              aria-controls="primary-navigation"
              aria-expanded={!navHidden}
              onClick={() => setNavHidden((hidden) => !hidden)}>
              <span className="hamburger-icon" aria-hidden="true"><i /><i /><i /></span>
            </button>
            <div className="topbar-title">
              <strong>{currentPage.label}</strong>
              <span>{currentPage.description}</span>
            </div>
          </div>
          <SyncButton />
        </header>

        <div className="content" ref={contentRef}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'pos' && <Transactions />}
          {page === 'stok' && <Products />}
          {page === 'finance' && <Finance />}
        </div>
      </main>
    </div>
  )
}
