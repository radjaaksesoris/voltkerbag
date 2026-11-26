function isRetryableProviderError(error) {
  const status = Number(error?.status)
  if (status === 408 || status === 429 || status >= 500) return true
  if (status) return false
  return error instanceof TypeError
    || error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
}

function providerErrorMessage(error) {
  const status = Number(error?.status)
  if (status === 429) return 'batas permintaan tercapai.'
  return 'gagal memproses permintaan.'
}

function getRetryAfterSeconds(error) {
  const value = Number(error?.retryAfterSeconds)
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0
}

export async function generateWithProviderFallback(primary, fallbackProviders = []) {
  try {
    return { text: await primary(), provider: 'Groq' }
  } catch (primaryError) {
    if (!isRetryableProviderError(primaryError) || !fallbackProviders.length) throw primaryError

    const failures = [{ provider: 'Groq', error: primaryError }]
    for (const fallback of fallbackProviders) {
      try {
        return { text: await fallback.generate(), provider: fallback.provider }
      } catch (error) {
        failures.push({ provider: fallback.provider, error })
      }
    }

    const allRateLimited = failures.length > 0 && failures.every(({ error }) => Number(error?.status) === 429)
    const details = failures
      .map(({ provider, error }) => provider + ': ' + providerErrorMessage(error))
      .join(' · ')
    const finalError = new Error(allRateLimited
      ? 'Semua provider AI mencapai batas permintaan. Coba lagi sebentar.'
      : 'Semua provider AI cadangan gagal. ' + details)
    finalError.status = allRateLimited ? 429 : 502
    if (allRateLimited) {
      finalError.retryAfterSeconds = Math.max(0, ...failures.map(({ error }) => getRetryAfterSeconds(error)))
    }
    throw finalError
  }
}
