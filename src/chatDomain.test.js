import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allTimeDateRangeThroughToday,
  namedMonthDateRange,
  specificDateRangeForPeriod
} from './chat/dateRange.js'

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

test('resolves relative and specific sales days into exact local date ranges', () => {
  const now = new Date(2026, 10, 3, 12)

  assert.deepEqual(specificDateRangeForPeriod('kemarin', now), null)
  assert.deepEqual(specificDateRangeForPeriod('hari senin kemarin', now), {
    from: '2026-11-02',
    to: '2026-11-02'
  })
  assert.deepEqual(specificDateRangeForPeriod('hari senin kemarin', now), {
    from: '2026-11-02',
    to: '2026-11-02'
  })
  assert.deepEqual(specificDateRangeForPeriod('tanggal 31 oktober 2026', now), {
    from: '2026-10-31',
    to: '2026-10-31'
  })
  assert.deepEqual(specificDateRangeForPeriod('tanggal 31 bulan lalu', now), {
    from: '2026-10-31',
    to: '2026-10-31'
  })
})

test('rejects a requested day that does not exist in the referenced month', () => {
  assert.throws(
    () => specificDateRangeForPeriod('tanggal 31 bulan lalu', new Date(2026, 2, 3, 12)),
    /Tanggal tersebut tidak ada pada bulan lalu/
  )
})

test('represents all recorded history through today as an open-start date range', () => {
  assert.deepEqual(allTimeDateRangeThroughToday(new Date(2026, 10, 3, 12)), {
    from: '',
    to: '2026-11-03'
  })
})
