import test from 'node:test'
import assert from 'node:assert/strict'
import { getChatDayKey } from './chat/chatDay.js'

test('uses the Jakarta calendar date for daily chat reset', () => {
  assert.equal(getChatDayKey(new Date('2026-11-01T16:59:59.000Z')), '2026-11-01')
  assert.equal(getChatDayKey(new Date('2026-11-01T17:00:00.000Z')), '2026-11-02')
})
