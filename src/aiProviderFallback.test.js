import test from 'node:test'
import assert from 'node:assert/strict'
import { generateWithRateLimitFallback } from '../supabase/functions/_shared/providerFallback.js'

test('uses Groq normally and reports the selected provider', async () => {
  const result = await generateWithRateLimitFallback(
    async () => 'groq plan',
    async () => 'gemini plan'
  )

  assert.deepEqual(result, { text: 'groq plan', provider: 'Groq' })
})

test('uses Gemini only when Groq is rate limited', async () => {
  const error = Object.assign(new Error('rate limited'), { status: 429 })
  const result = await generateWithRateLimitFallback(
    async () => { throw error },
    async () => 'gemini plan'
  )

  assert.deepEqual(result, { text: 'gemini plan', provider: 'Gemini' })
})

test('does not use Gemini for non-rate-limit Groq failures', async () => {
  let fallbackCalled = false
  await assert.rejects(
    generateWithRateLimitFallback(
      async () => { throw new Error('Groq unavailable') },
      async () => {
        fallbackCalled = true
        return 'gemini plan'
      }
    ),
    /Groq unavailable/
  )
  assert.equal(fallbackCalled, false)
})

test('preserves the Groq limit error when no fallback is configured', async () => {
  const error = Object.assign(new Error('rate limited'), { status: 429 })
  await assert.rejects(
    generateWithRateLimitFallback(async () => { throw error }, undefined),
    (caught) => caught === error
  )
})

test('reports Gemini failure explicitly after Groq rate limiting', async () => {
  const error = Object.assign(new Error('rate limited'), { status: 429 })
  await assert.rejects(
    generateWithRateLimitFallback(
      async () => { throw error },
      async () => { throw new Error('Gemini quota exhausted') }
    ),
    /Groq mencapai batas penggunaan dan Gemini juga gagal: Gemini quota exhausted/
  )
})
