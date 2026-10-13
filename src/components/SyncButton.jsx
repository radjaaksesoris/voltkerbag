import { useEffect, useState } from 'react'
import {
  syncAll, isConfigured, getConfig, saveConfig, getLastSync,
  getAuthSession, signIn, signOut
} from '../supabaseSync'
import { onRefresh } from '../db'

export default function SyncButton() {
  const [status, setStatus] = useState('idle') // idle | syncing | ok | error
  const [message, setMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [cfg, setCfg] = useState({ url: '', key: '' })
  const [lastSync, setLastSync] = useState(null)
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    setCfg(getConfig())
    getLastSync().then(setLastSync)
    getAuthSession().then(setSession).catch((err) => setAuthMessage(err.message || String(err)))
    return onRefresh(async () => setLastSync(await getLastSync()))
  }, [])

  async function saveSettings() {
    saveConfig(cfg.url, cfg.key)
    setCfg(getConfig())
    try {
      setSession(await getAuthSession())
      setAuthMessage('Konfigurasi Supabase tersimpan.')
    } catch (err) {
      setSession(null)
      setAuthMessage(err.message || String(err))
    }
  }

  async function doSignIn(e) {
    e.preventDefault()
    setAuthBusy(true)
    setAuthMessage('')
    try {
      saveConfig(cfg.url, cfg.key)
      setCfg(getConfig())
      setSession(await signIn(email.trim(), password))
      setPassword('')
      setAuthMessage('Berhasil masuk ke Supabase.')
    } catch (err) {
      setAuthMessage(err.message || String(err))
    } finally {
      setAuthBusy(false)
    }
  }

  async function doSignOut() {
    setAuthBusy(true)
    setAuthMessage('')
    try {
      await signOut()
      setSession(null)
      setAuthMessage('Anda sudah keluar.')
    } catch (err) {
      setAuthMessage(err.message || String(err))
    } finally {
      setAuthBusy(false)
    }
  }

  async function doSync() {
    if (!isConfigured() || !session) { setShowSettings(true); return }
    setStatus('syncing'); setMessage('')
    try {
      const res = await syncAll((msg) => setMessage(msg))
      setStatus('ok')
      setMessage('Terpush ' + res.pushed + ' · Terambil ' + res.pulled + (res.deleted ? ' · Terhapus ' + res.deleted : ''))
    } catch (err) {
      setStatus('error')
      setMessage(err.message || String(err))
    }
    setTimeout(() => { setStatus('idle'); setMessage('') }, 6000)
  }

  return (
    <>
      <div className="sync-wrap">
        <button
          className={'btn-sync ' + status}
          onClick={doSync}
          disabled={status === 'syncing'}
          title={lastSync ? 'Sinkron terakhir: ' + new Date(lastSync).toLocaleString('id-ID') : 'Belum pernah sinkron'}
        >
          <span className="sync-icon">{status === 'syncing' ? '⟳' : '⇅'}</span>
          {status === 'syncing' ? 'SINKRONISASI...' : 'SINKRON SEKARANG'}
        </button>
        <button className="btn-gear" onClick={() => setShowSettings(true)} title="Pengaturan Supabase">⚙</button>
      </div>
      {message && (
        <div className={'sync-msg ' + status}>{message}</div>
      )}

      {showSettings && (
        <div className="overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pengaturan Supabase</h3>
            <p className="muted small">Masukkan URL Project dan anon/public key dari Settings → API. Jangan gunakan service_role key.</p>
            <label>Supabase URL</label>
            <input className="input" placeholder="https://xxxx.supabase.co"
              value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} />
            <label>Anon / Public Key</label>
            <input className="input" type="password" placeholder="eyJhbGciOi..."
              value={cfg.key} onChange={(e) => setCfg({ ...cfg, key: e.target.value })} />
            <button className="btn btn-block" onClick={saveSettings}>Simpan konfigurasi</button>

            {isConfigured() && (
              session ? (
                <div>
                  <p className="muted small">Masuk sebagai {session.user.email}</p>
                  <button className="btn btn-block" disabled={authBusy} onClick={doSignOut}>Keluar</button>
                </div>
              ) : (
                <form onSubmit={doSignIn}>
                  <h4>Masuk ke akun toko</h4>
                  <label>Email</label>
                  <input className="input" type="email" autoComplete="username" required
                    value={email} onChange={(e) => setEmail(e.target.value)} />
                  <label>Kata sandi</label>
                  <input className="input" type="password" autoComplete="current-password" required
                    value={password} onChange={(e) => setPassword(e.target.value)} />
                  <button className="btn btn-primary btn-block" disabled={authBusy}>
                    {authBusy ? 'Memproses...' : 'Masuk'}
                  </button>
                </form>
              )
            )}
            {authMessage && <p className="muted small" role="status">{authMessage}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSettings(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
