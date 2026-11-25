import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateCustomerDebtPayment,
  allocateCustomerPayment,
  orderCustomerManualCredits
} from './customerPaymentAllocation.js'

const invoices = [
  { id: 3, invoiceNo: 'INV-03', createdAt: '2026-11-23T10:00:00Z', balanceDue: 1_300_000 },
  { id: 2, invoiceNo: 'INV-02', createdAt: '2026-11-23T09:00:00Z', balanceDue: 1_300_000 }
]

const manualCredits = [
  { id: 20, createdAt: '2026-11-20T09:00:00Z', balance_due: 500_000 },
  { id: 21, createdAt: '2026-11-21T09:00:00Z', balance_due: 400_000 }
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

test('orders manual credits from the oldest record first', () => {
  const result = orderCustomerManualCredits([
    ...manualCredits,
    { id: 22, createdAt: '2026-11-22T09:00:00Z', balance_due: 0 }
  ])

  assert.deepEqual(result.map((credit) => credit.id), [20, 21])
})

test('allocates invoices before manual credits and reports the combined total', () => {
  const result = allocateCustomerDebtPayment({
    invoices,
    manualCredits,
    amount: 2_000_000
  })

  assert.deepEqual(result.allocations.map(({ kind, id, amount }) => ({ kind, id, amount })), [
    { kind: 'invoice', id: 2, amount: 1_300_000 },
    { kind: 'invoice', id: 3, amount: 700_000 }
  ])
  assert.equal(result.allocatedAmount, 2_000_000)
  assert.equal(result.remainingAmount, 0)
})

test('continues to manual credits after all selected invoices are settled', () => {
  const result = allocateCustomerDebtPayment({
    invoices,
    manualCredits,
    amount: 3_200_000
  })

  assert.deepEqual(result.allocations.map(({ kind, id, amount }) => ({ kind, id, amount })), [
    { kind: 'invoice', id: 2, amount: 1_300_000 },
    { kind: 'invoice', id: 3, amount: 1_300_000 },
    { kind: 'manual_credit', id: 20, amount: 500_000 },
    { kind: 'manual_credit', id: 21, amount: 100_000 }
  ])
  assert.equal(result.allocatedAmount, 3_200_000)
  assert.equal(result.remainingAmount, 0)
})

test('keeps excluded invoices and manual credits out of the allocation', () => {
  const result = allocateCustomerDebtPayment({
    invoices,
    manualCredits,
    amount: 1_000_000,
    excludedInvoiceIds: [2],
    excludedManualCreditIds: [20]
  })

  assert.deepEqual(result.allocations.map(({ kind, id, amount }) => ({ kind, id, amount })), [
    { kind: 'invoice', id: 3, amount: 1_000_000 }
  ])
  assert.equal(result.allocatedAmount, 1_000_000)
  assert.equal(result.remainingAmount, 0)
})

test('reports an unallocated remainder when the payment exceeds all open debt', () => {
  const result = allocateCustomerDebtPayment({
    invoices,
    manualCredits,
    amount: 4_000_000
  })

  assert.equal(result.allocatedAmount, 3_500_000)
  assert.equal(result.remainingAmount, 500_000)
})
