import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyChatPreferencesToPlan,
  buildAssistantHistory,
  DEFAULT_CHAT_PREFERENCES,
  loadChatPreferences,
  normalizeChatPreferences,
  saveChatPreferences
} from './chat/chatPreferences.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
}

test('stores preferences separately for each signed-in user', () => {
  const storage = createStorage()
  const saved = saveChatPreferences(storage, 'user-123', {
    defaultPeriod: 'bulan ini',
    responseStyle: 'detailed',
    watchedProducts: [' Tas A ', 'tas a', 'Tas B']
  })

  assert.deepEqual(saved, {
    defaultPeriod: 'bulan ini',
    responseStyle: 'detailed',
    watchedProducts: ['Tas A', 'Tas B']
  })
  assert.deepEqual(loadChatPreferences(storage, 'user-123'), saved)
  assert.deepEqual(loadChatPreferences(storage, 'user-456'), DEFAULT_CHAT_PREFERENCES)
})

test('bounds watchlist length and rejects unsupported preference values', () => {
  assert.deepEqual(normalizeChatPreferences({
    defaultPeriod: 'all time',
    responseStyle: 'unrestricted',
    watchedProducts: ['A', 'B', 'C', 'D', 'E', 'F', '']
  }), {
    defaultPeriod: 'dashboard',
    responseStyle: 'friendly',
    watchedProducts: ['A', 'B', 'C', 'D', 'E']
  })
})

test('applies a preferred default period without overriding explicit filters', () => {
  const plan = { kind: 'query', query: 'operational_insights', args: {} }
  assert.deepEqual(applyChatPreferencesToPlan(plan, {
    defaultPeriod: 'bulan ini'
  }), {
    kind: 'query',
    query: 'operational_insights',
    args: { period: 'bulan ini' }
  })
  assert.equal(applyChatPreferencesToPlan({
    ...plan,
    args: { period: 'kemarin' }
  }, { defaultPeriod: 'bulan ini' }).args.period, 'kemarin')
  assert.equal(applyChatPreferencesToPlan({
    ...plan,
    query: 'stock'
  }, { defaultPeriod: 'bulan ini' }).args.period, undefined)
})

test('sends only user messages and explicitly safe clarification replies as context', () => {
  assert.deepEqual(buildAssistantHistory([
    { role: 'user', text: 'Berapa omzet hari ini?' },
    { role: 'assistant', text: 'Omzet hari ini Rp1.000.000.' },
    { role: 'user', text: 'Bandingkan dengan kemarin.' },
    { role: 'assistant', text: 'Perlu saya cek periode kemarin?' , contextSafe: true }
  ]), [
    { role: 'user', content: 'Berapa omzet hari ini?' },
    { role: 'user', content: 'Bandingkan dengan kemarin.' },
    { role: 'assistant', content: 'Perlu saya cek periode kemarin?' }
  ])
})

test('reports malformed stored preferences instead of silently resetting them', () => {
  const storage = createStorage()
  storage.setItem('voltker-chat-preferences:v1:user-123', '{invalid')
  assert.throws(() => loadChatPreferences(storage, 'user-123'), /rusak/)
})
