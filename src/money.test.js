import test from 'node:test'
import assert from 'node:assert/strict'
import { isSafeRupiahAmount } from './money.js'

test('accepts safe whole-rupiah amounts', () => {
  assert.equal(isSafeRupiahAmount(130000), true)
  assert.equal(isSafeRupiahAmount('9007199254740991'), true)
})

test('rejects fractional, non-finite, and unsafe rupiah amounts', () => {
  assert.equal(isSafeRupiahAmount(129999.5), false)
  assert.equal(isSafeRupiahAmount('9007199254740992'), false)
  assert.equal(isSafeRupiahAmount(Infinity), false)
  assert.equal(isSafeRupiahAmount(''), false)
})

test('supports zero only when explicitly allowed', () => {
  assert.equal(isSafeRupiahAmount(0), false)
  assert.equal(isSafeRupiahAmount(0, true), true)
  assert.equal(isSafeRupiahAmount(-1, true), false)
})
