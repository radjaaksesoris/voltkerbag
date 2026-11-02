import { getClient } from '../supabaseSync'
import { validateAssistantPlan } from './planValidation.js'

async function getErrorDetails(error, fallback) {
  const context = error?.context
  let body
  if (typeof context?.clone === 'function') {
    try {
      body = await context.clone().json()
    } catch {
      body = null
    }
  } else {
    body = context?.body
  }

  const bodyMessage = body?.error || body?.message
  const message = typeof bodyMessage === 'string' && bodyMessage.trim()
    ? bodyMessage
    : typeof error?.message === 'string' && error.message.trim()
      ? error.message
      : context?.status
        ? 'Edge Function gagal (HTTP ' + context.status + ').'
        : fallback
  return {
    message,
    status: context?.status || 0,
    retryAfterSeconds: Number.isFinite(body?.retryAfterSeconds)
      ? Math.max(0, body.retryAfterSeconds)
      : 0
  }
}

async function throwAssistantError(error, fallback) {
  const details = await getErrorDetails(error, fallback)
  const assistantError = new Error(details.message)
  assistantError.status = details.status
  assistantError.retryAfterSeconds = details.retryAfterSeconds
  throw assistantError
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
  if (error) await throwAssistantError(error, 'Gagal menghubungi asisten chat.')
  return validateAssistantPlan(data)
}

export async function checkAssistantConnection() {
  const { data, error } = await getClient().functions.invoke('chat-assistant', {
    body: { mode: 'health' }
  })
  if (error) await throwAssistantError(error, 'Tidak dapat memeriksa koneksi AI Groq.')
  if (!data || data.connected !== true) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'AI Groq tidak dapat dihubungi.')
  }
  return data
}
