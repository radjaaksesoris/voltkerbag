import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateCustomerPayment } from './customerPaymentAllocation.js'

const invoices = [
  { id: 3, invoiceNo: 'INV-03', createdAt: '2026-11-23T10:00:00Z', balanceDue: 1_300_000 },
  { id: 2, invoiceNo: 'INV-02', createdAt: '2026-11-23T09:00:00Z', balanceDue: 1_300_000 }
]

test('allocates payment to the oldest invoice before the newer one', () => {
  const result = allocateCustomerPayment(invoices, 1_400_000)

  assert.deepEqual(result.allocations.map(({ transactionId, amount }) => ({ transactionId, amount })), [
    { transactionId: 2, amount: 1_300_000 },
    { transactionId: 3, amount: 100_000 }
  ])
  assert.equal(result.allocatedAmount, 1_400_000)
  assert.equal(result.remainingAmount, 0)
})

test('keeps the submitted total and reports any amount that cannot be allocated after excluding an invoice', () => {
  const result = allocateCustomerPayment(invoices, 1_400_000, [2])

  assert.deepEqual(result.allocations.map(({ transactionId, amount }) => ({ transactionId, amount })), [
    { transactionId: 3, amount: 1_300_000 }
  ])
  assert.equal(result.allocatedAmount, 1_300_000)
  assert.equal(result.remainingAmount, 100_000)
})

test('does not allocate invalid amounts or settled invoices', () => {
  const result = allocateCustomerPayment([
    ...invoices,
    { id: 4, createdAt: '2026-11-24T09:00:00Z', balanceDue: 0 }
  ], 0)

  assert.deepEqual(result.allocations, [])
  assert.equal(result.allocatedAmount, 0)
  assert.equal(result.remainingAmount, 0)
})
