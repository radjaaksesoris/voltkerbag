import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCustomerDebts } from './chat/customerDebt.js'

const customers = [
  { customer_name: 'Andri', balance_due: 615_000 },
  { customer_name: 'Agus Salim', balance_due: 153_750 }
]

test('filters debt balances by exact customer name before partial matches', () => {
  assert.deepEqual(filterCustomerDebts(customers, 'andri'), [customers[0]])
})

test('returns partial customer matches when there is no exact match', () => {
  assert.deepEqual(filterCustomerDebts(customers, 'agus'), [customers[1]])
})

test('returns all debt balances when no customer is specified', () => {
  assert.deepEqual(filterCustomerDebts(customers), customers)
})
