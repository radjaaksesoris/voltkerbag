import { useState } from 'react'
import Icon from './Icon.jsx'
import { requestPageRefresh } from '../refreshEvents.js'

export default function SessionControl({ email, onSignedOut, refreshPageId, refreshPageLabel }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function logout() {
    setBusy(true)
    setError('')
    try {
      const { signOut } = await import('../supabaseSync')
      await signOut()
      onSignedOut()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="session-control">
      <span className="session-online"><span className="dot-online" />Terhubung</span>
      <span className="session-email" title={email}>{email}</span>
      {refreshPageId ? (
        <button
          className="btn btn-sm session-refresh-button"
          type="button"
          aria-label={`Refresh ${refreshPageLabel || 'halaman'}`}
          title={`Refresh ${refreshPageLabel || 'halaman'}`}
          onClick={() => requestPageRefresh(refreshPageId)}>
          <Icon name="sync" size={16} />
          <span>Refresh</span>
        </button>
      ) : (
        <button className="btn btn-sm" type="button" onClick={logout} disabled={busy}>
          {busy ? 'Keluar...' : 'Keluar'}
        </button>
      )}
      {error && <span className="session-error" role="alert">{error}</span>}
    </div>
  )
}
