const CHAT_PREFERENCES_VERSION = 1
const MAX_WATCHED_PRODUCTS = 5
const MAX_PRODUCT_NAME_LENGTH = 80

export const DEFAULT_CHAT_PREFERENCES = {
  defaultPeriod: 'dashboard',
  responseStyle: 'friendly',
  watchedProducts: []
}

const REPORT_PERIODS = new Set(['dashboard', 'hari ini', 'minggu ini', 'bulan ini', 'bulan lalu'])
const RESPONSE_STYLES = new Set(['concise', 'friendly', 'detailed'])
const PERIOD_QUERY_INTENTS = new Set([
  'daily_summary', 'sales_summary', 'finance_summary', 'operational_insights'
])

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
    watchedProducts
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
