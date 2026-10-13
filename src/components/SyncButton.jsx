import { useEffect, useState } from 'react'
import { syncAll, isConfigured, getConfig, saveConfig, getLastSync } from '../supabaseSync'
import { onRefresh } from '../db'

export default function SyncButton() {
  const [status, setStatus] = useState('idle') // idle | syncing | ok | error
  const [message, setMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [cfg, setCfg] = useState({ url: '', key: '' })
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    setCfg(getConfig())
    getLastSync().then(setLastSync)
    return onRefresh(async () => setLastSync(await getLastSync()))
  }, [])

  async function doSync() {
    if (!isConfigured()) { setShowSettings(true); return }
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
            <p className="muted small">Masukkan URL Project dan Anon Key (Settings → API di dashboard Supabase). Kosongkan jika ingin murni offline.</p>
            <label>Supabase URL</label>
            <input className="input" placeholder="https://xxxx.supabase.co"
              value={cfg.url} onChange={(e) => setCfg({ ...cfg, url: e.target.value })} />
            <label>Anon / Public Key</label>
            <input className="input" type="password" placeholder="eyJhbGciOi..."
              value={cfg.key} onChange={(e) => setCfg({ ...cfg, key: e.target.value })} />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowSettings(false)}>Batal</button>
              <button className="btn btn-primary" onClick={() => { saveConfig(cfg.url, cfg.key); setShowSettings(false) }}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
