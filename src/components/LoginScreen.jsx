import { useState } from 'react'
import { signIn } from '../supabaseSync'

export default function LoginScreen({ configured, connectionError, onSignedIn, onRetry }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await signIn(email.trim(), password)
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
        <img className="login-brand-logo" src={import.meta.env.BASE_URL + 'voltker-logo.png'} alt="VOLTKER Toko Tas" />
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
            <label htmlFor="login-email">Email</label>
            <input id="login-email" className="input" type="email" autoComplete="username" required
              value={email} onChange={(event) => setEmail(event.target.value)} />
            <label htmlFor="login-password">Kata sandi</label>
            <input id="login-password" className="input" type="password" autoComplete="current-password" required
              value={password} onChange={(event) => setPassword(event.target.value)} />
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
