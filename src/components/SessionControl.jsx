import { useState } from 'react'
import { signOut } from '../supabaseSync'

export default function SessionControl({ email, onSignedOut }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function logout() {
    setBusy(true)
    setError('')
    try {
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
      <button className="btn btn-sm" type="button" onClick={logout} disabled={busy}>
        {busy ? 'Keluar...' : 'Keluar'}
      </button>
      {error && <span className="session-error" role="alert">{error}</span>}
    </div>
  )
}
