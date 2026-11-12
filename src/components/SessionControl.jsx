import { useEffect, useState } from 'react'

export default function SessionControl({ email, onSignedOut, showLogout = true }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    function updateOnlineStatus() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

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
      <span className={'session-online' + (isOnline ? '' : ' is-offline')} role="status">
        <span className="dot-online" />
        {isOnline ? 'Terhubung' : 'Offline'}
      </span>
      <span className="session-email" title={email}>{email}</span>
      {showLogout && (
        <button className="btn btn-sm" type="button" onClick={logout} disabled={busy}>
          {busy ? 'Keluar...' : 'Keluar'}
        </button>
      )}
      {error && <span className="session-error" role="alert">{error}</span>}
    </div>
  )
}
