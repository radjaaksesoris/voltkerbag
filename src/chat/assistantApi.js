import { getClient } from '../supabaseSync'
import { validateAssistantPlan } from './planValidation.js'

async function getErrorMessage(error, fallback) {
  const context = error?.context
  let message = context?.body?.error || context?.body?.message
  if (typeof message === 'string' && message.trim()) return message

  if (typeof context?.clone === 'function') {
    try {
      const body = await context.clone().json()
      const bodyMessage = body?.error || body?.message
      if (typeof bodyMessage === 'string' && bodyMessage.trim()) return bodyMessage
    } catch {
      if (context.status) return 'Edge Function gagal (HTTP ' + context.status + ').'
    }
    if (context.status) return 'Edge Function gagal (HTTP ' + context.status + ').'
  }

  message = error?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export async function requestAssistantPlan({ message, history, pendingAction, attachmentName, responseStyle }) {
  const { data, error } = await getClient().functions.invoke('chat-assistant', {
    body: {
      mode: 'plan',
      message,
      history,
      pendingAction: pendingAction || null,
      attachmentName: attachmentName || '',
      responseStyle
    }
  })
  if (error) throw new Error(await getErrorMessage(error, 'Gagal menghubungi asisten chat.'))
  return validateAssistantPlan(data)
}

export async function checkAssistantConnection() {
  const { data, error } = await getClient().functions.invoke('chat-assistant', {
    body: { mode: 'health' }
  })
  if (error) throw new Error(await getErrorMessage(error, 'Tidak dapat memeriksa koneksi AI Groq.'))
  if (!data || data.connected !== true) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'AI Groq tidak dapat dihubungi.')
  }
  return data
}
