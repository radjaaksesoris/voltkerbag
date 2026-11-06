import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none'
    }).then((registration) => {
      function checkForUpdatesOnResume() {
        if (document.visibilityState !== 'visible') return
        registration.update().catch((error) => {
          console.warn('Pemeriksaan pembaruan service worker gagal; aplikasi tetap dapat digunakan:', error)
        })
      }

      document.addEventListener('visibilitychange', checkForUpdatesOnResume)
    }).catch((error) => {
      console.error('Gagal mendaftarkan service worker:', error)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
