import { useEffect, useState } from 'react'

export default function LoginScreen({ configured, connectionError, onSignedIn, onRetry }) {
  const defaultEmail = import.meta.env.VITE_LOGIN_EMAIL?.trim() || ''
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1024px)').matches)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 1024px)')
    const updateMobile = () => setIsMobile(mobileQuery.matches)
    mobileQuery.addEventListener('change', updateMobile)
    return () => mobileQuery.removeEventListener('change', updateMobile)
  }, [])

  async function loginWithPassword(value) {
    const loginEmail = isMobile ? defaultEmail : email.trim()
    const loginPassword = isMobile ? value.replace(/\D/g, '') : value
    if (!loginEmail) {
      setError('Email login mobile belum dikonfigurasi. Atur VITE_LOGIN_EMAIL lalu build ulang aplikasi.')
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

  function enterDigit(digit) {
    const nextPassword = password + digit
    if (nextPassword.length > 6) return
    setPassword(nextPassword)
    setError('')
    if (nextPassword.length === 6) loginWithPassword(nextPassword)
  }

  return (
    <main className="login-page">
      <aside className="login-brand" aria-label="VOLTKER Toko Tas">
        <img
          className="login-brand-logo"
          src={import.meta.env.BASE_URL + 'voltker-logo-320.png'}
          width="320"
          height="79"
          alt="VOLTKER Toko Tas"
        />
        <div className="login-brand-copy">
          <span>OPERASIONAL TOKO · RADJA AKSESORIS</span>
          <h2>Jalankan toko dengan lebih terarah.</h2>
          <p>Penjualan, stok, dan keuangan tersusun dalam satu sistem.</p>
        </div>
        <div className="login-brand-foot">
          <span className="login-brand-rule" />
          <span>Ruang kerja administrator</span>
        </div>
      </aside>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-heading">
          <p className="login-eyebrow">AKSES ADMINISTRATOR</p>
          <h1 id="login-title">Selamat datang kembali.</h1>
          <p className="login-description">Masuk untuk melanjutkan pengelolaan toko.</p>
        </div>

        {!configured ? (
          <div className="login-message error" role="alert">
            Supabase belum dikonfigurasi untuk build ini. Atur secret VITE_SUPABASE_ANON_KEY di GitHub Actions, lalu jalankan deploy ulang.
          </div>
        ) : connectionError ? (
          <div className="login-message error" role="alert">
            <span>{connectionError}</span>
            <button className="btn btn-block" type="button" onClick={onRetry}>Coba sambungkan lagi</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="login-email-field">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" className="input" type="email" autoComplete="username" required={!isMobile}
                value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <label htmlFor="login-password">Kata sandi</label>
            <input id="login-password" className="input" type="password" autoComplete="current-password"
              inputMode={isMobile ? 'none' : undefined} readOnly={isMobile} required
              value={password} onChange={(event) => setPassword(
                isMobile ? event.target.value.replace(/\D/g, '') : event.target.value
              )} />
            {isMobile && (
              <div className="login-keypad" role="group" aria-label="Keypad kata sandi">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button key={digit} className="login-keypad-button" type="button"
                    onClick={() => enterDigit(digit)} disabled={busy}>{digit}</button>
                ))}
                <button className="login-keypad-button login-keypad-action" type="button"
                  onClick={() => { setPassword(''); setError('') }} disabled={busy}
                  aria-label="Hapus semua angka">Hapus</button>
                <button className="login-keypad-button" type="button"
                  onClick={() => enterDigit('0')} disabled={busy}>0</button>
                <button className="login-keypad-button login-keypad-action" type="button"
                  onClick={() => { setPassword((current) => current.slice(0, -1)); setError('') }}
                  disabled={busy} aria-label="Hapus angka terakhir">⌫</button>
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? 'Memverifikasi akun...' : 'Masuk'}
            </button>
            <p className="login-footnote">Akun dibuat oleh administrator toko. Pendaftaran mandiri tidak tersedia.</p>
          </form>
        )}
      </section>
    </main>
  )
}
