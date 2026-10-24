import { useEffect, useRef, useState } from 'react'

export default function LoginScreen({ configured, connectionError, onSignedIn, onRetry }) {
  const defaultEmail = import.meta.env.VITE_LOGIN_EMAIL?.trim() || ''
  const passwordInput = useRef(null)
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

  useEffect(() => {
    if (isMobile && configured && !connectionError) passwordInput.current?.focus()
  }, [configured, connectionError, isMobile])

  async function submit(event) {
    event.preventDefault()
    const loginEmail = isMobile ? defaultEmail : email.trim()
    const loginPassword = isMobile ? password.replace(/\D/g, '') : password
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
          <span>VOLTKER · SISTEM TOKO</span>
          <h2>Semua urusan toko, dalam satu tempat.</h2>
          <p>Kelola penjualan, stok, dan keuangan dengan lebih mudah.</p>
        </div>
        <div className="login-brand-foot">
          <span className="login-brand-dot" />
          <span>Sistem kasir untuk Radja Aksesoris</span>
        </div>
      </aside>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-heading">
          <p className="login-eyebrow">Selamat datang kembali</p>
          <h1 id="login-title">Masuk ke akunmu</h1>
          <p className="login-description">Gunakan akun administrator toko untuk melanjutkan.</p>
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
            <input id="login-password" ref={passwordInput} className="input" type="password"
              autoComplete="current-password" inputMode={isMobile ? 'numeric' : undefined}
              pattern={isMobile ? '[0-9]*' : undefined} required
              value={password} onChange={(event) => setPassword(
                isMobile ? event.target.value.replace(/\D/g, '') : event.target.value
              )} />
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
