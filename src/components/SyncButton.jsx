import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  syncAll, isConfigured, getLastSync, getAuthSession, signIn, signOut
} from '../supabaseSync'
import { onRefresh } from '../db'

export default function SyncButton() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    getLastSync().then(setLastSync)
    getAuthSession().then(setSession).catch((err) => setAuthMessage(err.message || String(err)))
    return onRefresh(async () => setLastSync(await getLastSync()))
  }, [])

  async function syncNow() {
    setStatus('syncing')
    setMessage('')
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

  async function doSignIn(e) {
    e.preventDefault()
    setAuthBusy(true)
    setAuthMessage('')
    try {
      setSession(await signIn(email.trim(), password))
      setPassword('')
      setShowSettings(false)
      await syncNow()
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
    await syncNow()
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
        <button className="btn-gear" onClick={() => setShowSettings(true)} title="Akun Supabase">⚙</button>
      </div>
      {message && <div className={'sync-msg ' + status}>{message}</div>}

      {showSettings && createPortal(
        <div className="overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Akun Supabase</h3>
            {isConfigured() ? (
              session ? (
                <div>
                  <p className="muted small">Masuk sebagai {session.user.email}</p>
                  <button className="btn btn-block" disabled={authBusy} onClick={doSignOut}>Keluar</button>
                </div>
              ) : (
                <form onSubmit={doSignIn}>
                  <p className="muted small">Masuk dengan akun Supabase yang sudah dibuat untuk perangkat ini.</p>
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
            ) : (
              <p className="muted small">
                Supabase belum dikonfigurasi untuk build ini. Atur VITE_SUPABASE_ANON_KEY di environment lalu build ulang.
              </p>
            )}
            {authMessage && <p className="muted small" role="status">{authMessage}</p>}
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSettings(false)}>Tutup</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
