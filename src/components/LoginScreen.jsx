import { useEffect, useState } from 'react'
import './LoginScreen.css'

function Svg({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  )
}
const UserIcon = () => <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></Svg>
const MailIcon = () => <Svg><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></Svg>
const LockIcon = () => <Svg><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>

export default function LoginScreen({ configured, connectionError, updateBanner, onSignedIn, onRetry }) {
  const defaultEmail = import.meta.env.VITE_LOGIN_EMAIL?.trim() || ''
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1024px)').matches)
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 1024px)')
    const updateMobile = () => setIsMobile(mobileQuery.matches)
    mobileQuery.addEventListener('change', updateMobile)
    return () => mobileQuery.removeEventListener('change', updateMobile)
  }, [])

  async function loginWithPassword(value) {
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
      onSignedIn(session)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    loginWithPassword(password)
  }

  function submitRegister(event) {
    event.preventDefault()
    setNotice('Pendaftaran akun baru belum dibuka. Hubungi administrator toko untuk dibuatkan akun.')
  }

  function enterDigit(digit) {
    const nextPassword = password + digit
    if (nextPassword.length > 6) return
    setPassword(nextPassword)
    setError('')
    if (nextPassword.length === 6) loginWithPassword(nextPassword)
  }

  function switchMode(next) {
    setMode(next)
    setError('')
    setNotice('')
  }

  const isRegister = mode === 'register'

  return (
    <main className="auth-page">
      {updateBanner}
      <div className={`auth-container${isRegister ? ' active' : ''}`}>

        {/* Form Registrasi */}
        <div className="auth-form register" aria-hidden={!isRegister}>
          <form onSubmit={submitRegister}>
            <h1>Registration</h1>
            <div className="auth-input">
              <input type="text" placeholder="Username" autoComplete="username" required />
              <UserIcon />
            </div>
            <div className="auth-input">
              <input type="email" placeholder="Email" autoComplete="email" required />
              <MailIcon />
            </div>
            <div className="auth-input">
              <input type="password" placeholder="Password" autoComplete="new-password" required />
              <LockIcon />
            </div>
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button type="submit" className="auth-btn">Register</button>
          </form>
        </div>

        {/* Form Login */}
        <div className="auth-form login" aria-hidden={isRegister}>
          {!configured ? (
            <div className="auth-message" role="alert">
              Supabase belum dikonfigurasi untuk build ini. Atur secret VITE_SUPABASE_ANON_KEY di GitHub Actions, lalu jalankan deploy ulang.
            </div>
          ) : !defaultEmail ? (
            <div className="auth-message" role="alert">
              Email login belum dikonfigurasi. Atur variable VITE_LOGIN_EMAIL di GitHub Actions, lalu jalankan deploy ulang.
            </div>
          ) : connectionError ? (
            <div className="auth-message" role="alert">
              <span>{connectionError}</span>
              <button className="auth-btn" type="button" onClick={onRetry}>Coba sambungkan lagi</button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1>Login</h1>
              <p className="auth-hint">{isMobile ? 'Masukkan 6 digit password' : 'Masuk untuk melanjutkan pengelolaan toko.'}</p>
              {!isMobile && (
                <div className="auth-input">
                  <input id="login-email" type="email" autoComplete="username" value={defaultEmail}
                    readOnly aria-label="Email" />
                  <MailIcon />
                </div>
              )}
              <div className="auth-input">
                <input id="login-password" type="password" autoComplete="current-password"
                  aria-label="Kata sandi" placeholder={isMobile ? '○  ○  ○  ○  ○  ○' : 'Password'}
                  inputMode={isMobile ? 'none' : undefined} readOnly={isMobile} required
                  maxLength={isMobile ? 6 : undefined} value={password}
                  onChange={(event) => setPassword(
                    isMobile ? event.target.value.replace(/\D/g, '') : event.target.value
                  )} />
                <LockIcon />
              </div>
              {isMobile && (
                <div className="auth-keypad" role="group" aria-label="Keypad kata sandi">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button key={digit} className="auth-key" type="button"
                      onClick={() => enterDigit(digit)} disabled={busy}>{digit}</button>
                  ))}
                  <button className="auth-key auth-key-action" type="button"
                    onClick={() => { setPassword(''); setError('') }} disabled={busy}
                    aria-label="Hapus semua angka">Hapus</button>
                  <button className="auth-key" type="button"
                    onClick={() => enterDigit('0')} disabled={busy}>0</button>
                  <button className="auth-key auth-key-action" type="button"
                    onClick={() => { setPassword((current) => current.slice(0, -1)); setError('') }}
                    disabled={busy} aria-label="Hapus angka terakhir">⌫</button>
                </div>
              )}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {busy && isMobile && <p className="auth-hint">Memverifikasi akun...</p>}
              {!isMobile && (
                <button type="submit" className="auth-btn" disabled={busy}>
                  {busy ? 'Memverifikasi akun...' : 'Login'}
                </button>
              )}
            </form>
          )}
        </div>

        {/* Panel biru yang bergeser */}
        <div className="auth-toggle-box">
          <div className="auth-toggle-panel toggle-right">
            <img className="auth-logo" src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
              width="160" height="40" alt="VOLTKER Toko Tas" />
            <h1>Hello, Welcome!</h1>
            <p>Belum punya akun?</p>
            <button className="auth-btn ghost" type="button" tabIndex={isRegister ? -1 : 0}
              onClick={() => switchMode('register')}>Register</button>
          </div>
          <div className="auth-toggle-panel toggle-left">
            <img className="auth-logo" src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
              width="160" height="40" alt="" />
            <h1>Welcome Back!</h1>
            <p>Sudah punya akun?</p>
            <button className="auth-btn ghost" type="button" tabIndex={isRegister ? 0 : -1}
              onClick={() => switchMode('login')}>Login</button>
          </div>
        </div>
      </div>
    </main>
  )
}
