export async function generateWithRateLimitFallback(primary, fallback, fallbackProvider = 'Gemini') {
  try {
    return { text: await primary(), provider: 'Groq' }
  } catch (error) {
    if (error?.status !== 429 || typeof fallback !== 'function') throw error
    try {
      return { text: await fallback(), provider: fallbackProvider }
    } catch (fallbackError) {
      const message = fallbackError instanceof Error
        ? fallbackError.message
        : 'penyedia cadangan tidak dapat memproses permintaan.'
      const errorWithFallback = new Error(
        'Groq mencapai batas penggunaan dan ' + fallbackProvider + ' juga gagal: ' + message
      )
      errorWithFallback.status = 502
      throw errorWithFallback
    }
  }
}
