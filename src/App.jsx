import { useState } from 'react'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Products from './pages/Products.jsx'
import Finance from './pages/Finance.jsx'
import SyncButton from './components/SyncButton.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'pos', label: 'Kasir / Transaksi', icon: '🛒' },
  { id: 'stok', label: 'Stok Barang', icon: '👜' },
  { id: 'finance', label: 'Keuangan', icon: '💰' }
]

export default function App() {
  const [page, setPage] = useState('dashboard')

  return (
    <div className="app">
      <aside className="sidebar">
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
          <div className={'topbar-title ' + (page === 'dashboard' ? 'topbar-title-dashboard' : '')}>
            {page === 'dashboard' ? (
              <>
                <strong>Dashboard</strong>
                <span>Ringkasan performa tokomu hari ini.</span>
              </>
            ) : (
              <>
                <strong>Operasional toko</strong>
                <span>Penjualan, stok, dan keuangan dalam satu tempat</span>
              </>
            )}
          </div>
          <SyncButton />
        </header>

        <div className="content">
          {page === 'dashboard' && <Dashboard />}
          {page === 'pos' && <Transactions />}
          {page === 'stok' && <Products />}
          {page === 'finance' && <Finance />}
        </div>
      </main>
    </div>
  )
}
