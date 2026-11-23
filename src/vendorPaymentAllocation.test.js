import test from 'node:test'
import assert from 'node:assert/strict'
import { allocateVendorPayment } from './vendorPaymentAllocation.js'

const payables = [
  { id: 3, date: '2026-11-23T10:00:00Z', balance_due: 1_050_000 },
  { id: 2, date: '2026-11-23T09:00:00Z', balance_due: 1_260_000 }
]

test('allocates vendor payments to the oldest purchase first', () => {
  const result = allocateVendorPayment(payables, 1_400_000)

  assert.deepEqual(result.allocations.map(({ payableId, amount }) => ({ payableId, amount })), [
    { payableId: 2, amount: 1_260_000 },
    { payableId: 3, amount: 140_000 }
  ])
  assert.equal(result.allocatedAmount, 1_400_000)
  assert.equal(result.remainingAmount, 0)
})

test('reports unallocated balance when a purchase is excluded', () => {
  const result = allocateVendorPayment(payables, 1_400_000, [2])

  assert.deepEqual(result.allocations.map(({ payableId, amount }) => ({ payableId, amount })), [
    { payableId: 3, amount: 1_050_000 }
  ])
  assert.equal(result.allocatedAmount, 1_050_000)
  assert.equal(result.remainingAmount, 350_000)
})

test('ignores settled payables and invalid payment amounts', () => {
  const result = allocateVendorPayment([
    ...payables,
    { id: 4, date: '2026-11-24T09:00:00Z', balance_due: 0 }
  ], 0)

  assert.deepEqual(result.allocations, [])
  assert.equal(result.allocatedAmount, 0)
  assert.equal(result.remainingAmount, 0)
})
