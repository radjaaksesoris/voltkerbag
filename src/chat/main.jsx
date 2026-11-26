import React, { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './sharedStyles.css'
import AppDisabledNotice from '../components/AppDisabledNotice.jsx'
import { APP_TEMPORARILY_DISABLED } from '../appAvailability.js'

const ChatApp = lazy(() => import('./ChatApp.jsx'))

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'chat/sw.js', {
      scope: import.meta.env.BASE_URL + 'chat/',
      updateViaCache: 'none'
    }).catch((error) => {
      console.error('Gagal mendaftarkan service worker VOLTKER Chat:', error)
    })
  })
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'UPDATE_READY') return
    if (window.confirm('Versi baru VOLTKER Chat sudah siap. Muat ulang halaman sekarang?')) {
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {APP_TEMPORARILY_DISABLED
      ? <AppDisabledNotice />
      : (
          <Suspense fallback={<main className="chat-loading" role="status" aria-live="polite">Memuat aplikasi chat...</main>}>
            <ChatApp />
          </Suspense>
        )}
  </React.StrictMode>
)
