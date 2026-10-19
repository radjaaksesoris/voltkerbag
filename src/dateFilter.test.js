import test from 'node:test'
import assert from 'node:assert/strict'
import { dateRangeTimestamps } from './dateFilter.js'

test('converts an inclusive local date range into a half-open timestamp range', () => {
  const from = new Date(2026, 9, 18).toISOString()
  const to = new Date(2026, 9, 20).toISOString()

  assert.deepEqual(dateRangeTimestamps({ from: '2026-10-18', to: '2026-10-19' }), {
    from,
    to
  })
})

test('allows open-ended date ranges', () => {
  assert.deepEqual(dateRangeTimestamps({ from: '2026-10-19', to: '' }), {
    from: new Date(2026, 9, 19).toISOString(),
    to: null
  })
  assert.deepEqual(dateRangeTimestamps({ from: '', to: '2026-10-19' }), {
    from: null,
    to: new Date(2026, 9, 20).toISOString()
  })
  assert.deepEqual(dateRangeTimestamps({ from: '', to: '' }), { from: null, to: null })
})

test('rejects invalid or reversed date ranges', () => {
  assert.throws(() => dateRangeTimestamps({ from: '2026-02-30', to: '' }), /Tanggal filter tidak valid/)
  assert.throws(() => dateRangeTimestamps({ from: '2026-10-20', to: '2026-10-19' }), /Tanggal awal/)
})
