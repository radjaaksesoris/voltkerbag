import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import SessionControl from './components/SessionControl.jsx'
import Icon from './components/Icon.jsx'

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Transactions = lazy(() => import('./pages/Transactions.jsx'))
const Products = lazy(() => import('./pages/Products.jsx'))
const Finance = lazy(() => import('./pages/Finance.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

const NAV = [
  { id: 'dashboard', label: 'Dashboard', description: 'Ringkasan performa tokomu hari ini.', icon: 'dashboard' },
  { id: 'pos', label: 'Transaksi', description: 'Pilih produk, atur pembayaran, dan simpan transaksi.', icon: 'cart' },
  { id: 'stok', label: 'Stok Barang', description: 'Kelola katalog produk, harga, dan ketersediaan stok.', icon: 'bag' },
  { id: 'finance', label: 'Keuangan', description: 'Pantau pemasukan, pengeluaran, dan saldo kas toko.', icon: 'wallet' },
  { id: 'settings', label: 'Setting', description: 'Kelola nama pelanggan dan gambar produk.', icon: 'settings' }
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [navHidden, setNavHidden] = useState(false)
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const currentPage = NAV.find((n) => n.id === page)
  const contentRef = useRef(null)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    let authListenerInitialized = false

    async function verifyConnection() {
      if (!navigator.onLine) {
        if (active) {
          setSession(null)
          setConnectionError('Koneksi internet tidak tersedia. VOLTKER hanya dapat digunakan saat online.')
          setCheckingSession(false)
        }
        return
      }
      if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
        if (active) {
          setSession(null)
          setConnectionError('')
          setCheckingSession(false)
        }
        return
      }
      try {
        const { getAuthSession, onAuthStateChange } = await import('./supabaseSync')
        if (!active) return
        if (!authListenerInitialized) {
          unsubscribe = onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
              setSession(null)
              setConnectionError('')
            }
          })
          authListenerInitialized = true
        }
        const currentSession = await getAuthSession()
        if (!active) return
        setSession(currentSession)
        setConnectionError('')
      } catch (error) {
        if (!active) return
        setSession(null)
        setConnectionError(error.message || 'Tidak dapat menghubungi database server.')
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    const onOnline = () => { setCheckingSession(true); verifyConnection() }
    const onOffline = () => {
      setSession(null)
      setConnectionError('Koneksi internet tidak tersedia. VOLTKER hanya dapat digunakan saat online.')
      setCheckingSession(false)
    }

    verifyConnection()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const heartbeat = window.setInterval(verifyConnection, 30000)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(heartbeat)
    }
  }, [authCheckKey])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [page])

  if (checkingSession && !session && !connectionError) {
    return <main className="login-page"><p className="login-loading">Memeriksa koneksi dan sesi VOLTKER...</p></main>
  }

  if (!session || connectionError) {
    return (
      <LoginScreen
        configured={Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)}
        connectionError={connectionError}
        onSignedIn={(nextSession) => {
          setSession(nextSession)
          setConnectionError('')
        }}
        onRetry={() => {
          setCheckingSession(true)
          setConnectionError('')
          setAuthCheckKey((key) => key + 1)
        }}
      />
    )
  }

  return (
    <div className={'app ' + (navHidden ? 'nav-hidden' : '')}>
      <aside className="sidebar" id="primary-navigation" hidden={navHidden}>
        <div className="logo">
          <img
            src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
            width="320"
            height="79"
            alt="VOLTKER Toko Tas"
          />
        </div>
        <nav>
          {NAV.map((n) => (
            <button key={n.id}
              className={'nav-item ' + (page === n.id ? 'active' : '')}
              onClick={() => setPage(n.id)}>
              <span className="nav-icon"><Icon name={n.icon} size={19} /></span> {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="dot-online"></span> Online · Database server
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
              <Icon name="menu" size={20} />
            </button>
            <div className="topbar-title">
              <strong>{currentPage.label}</strong>
              <span>{currentPage.description}</span>
            </div>
          </div>
          <SessionControl email={session.user.email} onSignedOut={() => setSession(null)} />
        </header>

        <div className="content" ref={contentRef}>
          <Suspense fallback={<p className="login-loading">Memuat halaman...</p>}>
            {page === 'dashboard' && <Dashboard />}
            {page === 'pos' && <Transactions />}
            {page === 'stok' && <Products />}
            {page === 'finance' && <Finance />}
            {page === 'settings' && <Settings />}
          </Suspense>
        </div>
      </main>
    </div>
  )
}
