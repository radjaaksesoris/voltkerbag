export function requestPageRefresh(pageId) {
  window.dispatchEvent(new CustomEvent('voltker:refresh', { detail: { pageId } }))
}

export function requestAppUpdateCheck() {
  window.dispatchEvent(new Event('voltker:check-app-update'))
}
