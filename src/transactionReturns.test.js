import assert from 'node:assert/strict'
import test from 'node:test'
import { returnedAmount, returnedQuantity, transactionRefundTotal } from './transactionReturns.js'

test('summarizes returned quantities and values by original transaction line', () => {
  const transaction = {
    returns: [
      { refundAmount: 100000, items: [{ lineIndex: 1, qty: 25, price: 4000 }] },
      { refundAmount: 0, items: [{ lineIndex: 1, qty: 5, price: 4000 }, { lineIndex: 0, qty: 2, price: 1000 }] }
    ]
  }
  assert.equal(returnedQuantity(transaction, 1), 30)
  assert.equal(returnedAmount(transaction, 1), 120000)
  assert.equal(returnedQuantity(transaction, 0), 2)
  assert.equal(transactionRefundTotal(transaction), 100000)
})
