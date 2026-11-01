const CHAT_HISTORY_VERSION = 1
const MAX_CHAT_HISTORY_MESSAGES = 100

function getChatHistoryKey(userId) {
  return 'voltker-chat-history:v' + CHAT_HISTORY_VERSION + ':' + encodeURIComponent(userId)
}

function normalizeMessage(message) {
  if (
    !message ||
    typeof message.id !== 'string' ||
    !['user', 'assistant'].includes(message.role) ||
    typeof message.text !== 'string'
  ) {
    throw new Error('Format riwayat chat tidak valid.')
  }

  const normalized = {
    id: message.id,
    role: message.role,
    text: message.text
  }

  if (message.error) normalized.error = true
  if (message.success) normalized.success = true
  if (typeof message.attachmentName === 'string') normalized.attachmentName = message.attachmentName
  if (message.draft) {
    normalized.text += '\n\nPratinjau tindakan tidak disimpan. Kirim ulang perintah jika ingin membuatnya kembali.'
  }

  return normalized
}

export function loadChatHistory(storage, userId, dayKey) {
  const key = getChatHistoryKey(userId)
  const saved = storage.getItem(key)
  if (saved === null) return []

  let history
  try {
    history = JSON.parse(saved)
  } catch {
    throw new Error('Data riwayat chat tersimpan rusak dan tidak dapat dibaca.')
  }

  if (
    !history ||
    history.version !== CHAT_HISTORY_VERSION ||
    typeof history.day !== 'string' ||
    !Array.isArray(history.messages)
  ) {
    throw new Error('Format riwayat chat tersimpan tidak valid.')
  }

  if (history.day !== dayKey) {
    storage.removeItem(key)
    return []
  }

  return history.messages.slice(-MAX_CHAT_HISTORY_MESSAGES).map(normalizeMessage)
}

export function saveChatHistory(storage, userId, dayKey, messages) {
  const savedMessages = messages
    .slice(-MAX_CHAT_HISTORY_MESSAGES)
    .map(normalizeMessage)

  storage.setItem(getChatHistoryKey(userId), JSON.stringify({
    version: CHAT_HISTORY_VERSION,
    day: dayKey,
    messages: savedMessages
  }))
}
