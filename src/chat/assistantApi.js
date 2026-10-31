import { getClient } from '../supabaseSync'
import { validateAssistantPlan } from './planValidation.js'

async function getErrorMessage(error, fallback) {
  const context = error?.context
  let message = context?.body?.error
  if (typeof message === 'string' && message.trim()) return message

  if (typeof context?.clone === 'function') {
    try {
      const body = await context.clone().json()
      if (typeof body?.error === 'string' && body.error.trim()) return body.error
    } catch {
      if (context.status) return 'Edge Function gagal (HTTP ' + context.status + ').'
    }
    if (context.status) return 'Edge Function gagal (HTTP ' + context.status + ').'
  }

  message = error?.message
  return typeof message === 'string' && message.trim() ? message : fallback
}

export async function requestAssistantPlan({ message, history, pendingAction, attachmentName }) {
  const { data, error } = await getClient().functions.invoke('chat-assistant', {
    body: { mode: 'plan', message, history, pendingAction: pendingAction || null, attachmentName: attachmentName || '' }
  })
  if (error) throw new Error(await getErrorMessage(error, 'Gagal menghubungi asisten chat.'))
  return validateAssistantPlan(data)
}

export async function summarizeAssistantAnswer(question, data) {
  const { data: result, error } = await getClient().functions.invoke('chat-assistant', {
    body: { mode: 'summarize', question, data }
  })
  if (error) throw new Error(await getErrorMessage(error, 'Gagal merangkum hasil data toko.'))
  if (typeof result?.answer !== 'string' || !result.answer.trim()) {
    throw new Error('Asisten tidak mengembalikan ringkasan yang valid.')
  }
  return result.answer
}
