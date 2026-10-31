export function getRequestedAppMode(search = window.location.search) {
  const mode = new URLSearchParams(search).get('mode')
  return mode === 'table' || mode === 'chat' ? mode : null
}

export function clearRequestedAppMode() {
  const url = new URL(window.location.href)
  url.searchParams.delete('mode')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
}
