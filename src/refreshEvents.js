export function requestPageRefresh(pageId) {
  window.dispatchEvent(new CustomEvent('voltker:refresh', { detail: { pageId } }))
}
