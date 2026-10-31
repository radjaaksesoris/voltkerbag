import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAssistantPlan } from './chat/planValidation.js'

test('accepts a supported query plan with structured arguments', () => {
  const plan = validateAssistantPlan({
    kind: 'query',
    query: 'debts',
    message: 'Saya periksa hutang pelanggan.',
    args: { customer: 'Nina' }
  })

  assert.equal(plan.query, 'debts')
  assert.deepEqual(plan.args, { customer: 'Nina' })
})

test('accepts the expanded catalog query plans', () => {
  for (const query of ['categories', 'units', 'product_performance', 'inventory_summary', 'debt_payments', 'cashbook']) {
    assert.equal(validateAssistantPlan({
      kind: 'query',
      query,
      message: 'Saya periksa data toko.',
      args: { sortBy: 'quantity' }
    }).query, query)
  }
})

test('accepts only explicitly supported write actions', () => {
  assert.equal(validateAssistantPlan({
    kind: 'action',
    action: 'add_stock',
    message: 'Saya siapkan penambahan stok.',
    args: { product: 'Tas', quantity: 2, unit: 'lusin', unit_cost: 100000 }
  }).action, 'add_stock')

  assert.throws(() => validateAssistantPlan({
    kind: 'action',
    action: 'run_sql',
    message: 'Jalankan query.',
    args: { sql: 'delete from products' }
  }), /belum didukung/)
})

test('rejects malformed, arbitrary, and missing plan data', () => {
  assert.throws(() => validateAssistantPlan(null), /format/)
  assert.throws(() => validateAssistantPlan({
    kind: 'query',
    query: 'unknown_table',
    message: 'Jawab.',
    args: {}
  }), /belum didukung/)
  assert.throws(() => validateAssistantPlan({
    kind: 'reply',
    message: 'Jawab.',
    args: []
  }), /format/)
})

test('bounds assistant message length', () => {
  const plan = validateAssistantPlan({
    kind: 'reply',
    message: 'x'.repeat(5_000),
    args: {}
  })
  assert.equal(plan.message.length, 4_000)
})
