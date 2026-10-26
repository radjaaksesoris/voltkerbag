import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMoneyInput } from './moneyInput.js'

test('formats floating-point currency values as whole rupiah', () => {
  assert.equal(formatMoneyInput(129999.99999999957), '130.000')
})

test('formats integer values and preserves digit-string input behavior', () => {
  assert.equal(formatMoneyInput(195000), '195.000')
  assert.equal(formatMoneyInput('130000'), '130.000')
})
