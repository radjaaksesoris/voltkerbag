import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWithProviderFallback } from '../supabase/functions/_shared/providerFallback.js'

test('uses Groq normally and reports the selected provider', async () => {
  const result = await generateWithProviderFallback(async () => 'groq plan', [
    { provider: 'Gemini', generate: async () => 'gemini plan' },
    { provider: 'OpenRouter Free', generate: async () => 'free model plan' }
  ])

  assert.deepEqual(result, { text: 'groq plan', provider: 'Groq' })
})

test('uses Gemini only when Groq is rate limited', async () => {
  const error = Object.assign(new Error('rate limited'), { status: 429 })
  const result = await generateWithProviderFallback(
    async () => { throw error },
    [{ provider: 'Gemini', generate: async () => 'gemini plan' }]
  )

  assert.deepEqual(result, { text: 'gemini plan', provider: 'Gemini' })
})

test('does not fall back for non-retryable Groq client errors', async () => {
  let fallbackCalled = false
  await assert.rejects(
    generateWithProviderFallback(
      async () => { throw Object.assign(new Error('Invalid request'), { status: 400 }) },
      [{ provider: 'Gemini', generate: async () => {
        fallbackCalled = true
        return 'gemini plan'
      } }]
    ),
    /Invalid request/
  )
  assert.equal(fallbackCalled, false)
})

test('preserves the Groq limit error when no fallback is configured', async () => {
  const error = Object.assign(new Error('rate limited'), { status: 429 })
  await assert.rejects(
    generateWithProviderFallback(async () => { throw error }),
    (caught) => caught === error
  )
})

test('tries OpenRouter free models after Gemini returns a temporary server error', async () => {
  const result = await generateWithProviderFallback(
    async () => { throw Object.assign(new Error('Groq rate limited'), { status: 429 }) },
    [
      {
        provider: 'Gemini',
        generate: async () => { throw Object.assign(new Error('high demand'), { status: 503 }) }
      },
      { provider: 'OpenRouter Free', generate: async () => 'free model plan' }
    ]
  )
  assert.deepEqual(result, { text: 'free model plan', provider: 'OpenRouter Free' })
})

test('uses OpenRouter free models when Gemini is not configured', async () => {
  const result = await generateWithProviderFallback(
    async () => { throw Object.assign(new Error('Groq rate limited'), { status: 429 }) },
    [{ provider: 'OpenRouter Free', generate: async () => 'free model plan' }]
  )
  assert.deepEqual(result, { text: 'free model plan', provider: 'OpenRouter Free' })
})

test('falls back after temporary Groq server and network errors', async () => {
  for (const error of [
    Object.assign(new Error('Groq unavailable'), { status: 503 }),
    new TypeError('Failed to fetch')
  ]) {
    const result = await generateWithProviderFallback(
      async () => { throw error },
      [{ provider: 'Gemini', generate: async () => 'gemini plan' }]
    )
    assert.deepEqual(result, { text: 'gemini plan', provider: 'Gemini' })
  }
})

test('reports all provider failures after exhausting the fallback chain', async () => {
  await assert.rejects(
    generateWithProviderFallback(
      async () => { throw Object.assign(new Error('rate limited'), { status: 429 }) },
      [
        { provider: 'Gemini', generate: async () => { throw Object.assign(new Error('high demand'), { status: 503 }) } },
        { provider: 'OpenRouter Free', generate: async () => { throw Object.assign(new Error('temporary failure'), { status: 503 }) } }
      ]
    ),
    (error) => error.status === 502
      && error.message === 'Semua provider AI cadangan gagal. Groq: batas permintaan tercapai. · Gemini: gagal memproses permintaan. · OpenRouter Free: gagal memproses permintaan.'
  )
})

test('preserves 429 and retryAfterSeconds when all providers are rate limited', async () => {
  await assert.rejects(
    generateWithProviderFallback(
      async () => { throw Object.assign(new Error('rate limited'), { status: 429, retryAfterSeconds: 12 }) },
      [
        { provider: 'Gemini', generate: async () => { throw Object.assign(new Error('limited'), { status: 429, retryAfterSeconds: 30 }) } },
        { provider: 'OpenRouter Free', generate: async () => { throw Object.assign(new Error('limited'), { status: 429, retryAfterSeconds: 20 }) } }
      ]
    ),
    (error) => error.status === 429
      && error.retryAfterSeconds === 30
      && /batas permintaan/.test(error.message)
  )
})
