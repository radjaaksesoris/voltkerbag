import { memo, Suspense, lazy, useEffect, useRef, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import SessionControl from './components/SessionControl.jsx'
import PageErrorBoundary from './components/PageErrorBoundary.jsx'
import CustomNumpad from './components/CustomNumpad.jsx'
import AppDisabledNotice from './components/AppDisabledNotice.jsx'
import Icon from './components/Icon.jsx'
import LoadingNumber from './components/LoadingNumber.jsx'
import { APP_TEMPORARILY_DISABLED } from './appAvailability.js'
import { clearRequestedAppMode } from './appMode.js'

const CHUNK_RELOAD_KEY = 'voltker:chunk-reload-attempted'

function PageLoadingFallback({ pageId }) {
  if (pageId === 'dashboard') {
    return (
      <div className="page dashboard-page">
        <div className="dashboard-filter-sticky">
          <div className="dashboard-filter-row">
            <div className="dashboard-date-range">
              <label className="dashboard-date-field">
                <Icon name="calendar" size={23} />
                <span>Dari Tanggal</span>
                <input type="date" disabled aria-label="Dari tanggal" />
              </label>
              <label className="dashboard-date-field">
                <Icon name="calendar" size={23} />
                <span>Sampai Tanggal</span>
                <input type="date" disabled aria-label="Sampai tanggal" />
              </label>
              <button className="dashboard-date-reset" type="button" disabled>
                <Icon name="sync" size={18} />
                <span>Hari Ini</span>
              </button>
              <button className="dashboard-date-search" type="button" disabled>
                <Icon name="search" size={22} />
                <span>Cari</span>
              </button>
            </div>
          </div>
        </div>
        <div className="dashboard-overview-sticky">
          <div className="dashboard-insights-heading">
            <div>
              <span className="dashboard-insights-kicker">PERFORMA TOKO</span>
              <h3>Ringkasan penjualan</h3>
            </div>
            <span className="dashboard-insights-period" role="status">Memuat data...</span>
          </div>
          <div className="stats-grid dashboard-stats-grid" aria-label="Memuat ringkasan penjualan">
            <div className="stat-card dashboard-stat-card dashboard-revenue-card">
              <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
              <div className="dashboard-stat-content">
                <span>Omzet Hari Ini</span>
                <strong><LoadingNumber label="omzet hari ini" /></strong>
              </div>
            </div>
            <div className="stat-card dashboard-stat-card dashboard-profit-card">
              <span className="dashboard-stat-icon"><Icon name="tag" size={27} /></span>
              <div className="dashboard-stat-content">
                <span>Laba Kotor Hari Ini</span>
                <strong><LoadingNumber label="laba kotor hari ini" /></strong>
              </div>
            </div>
            <div className="stat-card dashboard-stat-card dashboard-stock-summary">
              <span className="dashboard-stat-icon"><Icon name="box" size={27} /></span>
              <div className="dashboard-stat-content">
                <span>Nilai Stok (Modal)</span>
                <strong><LoadingNumber label="nilai stok" /></strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (pageId === 'finance') {
    return (
      <div className="page">
        <div className="finance-overview-sticky">
          <div className="finance-date-filter">
            <div className="finance-date-range">
              <label className="dashboard-date-field">
                <Icon name="calendar" size={23} />
                <span>Dari tanggal</span>
                <input type="date" disabled aria-label="Dari tanggal" />
              </label>
              <label className="dashboard-date-field">
                <Icon name="calendar" size={23} />
                <span>Sampai tanggal</span>
                <input type="date" disabled aria-label="Sampai tanggal" />
              </label>
              <div className="finance-date-quick-actions">
                <button className="finance-date-quick" type="button" disabled>Hari ini</button>
                <button className="finance-date-quick" type="button" disabled>Bulan ini</button>
              </div>
            </div>
          </div>
          <div className="stats-grid dashboard-stats-grid finance-summary-grid finance-loading-summary" aria-label="Memuat ringkasan keuangan">
            <div className="stat-card dashboard-stat-card finance-income-card">
              <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
              <div className="dashboard-stat-content">
                <span>Pemasukan Penjualan</span>
                <strong>+<LoadingNumber label="pemasukan penjualan" /></strong>
              </div>
            </div>
            <div className="stat-card dashboard-stat-card debt-stat-card finance-debt-card">
              <span className="dashboard-stat-icon"><Icon name="tag" size={27} /></span>
              <span className="dashboard-stat-content">
                <span>Total Hutang</span>
                <strong><LoadingNumber label="total hutang" /></strong>
                <span className="debt-stat-hint">Memuat data...</span>
              </span>
            </div>
            <div className="stat-card dashboard-stat-card finance-cash-card">
              <span className="dashboard-stat-icon"><Icon name="wallet" size={27} /></span>
              <div className="dashboard-stat-content">
                <span>Saldo Kas</span>
                <strong><LoadingNumber label="saldo kas" /></strong>
              </div>
            </div>
            <div className="stat-card dashboard-stat-card finance-profit-card">
              <span className="dashboard-stat-icon"><Icon name="trend" size={27} /></span>
              <div className="dashboard-stat-content">
                <span>Laba</span>
                <strong><LoadingNumber label="laba" /></strong>
              </div>
            </div>
          </div>
        </div>
        <p className="muted">Memuat data keuangan dari server...</p>
      </div>
    )
  }

  return <p className="login-loading" role="status">Memuat halaman...</p>
}

function lazyPage(importPage, preload = false) {
  let pagePromise
  const loadPage = () => {
    if (!pagePromise) {
      pagePromise = importPage()
        .then((module) => {
          sessionStorage.removeItem(CHUNK_RELOAD_KEY)
          return module
        })
        .catch((error) => {
          if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
            sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
            window.location.reload()
          }
          throw error
        })
    }
    return pagePromise
  }
  if (preload) {
    loadPage().catch((error) => {
      console.error('Gagal memuat halaman menu:', error)
    })
  }
  return lazy(loadPage)
}

const Menu = memo(lazyPage(() => import('./pages/Menu.jsx'), true))
const Dashboard = memo(lazyPage(() => import('./pages/Dashboard.jsx')))
const Transactions = memo(lazyPage(() => import('./pages/Transactions.jsx')))
const Purchases = memo(lazyPage(() => import('./pages/Purchases.jsx')))
const Products = memo(lazyPage(() => import('./pages/Products.jsx')))
const Finance = memo(lazyPage(() => import('./pages/Finance.jsx')))
const Settings = memo(lazyPage(() => import('./pages/Settings.jsx')))

const PAGES = {
  dashboard: Dashboard,
  pos: Transactions,
  menu: Menu,
  purchases: Purchases,
  stok: Products,
  finance: Finance,
  settings: Settings
}

const NAV = [
  { id: 'dashboard', label: 'Rekap Harian', description: 'Ringkasan performa tokomu hari ini.', icon: 'dashboard' },
  { id: 'pos', label: 'Transaksi', description: 'Pilih produk, atur pembayaran, dan simpan transaksi.', icon: 'cart' },
  { id: 'menu', label: 'Menu', description: 'Pilih fitur yang ingin dibuka.', icon: 'more' },
  { id: 'purchases', label: 'Pembelian', description: 'Catat pembelian bahan untuk kebutuhan produksi.', icon: 'purchase' },
  { id: 'stok', label: 'Stok Barang', description: 'Kelola katalog produk, harga, dan ketersediaan stok.', icon: 'bag' },
  { id: 'finance', label: 'Keuangan', description: 'Pantau pemasukan, pengeluaran, dan saldo kas toko.', icon: 'wallet' },
  { id: 'settings', label: 'Setting', description: 'Kelola nama pelanggan dan gambar produk.', icon: 'settings' }
]

function getInitialPage() {
  return 'menu'
}

function ActiveApp() {
  const [page, setPage] = useState(getInitialPage)
  const [visitedPages, setVisitedPages] = useState(() => new Set([getInitialPage()]))
  const [navHidden, setNavHidden] = useState(false)
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [logoutBusy, setLogoutBusy] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
  const [showInstallInstructions, setShowInstallInstructions] = useState(false)
  const [installError, setInstallError] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  const [applyingUpdate, setApplyingUpdate] = useState(false)
  const [returningToMenu, setReturningToMenu] = useState(false)
  const currentPage = NAV.find((n) => n.id === page)
  const contentRef = useRef(null)
  const serviceWorkerRegistration = useRef(null)
  const pendingLoginTarget = useRef(null)
  const returnTransitionTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(returnTransitionTimer.current), [])

  function navigateToPage(nextPage) {
    setVisitedPages((visited) => {
      if (visited.has(nextPage)) return visited
      return new Set([...visited, nextPage])
    })
    setPage(nextPage)
  }

  function returnToMenu() {
    if (returningToMenu) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigateToPage('menu')
      return
    }

    setReturningToMenu(true)
    returnTransitionTimer.current = window.setTimeout(() => navigateToPage('menu'), 550)
  }

  function finishReturnTransition(event) {
    if (event.target !== event.currentTarget || event.animationName !== 'menu-return-flow') return
    window.clearTimeout(returnTransitionTimer.current)
    returnTransitionTimer.current = null
    setReturningToMenu(false)
  }

  async function logoutFromMenu() {
    setLogoutBusy(true)
    setLogoutError('')
    try {
      const { signOut } = await import('./supabaseSync')
      await signOut()
      clearRequestedAppMode()
      setSession(null)
    } catch (error) {
      setLogoutError(error.message || String(error))
    } finally {
      setLogoutBusy(false)
    }
  }

  useEffect(() => {
    function captureInstallPrompt(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }
    function markInstalled() {
      setIsInstalled(true)
      setInstallPrompt(null)
      setShowInstallInstructions(false)
    }

    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let isActive = true
    let registration
    let installingWorker

    function checkWaitingWorker() {
      if (registration?.waiting && navigator.serviceWorker.controller) {
        setUpdateReady(true)
      }
    }

    function observeInstallingWorker() {
      installingWorker?.removeEventListener('statechange', onWorkerStateChange)
      installingWorker = registration?.installing
      installingWorker?.addEventListener('statechange', onWorkerStateChange)
    }

    function onWorkerStateChange() {
      if (installingWorker?.state === 'installed') checkWaitingWorker()
    }

    function onServiceWorkerMessage(event) {
      if (event.data?.type === 'UPDATE_READY') setUpdateReady(true)
    }

    async function trackServiceWorker() {
      try {
        await navigator.serviceWorker.ready
        if (!isActive) return
        registration = await navigator.serviceWorker.getRegistration()
        if (!registration) return
        serviceWorkerRegistration.current = registration
        registration.addEventListener('updatefound', observeInstallingWorker)
        observeInstallingWorker()
        checkWaitingWorker()
      } catch (error) {
        console.error('Gagal memeriksa pembaruan aplikasi:', error)
      }
    }

    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage)
    trackServiceWorker()

    return () => {
      isActive = false
      installingWorker?.removeEventListener('statechange', onWorkerStateChange)
      registration?.removeEventListener('updatefound', observeInstallingWorker)
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage)
      if (serviceWorkerRegistration.current === registration) {
        serviceWorkerRegistration.current = null
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    let authListenerInitialized = false
    let checkingConnection = false

    async function verifyConnection() {
      if (checkingConnection) return
      checkingConnection = true
      if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
        if (active) {
          setSession(null)
          setConnectionError('')
          setCheckingSession(false)
        }
        checkingConnection = false
        return
      }
      try {
        const { getAuthSession, onAuthStateChange, verifyAuthSession } = await import('./supabaseSync')
        if (!active) return
        if (!authListenerInitialized) {
          unsubscribe = onAuthStateChange((event, nextSession) => {
            if (event === 'SIGNED_OUT') {
              clearRequestedAppMode()
              setSession(null)
              setConnectionError('')
            } else if (nextSession) {
              if (pendingLoginTarget.current === 'chat') return
              setSession(nextSession)
              setConnectionError(navigator.onLine ? '' : 'Koneksi internet tidak tersedia. Data terbaru tidak dapat disimpan.')
            }
          })
          authListenerInitialized = true
        }
        const currentSession = await getAuthSession()
        if (!active) return
        if (pendingLoginTarget.current === 'chat') return
        setSession(currentSession)
        if (!navigator.onLine) {
          setConnectionError('Koneksi internet tidak tersedia. Data terbaru tidak dapat disimpan.')
        } else if (currentSession) {
          const verifiedSession = await verifyAuthSession()
          if (!active) return
          setSession(verifiedSession)
          setConnectionError(verifiedSession ? '' : 'Sesi login berakhir. Silakan masuk kembali.')
        } else {
          setConnectionError('')
        }
      } catch (error) {
        if (!active) return
        setConnectionError(error.message || 'Tidak dapat menghubungi database server. Periksa koneksi lalu coba lagi.')
      } finally {
        checkingConnection = false
        if (active) setCheckingSession(false)
      }
    }

    const onOnline = () => verifyConnection()
    const onFocus = () => verifyConnection()
    const onOffline = () => {
      setConnectionError('Koneksi internet tidak tersedia. Data terbaru tidak dapat disimpan.')
      setCheckingSession(false)
    }

    verifyConnection()
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onFocus)
    window.addEventListener('offline', onOffline)
    return () => {
      active = false
      unsubscribe()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('offline', onOffline)
    }
  }, [authCheckKey])

  useEffect(() => {
    if (!session) return

    function refreshVisiblePage() {
      if (document.visibilityState === 'visible') {
        window.dispatchEvent(new CustomEvent('voltker:refresh', { detail: { pageId: page } }))
      }
    }

    window.addEventListener('focus', refreshVisiblePage)
    document.addEventListener('visibilitychange', refreshVisiblePage)
    window.addEventListener('online', refreshVisiblePage)

    return () => {
      window.removeEventListener('focus', refreshVisiblePage)
      document.removeEventListener('visibilitychange', refreshVisiblePage)
      window.removeEventListener('online', refreshVisiblePage)
    }
  }, [page, session])

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [page])

  async function installApp() {
    if (!installPrompt) {
      setInstallError('')
      setShowInstallInstructions(true)
      return
    }

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      setInstallPrompt(null)
      if (outcome === 'accepted') setIsInstalled(true)
      else setShowInstallInstructions(true)
    } catch (error) {
      setInstallError(error.message || 'Prompt instalasi tidak dapat dibuka. Gunakan menu browser untuk memasang aplikasi.')
      setInstallPrompt(null)
      setShowInstallInstructions(true)
    }
  }

  function applyAppUpdate() {
    const waitingWorker = serviceWorkerRegistration.current?.waiting
    if (!waitingWorker) {
      window.location.reload()
      return
    }

    setApplyingUpdate(true)
    const reloadWhenActivated = () => {
      if (waitingWorker.state === 'activated') {
        waitingWorker.removeEventListener('statechange', reloadWhenActivated)
        window.location.reload()
      } else if (waitingWorker.state === 'redundant') {
        waitingWorker.removeEventListener('statechange', reloadWhenActivated)
        setApplyingUpdate(false)
        setUpdateReady(false)
      }
    }
    waitingWorker.addEventListener('statechange', reloadWhenActivated)
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    reloadWhenActivated()
  }

  const installInstructions = /iphone|ipad|ipod/i.test(navigator.userAgent)
    ? 'Ketuk tombol Bagikan di browser, lalu pilih “Tambahkan ke Layar Utama”.'
    : /android/i.test(navigator.userAgent)
      ? 'Buka menu browser ⋮, lalu pilih “Instal aplikasi” atau “Tambahkan ke layar utama”.'
      : 'Gunakan menu browser, lalu pilih “Instal aplikasi” atau “Install VOLTKER”.'

  const pwaUpdateBanner = updateReady && (
    <div className="pwa-update-banner" role="status" aria-live="polite">
      <span>
        {applyingUpdate
          ? 'Menerapkan pembaruan...'
          : 'Pembaruan VOLTKER siap. Muat ulang untuk menggunakan versi terbaru.'}
      </span>
      <button
        className="btn btn-sm btn-primary"
        type="button"
        onClick={applyAppUpdate}
        disabled={applyingUpdate}>
        {applyingUpdate ? 'Memperbarui...' : 'Perbarui sekarang'}
      </button>
    </div>
  )

  if (!session) {
    return (
      <LoginScreen
        configured={Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)}
        checkingSession={checkingSession}
        connectionError={connectionError}
        updateBanner={pwaUpdateBanner}
        onLoginStart={(targetApp) => {
          pendingLoginTarget.current = targetApp
        }}
        onLoginError={() => {
          pendingLoginTarget.current = null
        }}
        onSignedIn={(nextSession, targetApp) => {
          if (targetApp === 'chat') {
            window.location.assign(import.meta.env.BASE_URL + 'chat/?mode=chat')
            return
          }
          pendingLoginTarget.current = null
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
    <div className={'app ' + (navHidden ? 'nav-hidden ' : '') + (page === 'menu' ? 'menu-landing' : '')}>
      <div className="app-background" aria-hidden="true">
        <img src={import.meta.env.BASE_URL + 'voltker-app-background.jpg'} alt="" decoding="async" />
      </div>
      <aside className="sidebar" id="primary-navigation" hidden={navHidden}>
        <div className="logo">
          <img
            src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
            width="320"
            height="79"
            alt="VOLTKER Toko Tas"
          />
        </div>
        <nav aria-label="Menu utama">
          {NAV.map((n) => (
            <button key={n.id}
              className={'nav-item' + (['dashboard', 'pos', 'menu'].includes(n.id) ? '' : ' mobile-nav-hidden') + (page === n.id ? ' active' : '')}
              aria-current={page === n.id ? 'page' : undefined}
              onClick={() => navigateToPage(n.id)}>
              <span className="nav-icon"><Icon name={n.icon} size={19} /></span> {n.label}
            </button>
          ))}
          <a className="nav-item nav-chat-link" href={import.meta.env.BASE_URL + 'chat/?mode=chat'}>
            <span className="nav-icon"><Icon name="chat" size={19} /></span> VOLTKER Chat
          </a>
        </nav>
        <div className="sidebar-foot">
          <span className="dot-online"></span> Online · Database server
        </div>
      </aside>

      <main className="main">
        <header className={'topbar' + (page === 'pos' ? ' topbar-pos-page' : '')}>
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
          {!isInstalled && (
            <button className="btn btn-sm pwa-install-button" type="button" onClick={installApp}>
              <Icon name="plus" size={15} />
              <span>Install</span>
            </button>
          )}
          <SessionControl
            email={session.user.email}
            showLogout={false}
            onSignedOut={() => {
              clearRequestedAppMode()
              setSession(null)
            }} />
          <a className="btn btn-sm chat-launch-button" href={import.meta.env.BASE_URL + 'chat/?mode=chat'} aria-label="Buka VOLTKER Chat">
            <Icon name="chat" size={16} />
            <span>Chat</span>
          </a>
        </header>

        {connectionError && (
          <div className="connection-banner" role="status" aria-live="polite">
            <span>{connectionError}</span>
            <button
              className="btn btn-sm"
              type="button"
              onClick={() => setAuthCheckKey((key) => key + 1)}>
              Coba sambungkan
            </button>
          </div>
        )}

        {pwaUpdateBanner}

        <div className="content" ref={contentRef}>
          {NAV.filter(({ id }) => visitedPages.has(id)).map(({ id }) => {
            const Page = PAGES[id]
            return (
              <div key={id} className={'page-slot page-slot-' + id} hidden={page !== id}>
                <PageErrorBoundary>
                  <Suspense fallback={<PageLoadingFallback pageId={id} />}>
                    {id === 'menu'
                      ? <Page
                          items={NAV.filter((item) => item.id !== 'menu')}
                          onNavigate={navigateToPage}
                          onLogout={logoutFromMenu}
                          logoutBusy={logoutBusy}
                          logoutError={logoutError} />
                      : <Page />}
                  </Suspense>
                </PageErrorBoundary>
              </div>
            )
          })}
        </div>
        {page !== 'menu' && (
          <button
            className="mobile-menu-back"
            type="button"
            onClick={returnToMenu}
            disabled={returningToMenu}>
            <Icon name="arrowLeft" size={19} />
            <span>Kembali ke Menu Utama</span>
          </button>
        )}
      </main>
      {showInstallInstructions && !isInstalled && (
        <div className="overlay" onClick={() => setShowInstallInstructions(false)}>
          <section
            className="modal pwa-install-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            onClick={(event) => event.stopPropagation()}>
            <h3 id="pwa-install-title">Pasang VOLTKER</h3>
            {installError && <p className="form-error" role="alert">{installError}</p>}
            <p className="muted">{installInstructions}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" type="button" onClick={() => setShowInstallInstructions(false)}>Mengerti</button>
            </div>
          </section>
        </div>
      )}
      {returningToMenu && (
        <div
          className="menu-return-flow"
          aria-hidden="true"
          onAnimationEnd={finishReturnTransition} />
      )}
      <CustomNumpad />
    </div>
  )
}

export default function App() {
  return APP_TEMPORARILY_DISABLED ? <AppDisabledNotice /> : <ActiveApp />
}
