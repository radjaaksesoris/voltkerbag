const CHAT_PREFERENCES_VERSION = 1
const MAX_WATCHED_PRODUCTS = 5
const MAX_PRODUCT_NAME_LENGTH = 80
const MAX_CORRECTIONS = 12
const MAX_APPROVED_CORRECTIONS = 6
const MAX_CORRECTION_LENGTH = 240

export const DEFAULT_CHAT_PREFERENCES = {
  defaultPeriod: 'dashboard',
  responseStyle: 'friendly',
  watchedProducts: [],
  corrections: []
}

const REPORT_PERIODS = new Set(['dashboard', 'hari ini', 'minggu ini', 'bulan ini', 'bulan lalu'])
const RESPONSE_STYLES = new Set(['concise', 'friendly', 'detailed'])
const PERIOD_QUERY_INTENTS = new Set([
  'daily_summary', 'sales_summary', 'finance_summary', 'operational_insights',
  'sales_trend', 'product_stock_performance'
])

function normalizeCorrectionText(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_CORRECTION_LENGTH)
}

function looksLikePersonalData(value) {
  return /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)
    || /(?:\+?\d[\s().-]*){8,}/.test(value)
}

export function normalizeChatCorrections(value) {
  if (!Array.isArray(value)) return []
  const corrections = []
  const seen = new Set()
  for (const entry of value.slice(-MAX_CORRECTIONS)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const text = normalizeCorrectionText(entry.text)
    const status = ['pending', 'approved', 'rejected'].includes(entry.status) ? entry.status : 'pending'
    const id = typeof entry.id === 'string' ? entry.id.slice(0, 80) : ''
    const normalizedText = text.toLocaleLowerCase('id-ID')
    if (!id || !text || looksLikePersonalData(text) || seen.has(normalizedText)) continue
    seen.add(normalizedText)
    corrections.push({
      id,
      text,
      status,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt.slice(0, 40) : ''
    })
  }
  return corrections
}

export function createChatCorrection(text, id, createdAt = new Date().toISOString()) {
  const normalizedText = normalizeCorrectionText(text)
  if (!normalizedText) throw new Error('Isi koreksi terlebih dahulu.')
  if (looksLikePersonalData(normalizedText)) {
    throw new Error('Koreksi tidak boleh memuat email atau nomor telepon/data pribadi.')
  }
  if (!id) throw new Error('ID koreksi tidak valid.')
  return { id, text: normalizedText, status: 'pending', createdAt }
}

export function updateChatCorrection(corrections, id, status) {
  if (!['approved', 'rejected'].includes(status)) throw new Error('Status koreksi tidak valid.')
  const normalized = normalizeChatCorrections(corrections)
  const canUpdate = normalized.some((correction) =>
    correction.id === id
    && (correction.status === 'pending' || correction.status === 'approved' && status === 'rejected')
  )
  if (!canUpdate) throw new Error('Koreksi tidak ditemukan atau sudah ditinjau.')
  if (status === 'approved'
    && normalized.filter((correction) => correction.status === 'approved').length >= MAX_APPROVED_CORRECTIONS) {
    throw new Error('Maksimal 6 koreksi dapat diaktifkan. Nonaktifkan satu koreksi terlebih dahulu.')
  }
  return normalized.map((correction) =>
    correction.id === id ? { ...correction, status } : correction
  )
}

export function getApprovedChatCorrections(preferences) {
  return normalizeChatCorrections(preferences?.corrections)
    .filter((correction) => correction.status === 'approved')
    .slice(-MAX_APPROVED_CORRECTIONS)
    .map(({ text }) => text)
}

function getPreferencesKey(userId) {
  return 'voltker-chat-preferences:v' + CHAT_PREFERENCES_VERSION + ':' + encodeURIComponent(userId)
}

export function normalizeChatPreferences(preferences = {}) {
  const defaultPeriod = REPORT_PERIODS.has(preferences.defaultPeriod)
    ? preferences.defaultPeriod
    : DEFAULT_CHAT_PREFERENCES.defaultPeriod
  const responseStyle = RESPONSE_STYLES.has(preferences.responseStyle)
    ? preferences.responseStyle
    : DEFAULT_CHAT_PREFERENCES.responseStyle
  const watchedProducts = []
  const seenProducts = new Set()
  if (Array.isArray(preferences.watchedProducts)) {
    for (const value of preferences.watchedProducts) {
      if (typeof value !== 'string') continue
      const name = value.trim().slice(0, MAX_PRODUCT_NAME_LENGTH)
      const normalizedName = name.toLocaleLowerCase('id-ID')
      if (!name || seenProducts.has(normalizedName)) continue
      seenProducts.add(normalizedName)
      watchedProducts.push(name)
      if (watchedProducts.length === MAX_WATCHED_PRODUCTS) break
    }
  }

  return {
    defaultPeriod,
    responseStyle,
    watchedProducts,
    corrections: normalizeChatCorrections(preferences.corrections)
  }
}

export function loadChatPreferences(storage, userId) {
  const saved = storage.getItem(getPreferencesKey(userId))
  if (saved === null) return { ...DEFAULT_CHAT_PREFERENCES, watchedProducts: [] }

  let preferences
  try {
    preferences = JSON.parse(saved)
  } catch {
    throw new Error('Preferensi asisten tersimpan rusak dan tidak dapat dibaca.')
  }
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
    throw new Error('Format preferensi asisten tersimpan tidak valid.')
  }
  return normalizeChatPreferences(preferences)
}

export function saveChatPreferences(storage, userId, preferences) {
  const normalized = normalizeChatPreferences(preferences)
  storage.setItem(getPreferencesKey(userId), JSON.stringify(normalized))
  return normalized
}

export function applyChatPreferencesToPlan(plan, preferences) {
  if (plan?.kind !== 'query' || !PERIOD_QUERY_INTENTS.has(plan.query)
    || preferences.defaultPeriod === 'dashboard'
    || plan.args?.period || plan.args?.from || plan.args?.to) {
    return plan
  }
  return {
    ...plan,
    args: { ...plan.args, period: preferences.defaultPeriod }
  }
}

export function buildAssistantHistory(messages) {
  return messages
    .filter((message) => message.role === 'user' || message.contextSafe === true)
    .slice(-6)
    .map((message) => ({
      role: message.role,
      content: String(message.text || '').slice(0, 1_600)
    }))
    .filter((message) => message.content)
}
