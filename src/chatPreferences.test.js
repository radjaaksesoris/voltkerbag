import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyChatPreferencesToPlan,
  buildAssistantHistory,
  createChatCorrection,
  DEFAULT_CHAT_PREFERENCES,
  getApprovedChatCorrections,
  loadChatPreferences,
  normalizeChatPreferences,
  saveChatPreferences,
  updateChatCorrection
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
    watchedProducts: ['Tas A', 'Tas B'],
    corrections: []
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
    watchedProducts: ['A', 'B', 'C', 'D', 'E'],
    corrections: []
  })
})

test('only approved, bounded corrections are included in assistant guidance', () => {
  const pending = createChatCorrection('Jawab dalam bahasa Indonesia.', 'correction-1', '2026-03-10')
  const corrections = updateChatCorrection([pending], pending.id, 'approved')
  assert.deepEqual(getApprovedChatCorrections({ corrections }), ['Jawab dalam bahasa Indonesia.'])
  assert.deepEqual(getApprovedChatCorrections({
    corrections: [pending]
  }), [])
  assert.throws(() => createChatCorrection('Gunakan email admin@example.com', 'correction-2'), /email/)
  assert.deepEqual(getApprovedChatCorrections({
    corrections: updateChatCorrection(corrections, pending.id, 'rejected')
  }), [])
})

test('persists correction review state per account and rejects phone-number content', () => {
  const storage = createStorage()
  const pending = createChatCorrection('Jangan menyamakan omzet dengan pemasukan.', 'correction-3', '2026-03-10')
  const saved = saveChatPreferences(storage, 'user-123', {
    ...DEFAULT_CHAT_PREFERENCES,
    corrections: [pending]
  })
  assert.deepEqual(loadChatPreferences(storage, 'user-123').corrections, [pending])
  assert.deepEqual(loadChatPreferences(storage, 'user-456').corrections, [])
  assert.deepEqual(getApprovedChatCorrections(saved), [])
  assert.deepEqual(getApprovedChatCorrections({
    ...saved,
    corrections: updateChatCorrection(saved.corrections, pending.id, 'approved')
  }), ['Jangan menyamakan omzet dengan pemasukan.'])
  assert.throws(() => createChatCorrection('Pelanggan 081234567890', 'correction-4'), /data pribadi/)
})

test('limits active correction guidance and allows an approved correction to be disabled', () => {
  const pending = Array.from({ length: 7 }, (_, index) =>
    createChatCorrection('Panduan umum ' + index, 'correction-' + index)
  )
  let corrections = pending.slice(0, 6).reduce(
    (current, entry) => updateChatCorrection(current, entry.id, 'approved'),
    pending
  )
  assert.throws(() => updateChatCorrection(corrections, 'correction-6', 'approved'), /Maksimal 6/)
  corrections = updateChatCorrection(corrections, 'correction-0', 'rejected')
  corrections = updateChatCorrection(corrections, 'correction-6', 'approved')
  assert.equal(getApprovedChatCorrections({ corrections }).length, 6)
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

test('limits assistant context to six recent messages and 1,600 characters each', () => {
  const history = buildAssistantHistory(Array.from({ length: 8 }, (_, index) => ({
    role: 'user',
    text: String(index).repeat(2_000)
  })))

  assert.equal(history.length, 6)
  assert.deepEqual(history.map(({ content }) => content[0]), ['2', '3', '4', '5', '6', '7'])
  assert.ok(history.every(({ content }) => content.length === 1_600))
})

test('reports malformed stored preferences instead of silently resetting them', () => {
  const storage = createStorage()
  storage.setItem('voltker-chat-preferences:v1:user-123', '{invalid')
  assert.throws(() => loadChatPreferences(storage, 'user-123'), /rusak/)
})
