const CACHE_NAME = 'voltker-app-__BUILD_VERSION__'
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './voltker-icon-180.png',
  './voltker-icon-192.png',
  './voltker-icon-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('voltker-app-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    )
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SKIP_WAITING') return

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if (client.id !== event.source?.id) {
        client.postMessage({ type: 'UPDATE_READY' })
      }
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const requestUrl = new URL(request.url)

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    const navigationKey = `${requestUrl.pathname}${requestUrl.search}`
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(navigationKey, copy))
          }
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          return (await cache.match(navigationKey)) || (await cache.match('./index.html')) || Response.error()
        })
    )
    return
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached

      const response = await fetch(request)
      if (response.ok) {
        await cache.put(request, response.clone())
      }
      return response
    })())
  }
})
