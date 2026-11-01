import test from 'node:test'
import assert from 'node:assert/strict'
import { namedMonthDateRange } from './chat/dateRange.js'

test('resolves named months using the requested year when provided', () => {
  assert.deepEqual(namedMonthDateRange('oktober 2025'), {
    from: '2025-10-01',
    to: '2025-10-31'
  })
})

test('resolves a named month without a year using the current year', () => {
  const year = new Date().getFullYear()
  assert.deepEqual(namedMonthDateRange('oktober'), {
    from: year + '-10-01',
    to: year + '-10-31'
  })
})
