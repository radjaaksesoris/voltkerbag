const MAX_RETRY_WAIT_SECONDS = 86_400

function parseDuration(value, now = Date.now()) {
  const text = String(value || '').trim()
  if (!text) return 0

  const seconds = Number(text)
  if (Number.isFinite(seconds) && seconds > 0) return seconds

  const duration = text.match(/^(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?)$/i)
  if (duration) {
    const amount = Number(duration[1])
    const unit = duration[2].toLowerCase()
    if (unit === 'ms' || unit.startsWith('millisecond')) return amount / 1_000
    if (unit === 'm' || unit.startsWith('minute')) return amount * 60
    return amount
  }

  const date = Date.parse(text)
  return Number.isFinite(date) ? Math.max(0, (date - now) / 1_000) : 0
}

export function getRetryAfterSeconds(headers, providerMessage = '', now = Date.now()) {
  const candidates = [
    parseDuration(headers.get('retry-after'), now),
    parseDuration(headers.get('x-ratelimit-reset-tokens'), now),
    parseDuration(headers.get('x-ratelimit-reset-requests'), now)
  ]
  const messageDuration = String(providerMessage).match(
    /(?:try again|retry)(?:\s+in)?\s+(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|seconds?|m|minutes?)/i
  )
  if (messageDuration) candidates.push(parseDuration(messageDuration[1] + messageDuration[2]))

  const wait = Math.max(...candidates)
  return wait > 0 ? Math.min(MAX_RETRY_WAIT_SECONDS, Math.max(1, Math.ceil(wait))) : 0
}

export function formatRateLimitMessage(retryAfterSeconds) {
  const wait = Number(retryAfterSeconds)
  if (!Number.isFinite(wait) || wait <= 0) {
    return 'Permintaan mencapai batas token per menit Groq. Tunggu sebentar sebelum mencoba lagi.'
  }
  return 'Permintaan mencapai batas token per menit Groq. Coba lagi dalam ' +
    Math.ceil(wait) + ' detik; percakapan dan data Anda tetap aman.'
}
