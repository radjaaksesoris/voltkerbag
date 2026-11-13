import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rylqzasdlxxxvygsqfvw.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const SESSION_HANDOFF_KEY = 'voltker:chat-session-handoff'

let client

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

export function getClient() {
  if (!isConfigured()) {
    throw new Error('Supabase belum dikonfigurasi. Tambahkan VITE_SUPABASE_ANON_KEY lalu build ulang aplikasi.')
  }

  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: true }
    })
  }
  return client
}

export async function getAuthSession() {
  if (!isConfigured()) return null
  const supabase = getClient()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error('Gagal memeriksa sesi: ' + sessionError.message)
  return session
}

export async function verifyAuthSession() {
  const session = await getAuthSession()
  if (!session) return null

  const supabase = getClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error?.status === 401) {
    await supabase.auth.signOut({ scope: 'local' })
    return null
  }
  if (error) throw new Error('Tidak dapat terhubung ke database server: ' + error.message)
  if (!user) return null
  return session
}

export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw new Error('Gagal masuk: ' + error.message)
  if (!data.session) throw new Error('Server tidak mengembalikan sesi login.')
  return data.session
}

export function handoffSession(session) {
  if (!session?.access_token || !session?.refresh_token) {
    throw new Error('Sesi login tidak lengkap untuk berpindah aplikasi.')
  }
  try {
    sessionStorage.setItem(SESSION_HANDOFF_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }))
  } catch (error) {
    throw new Error('Sesi login tidak dapat diteruskan ke aplikasi tujuan: ' + error.message)
  }
}

export async function restoreSessionHandoff() {
  let serializedSession
  try {
    serializedSession = sessionStorage.getItem(SESSION_HANDOFF_KEY)
    if (serializedSession === null) return null
    sessionStorage.removeItem(SESSION_HANDOFF_KEY)
  } catch (error) {
    throw new Error('Sesi login aplikasi tujuan tidak dapat dipulihkan: ' + error.message)
  }

  let tokens
  try {
    tokens = JSON.parse(serializedSession)
  } catch {
    throw new Error('Data sesi untuk membuka Chat tidak valid. Silakan masuk kembali.')
  }
  if (typeof tokens?.access_token !== 'string' || typeof tokens?.refresh_token !== 'string') {
    throw new Error('Data sesi aplikasi tujuan tidak lengkap. Silakan masuk kembali.')
  }

  const { data, error } = await getClient().auth.setSession(tokens)
  if (error) throw new Error('Sesi login tidak dapat dipulihkan di aplikasi tujuan: ' + error.message)
  if (!data.session) throw new Error('Server tidak mengembalikan sesi login aplikasi tujuan.')
  return data.session
}

export async function signOut() {
  const { error } = await getClient().auth.signOut()
  if (error) throw new Error('Gagal keluar: ' + error.message)
}

export function onAuthStateChange(callback) {
  const { data: { subscription } } = getClient().auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}
