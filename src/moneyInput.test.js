import test from 'node:test'
import assert from 'node:assert/strict'
import { clampMoneyInput, formatMoneyInput } from './moneyInput.js'

test('formats floating-point currency values as whole rupiah', () => {
  assert.equal(formatMoneyInput(129999.99999999957), '130.000')
})

test('formats integer values and preserves digit-string input behavior', () => {
  assert.equal(formatMoneyInput(195000), '195.000')
  assert.equal(formatMoneyInput('130000'), '130.000')
})

test('clamps a payment input to the remaining balance', () => {
  assert.equal(clampMoneyInput('1500000', 1200000), '1200000')
  assert.equal(clampMoneyInput('900000', 1200000), '900000')
})
