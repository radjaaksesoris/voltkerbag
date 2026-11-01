import test from 'node:test'
import assert from 'node:assert/strict'
import { loadChatHistory, saveChatHistory } from './chat/chatHistory.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  }
}

test('restores the current user chat history for the current Jakarta day', () => {
  const storage = createStorage()
  const messages = [
    { id: 'user-1', role: 'user', text: 'Berapa stok tas?' },
    { id: 'assistant-1', role: 'assistant', text: 'Stok tas ada 12.' }
  ]

  saveChatHistory(storage, 'user-123', '2026-11-01', messages)

  assert.deepEqual(loadChatHistory(storage, 'user-123', '2026-11-01'), messages)
  assert.deepEqual(loadChatHistory(storage, 'user-456', '2026-11-01'), [])
})

test('clears chat history saved on a previous day', () => {
  const storage = createStorage()
  saveChatHistory(storage, 'user-123', '2026-10-31', [
    { id: 'message-1', role: 'user', text: 'Pesan kemarin' }
  ])

  assert.deepEqual(loadChatHistory(storage, 'user-123', '2026-11-01'), [])
  assert.deepEqual(loadChatHistory(storage, 'user-123', '2026-10-31'), [])
})

test('does not restore an unconfirmed action preview as an active action', () => {
  const storage = createStorage()
  saveChatHistory(storage, 'user-123', '2026-11-01', [
    { id: 'message-1', role: 'assistant', text: 'Tambahkan stok?', draft: { action: 'add_stock' } }
  ])

  const [message] = loadChatHistory(storage, 'user-123', '2026-11-01')
  assert.equal(message.draft, undefined)
  assert.match(message.text, /Pratinjau tindakan tidak disimpan/)
})

test('limits persisted history to the newest 100 messages', () => {
  const storage = createStorage()
  const messages = Array.from({ length: 105 }, (_, index) => ({
    id: 'message-' + index,
    role: 'user',
    text: 'Pesan ' + index
  }))

  saveChatHistory(storage, 'user-123', '2026-11-01', messages)

  const restored = loadChatHistory(storage, 'user-123', '2026-11-01')
  assert.equal(restored.length, 100)
  assert.equal(restored[0].id, 'message-5')
  assert.equal(restored[99].id, 'message-104')
})
