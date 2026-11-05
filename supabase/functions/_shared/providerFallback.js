function isRetryableProviderError(error) {
  const status = Number(error?.status)
  if (status === 408 || status === 429 || status >= 500) return true
  if (status) return false
  return error instanceof TypeError
    || error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
}

function providerErrorMessage(error) {
  const message = error instanceof Error ? error.message : 'gagal memproses permintaan.'
  return message.slice(0, 500)
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

    const details = failures
      .map(({ provider, error }) => provider + ': ' + providerErrorMessage(error))
      .join(' · ')
    const finalError = new Error('Semua provider AI cadangan gagal. ' + details)
    finalError.status = 502
    throw finalError
  }
}
