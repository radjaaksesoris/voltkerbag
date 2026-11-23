import test from 'node:test'
import assert from 'node:assert/strict'
import { getFinanceEntryCustomerName } from './financeEntryPresentation.js'

test('hides internal batch metadata when extracting installment customer names', () => {
  assert.equal(
    getFinanceEntryCustomerName({
      type: 'income',
      note: 'Cicilan transaksi INV-20261123-02 · Andri · batch=05c33b6d-c032-4f04-b796-0ce242bd68ba'
    }),
    'Andri'
  )
})

test('keeps customer names from credit payments without batch metadata', () => {
  assert.equal(
    getFinanceEntryCustomerName({
      type: 'income',
      note: 'Cicilan transaksi INV-20261123-02 · Andri'
    }),
    'Andri'
  )
})

test('does not show customer names for non-income entries', () => {
  assert.equal(
    getFinanceEntryCustomerName({
      type: 'expense',
      note: 'Cicilan transaksi INV-20261123-02 · Andri · batch=internal'
    }),
    ''
  )
})
