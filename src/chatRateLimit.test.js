import test from 'node:test'
import assert from 'node:assert/strict'
import { formatRateLimitMessage, getRetryAfterSeconds } from '../supabase/functions/_shared/rateLimit.js'

test('uses Groq reset headers and rounds wait time up to whole seconds', () => {
  const headers = new Headers({
    'retry-after': '1',
    'x-ratelimit-reset-tokens': '12.27s'
  })

  assert.equal(getRetryAfterSeconds(headers), 13)
})

test('reads millisecond and second wait times from the provider message', () => {
  assert.equal(getRetryAfterSeconds(new Headers(), 'Please try again in 855ms.'), 1)
  assert.equal(getRetryAfterSeconds(new Headers(), 'Please try again in 12.27s.'), 13)
})

test('preserves long retry windows, caps extreme values, and leaves unknown waits unset', () => {
  assert.equal(getRetryAfterSeconds(new Headers({ 'retry-after': '900' })), 900)
  assert.equal(getRetryAfterSeconds(new Headers({ 'retry-after': '100000' })), 86_400)
  assert.equal(getRetryAfterSeconds(new Headers()), 0)
})

test('formats a user-facing rate-limit message with a retry delay', () => {
  assert.match(formatRateLimitMessage(13), /Coba lagi dalam 13 detik/)
  assert.match(formatRateLimitMessage(0), /Tunggu sebentar/)
})
