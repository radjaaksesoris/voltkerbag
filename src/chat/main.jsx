import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import ChatApp from './ChatApp.jsx'
import AppDisabledNotice from '../components/AppDisabledNotice.jsx'
import { APP_TEMPORARILY_DISABLED } from '../appAvailability.js'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'chat/sw.js', {
      scope: import.meta.env.BASE_URL + 'chat/',
      updateViaCache: 'none'
    }).catch((error) => {
      console.error('Gagal mendaftarkan service worker VOLTKER Chat:', error)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {APP_TEMPORARILY_DISABLED ? <AppDisabledNotice /> : <ChatApp />}
  </React.StrictMode>
)
