import test from 'node:test'
import assert from 'node:assert/strict'
import { getRequestedAppMode } from './appMode.js'

test('reads the selected table or chat mode from the URL', () => {
  assert.equal(getRequestedAppMode('?mode=table'), 'table')
  assert.equal(getRequestedAppMode('?mode=chat'), 'chat')
})

test('does not select an app for missing or unsupported modes', () => {
  assert.equal(getRequestedAppMode(''), null)
  assert.equal(getRequestedAppMode('?mode=unknown'), null)
})
