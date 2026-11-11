import { useEffect, useState } from 'react'
import './LoginScreen.css'

function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  )
}
const MailIcon = () => <Svg><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>

export default function LoginScreen({
  configured,
  checkingSession = false,
  connectionError,
  updateBanner,
  onSignedIn,
  onRetry,
  defaultAppMode = 'table'
}) {
  const defaultEmail = import.meta.env.VITE_LOGIN_EMAIL?.trim() || ''
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1024px)').matches)
  const [mode, setMode] = useState(defaultAppMode)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 1024px)')
    const updateMobile = () => setIsMobile(mobileQuery.matches)
    mobileQuery.addEventListener('change', updateMobile)
    return () => mobileQuery.removeEventListener('change', updateMobile)
  }, [])

  async function loginWithPassword(value, targetApp) {
    const loginEmail = defaultEmail
    const loginPassword = isMobile ? value.replace(/\D/g, '') : value
    if (!loginEmail) {
      setError('Email login belum dikonfigurasi. Atur VITE_LOGIN_EMAIL lalu build ulang aplikasi.')
      return
    }
    if (!loginPassword) {
      setError('Masukkan kata sandi berupa angka.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { signIn } = await import('../supabaseSync')
      const session = await signIn(loginEmail, loginPassword)
      setPassword('')
      onSignedIn(session, targetApp)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(event, targetApp) {
    event.preventDefault()
    loginWithPassword(password, targetApp)
  }

  function enterDigit(digit, targetApp) {
    const nextPassword = password + digit
    if (nextPassword.length > 6) return
    setPassword(nextPassword)
    setError('')
    if (nextPassword.length === 6) loginWithPassword(nextPassword, targetApp)
  }

  function switchMode(next) {
    setMode(next)
    setError('')
  }

  const isChat = mode === 'chat'

  function renderLoginForm(targetApp) {
    return (
      <form onSubmit={(event) => submit(event, targetApp)} aria-busy={checkingSession || busy}>
        <h1>{targetApp === 'chat' ? 'Login Aplikasi Chat' : 'Login Aplikasi Tabel'}</h1>
        {!isMobile && (
          <div className="auth-input">
            <input id={`login-email-${targetApp}`} type="email" autoComplete="username" value={defaultEmail}
              readOnly aria-label="Email" />
            <MailIcon />
          </div>
        )}
        <p className="auth-pin-label">Masukkan password</p>
        <div className="auth-input auth-pin-input">
          <input id={`login-password-${targetApp}`} type="password" autoComplete="current-password"
            aria-label="Kata sandi" placeholder="○ ○ ○ ○ ○ ○"
            inputMode={isMobile ? 'none' : undefined} readOnly={isMobile}
            disabled={checkingSession || busy} required
            maxLength={isMobile ? 6 : undefined} value={password}
            onChange={(event) => setPassword(
              isMobile ? event.target.value.replace(/\D/g, '') : event.target.value
            )} />
        </div>
        {isMobile && (
          <div className="auth-keypad" role="group" aria-label="Keypad kata sandi">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button key={digit} className="auth-key" type="button"
                onClick={() => enterDigit(digit, targetApp)} disabled={checkingSession || busy}>{digit}</button>
            ))}
            <button className="auth-key auth-key-action" type="button"
              onClick={() => { setPassword(''); setError('') }} disabled={checkingSession || busy}
              aria-label="Hapus semua angka">Hapus</button>
            <button className="auth-key" type="button"
              onClick={() => enterDigit('0', targetApp)} disabled={checkingSession || busy}>0</button>
            <button className="auth-key auth-key-action" type="button"
              onClick={() => { setPassword((current) => current.slice(0, -1)); setError('') }}
              disabled={checkingSession || busy} aria-label="Hapus angka terakhir">⌫</button>
          </div>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {(checkingSession || busy && isMobile) && (
          <p className="auth-hint" role="status">
            {checkingSession ? 'Memeriksa sesi...' : 'Memverifikasi akun...'}
          </p>
        )}
        {!isMobile && (
          <button type="submit" className="auth-btn" disabled={checkingSession || busy}>
            {busy ? 'Memverifikasi akun...' : 'Login'}
          </button>
        )}
      </form>
    )
  }

  function renderLoginContent(targetApp) {
    if (!configured) {
      return (
        <div className="auth-message" role="alert">
          Supabase belum dikonfigurasi untuk build ini. Atur secret VITE_SUPABASE_ANON_KEY di GitHub Actions, lalu jalankan deploy ulang.
        </div>
      )
    }
    if (!defaultEmail) {
      return (
        <div className="auth-message" role="alert">
          Email login belum dikonfigurasi. Atur variable VITE_LOGIN_EMAIL di GitHub Actions, lalu jalankan deploy ulang.
        </div>
      )
    }
    if (connectionError) {
      return (
        <div className="auth-message" role="alert">
          <span>{connectionError}</span>
          <button className="auth-btn" type="button" onClick={onRetry}>Coba sambungkan lagi</button>
        </div>
      )
    }
    return renderLoginForm(targetApp)
  }

  return (
    <main className="auth-page">
      {updateBanner}
      <div className={`auth-container${isChat ? ' active' : ''}`}>

        <div className="auth-form chat" aria-hidden={!isChat}>
          {renderLoginContent('chat')}
        </div>

        <div className="auth-form table" aria-hidden={isChat}>
          {renderLoginContent('table')}
        </div>

        <div className="auth-toggle-box">
          <div className="auth-toggle-panel toggle-right">
            <img className="auth-logo" src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
            width="160" height="40" alt="VOLTKER Toko Tas" />
            <h1>Login Tabel</h1>
            <p>Kelola data toko melalui aplikasi Tabel.</p>
            <button className="auth-btn ghost" type="button" tabIndex={isChat ? -1 : 0}
            onClick={() => switchMode('chat')}>Login ke Chat</button>
          </div>
          <div className="auth-toggle-panel toggle-left">
            <img className="auth-logo" src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
            width="160" height="40" alt="" />
            <h1>Login Chat</h1>
            <p>Kelola toko melalui percakapan.</p>
            <button className="auth-btn ghost" type="button" tabIndex={isChat ? 0 : -1}
            onClick={() => switchMode('table')}>Login ke Tabel</button>
          </div>
        </div>
      </div>
    </main>
  )
}
