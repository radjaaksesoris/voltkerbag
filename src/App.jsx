import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import SessionControl from './components/SessionControl.jsx'
import PageErrorBoundary from './components/PageErrorBoundary.jsx'
import Icon from './components/Icon.jsx'

const CHUNK_RELOAD_KEY = 'voltker:chunk-reload-attempted'

function lazyPage(importPage) {
  return lazy(() => importPage()
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
    }))
}

const Dashboard = lazyPage(() => import('./pages/Dashboard.jsx'))
const Transactions = lazyPage(() => import('./pages/Transactions.jsx'))
const Products = lazyPage(() => import('./pages/Products.jsx'))
const Finance = lazyPage(() => import('./pages/Finance.jsx'))
const Settings = lazyPage(() => import('./pages/Settings.jsx'))

const PAGES = {
  dashboard: Dashboard,
  pos: Transactions,
  stok: Products,
  finance: Finance,
  settings: Settings
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', description: 'Ringkasan performa tokomu hari ini.', icon: 'dashboard' },
  { id: 'pos', label: 'Transaksi', description: 'Pilih produk, atur pembayaran, dan simpan transaksi.', icon: 'cart' },
  { id: 'stok', label: 'Stok Barang', description: 'Kelola katalog produk, harga, dan ketersediaan stok.', icon: 'bag' },
  { id: 'finance', label: 'Keuangan', description: 'Pantau pemasukan, pengeluaran, dan saldo kas toko.', icon: 'wallet' },
  { id: 'settings', label: 'Setting', description: 'Kelola nama pelanggan dan gambar produk.', icon: 'settings' }
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [visitedPages, setVisitedPages] = useState(() => new Set(['dashboard']))
  const [navHidden, setNavHidden] = useState(false)
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  )
  const [showInstallInstructions, setShowInstallInstructions] = useState(false)
  const [installError, setInstallError] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  const [applyingUpdate, setApplyingUpdate] = useState(false)
  const currentPage = NAV.find((n) => n.id === page)
  const contentRef = useRef(null)
  const serviceWorkerRegistration = useRef(null)

  function navigateToPage(nextPage) {
    setVisitedPages((visited) => {
      if (visited.has(nextPage)) return visited
      return new Set([...visited, nextPage])
    })
    setPage(nextPage)
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
              setSession(null)
              setConnectionError('')
            } else if (nextSession) {
              setSession(nextSession)
              setConnectionError(navigator.onLine ? '' : 'Koneksi internet tidak tersedia. Data terbaru tidak dapat disimpan.')
            }
          })
          authListenerInitialized = true
        }
        const currentSession = await getAuthSession()
        if (!active) return
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
        window.dispatchEvent(new CustomEvent('voltker:refresh'))
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
  }, [session])

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
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

  if (checkingSession && !session && !connectionError) {
    return <main className="login-page"><p className="login-loading">Memeriksa koneksi dan sesi VOLTKER...</p></main>
  }

  if (!session) {
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
    <div
      className={'app ' + (navHidden ? 'nav-hidden' : '')}
      style={{ '--brand-watermark': 'url("' + import.meta.env.BASE_URL + 'voltker-watermark-tile.png")' }}>
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
              onClick={() => navigateToPage(n.id)}>
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
          {!isInstalled && (
            <button className="btn btn-sm pwa-install-button" type="button" onClick={installApp}>
              <Icon name="plus" size={15} />
              <span>Install</span>
            </button>
          )}
          <SessionControl email={session.user.email} onSignedOut={() => setSession(null)} />
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

        {updateReady && (
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
        )}

        <div className="content" ref={contentRef}>
          {NAV.filter(({ id }) => visitedPages.has(id)).map(({ id }) => {
            const Page = PAGES[id]
            return (
              <div key={id} hidden={page !== id}>
                <PageErrorBoundary>
                  <Suspense fallback={<p className="login-loading">Memuat halaman...</p>}>
                    <Page />
                  </Suspense>
                </PageErrorBoundary>
              </div>
            )
          })}
        </div>
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
    </div>
  )
}
