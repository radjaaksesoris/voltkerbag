import { createClient } from '@supabase/supabase-js'
import {
  getAll, put, bulkPut, getTombstones, clearTombstones,
  getMeta, setMeta, notifyRefresh
} from './db'

const TABLES = [
  { store: 'products', table: 'products' },
  { store: 'transactions', table: 'transactions' },
  { store: 'finance', table: 'finance_entries' }
]

const SUPABASE_URL = 'https://rylqzasdlxxxvygsqfvw.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

let client

export function getConfig() {
  return { url: SUPABASE_URL, key: SUPABASE_ANON_KEY }
}

export function isConfigured() {
  const { url, key } = getConfig()
  return Boolean(url && key)
}

function getClient() {
  const { url, key } = getConfig()
  if (!key) throw new Error('Supabase belum dikonfigurasi. Tambahkan VITE_SUPABASE_ANON_KEY ke environment build.')

  if (!client) client = createClient(url, key)
  return client
}

export async function getAuthSession() {
  if (!isConfigured()) return null
  const { data, error } = await getClient().auth.getSession()
  if (error) throw new Error('Gagal memeriksa sesi Supabase: ' + error.message)
  return data.session
}

export async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw new Error('Gagal masuk: ' + error.message)
  return data.session
}

export async function signOut() {
  const { error } = await getClient().auth.signOut()
  if (error) throw new Error('Gagal keluar: ' + error.message)
}

export async function getLastSync() {
  return await getMeta('lastSync', null)
}

export async function syncAll(onProgress) {
  const sb = getClient()
  const { data: { session }, error: sessionError } = await sb.auth.getSession()
  if (sessionError) throw new Error('Gagal memeriksa sesi Supabase: ' + sessionError.message)
  if (!session) throw new Error('Silakan masuk ke akun Supabase melalui ikon gerigi sebelum menyinkronkan.')
  let pushed = 0, pulled = 0, deleted = 0

  for (const { store, table } of TABLES) {
    if (onProgress) onProgress('Mengirim ' + table + '...')
    const local = await getAll(store)

    // 1) PUSH: kirim semua data lokal ke Supabase (upsert = tambah jika baru, update jika ada)
    if (local.length > 0) {
      const { error } = await sb.from(table).upsert(local)
      if (error) throw new Error(table + ': ' + error.message)
      pushed += local.length
    }

    // 2) HAPUS di Supabase untuk data yang sudah dihapus lokal
    const tombs = await getTombstones(store)
    if (tombs.length > 0) {
      const ids = tombs.map((t) => t.id)
      const { error } = await sb.from(table).delete().in('id', ids)
      if (error) throw new Error(table + ': ' + error.message)
      await clearTombstones(store)
      deleted += ids.length
    }

    // 3) PULL: ambil data dari Supabase, gabungkan (data terbaru menang)
    if (onProgress) onProgress('Mengambil ' + table + '...')
    const { data, error } = await sb.from(table).select('*')
    if (error) throw new Error(table + ': ' + error.message)
    const byId = new Map(local.map((x) => [x.id, x]))
    const toPut = []
    for (const row of data || []) {
      const l = byId.get(row.id)
      if (!l) { toPut.push(row); pulled++ }
      else if (new Date(row.updatedAt) > new Date(l.updatedAt)) { toPut.push(row); pulled++ }
    }
    if (toPut.length > 0) await bulkPut(store, toPut)
  }

  await setMeta('lastSync', new Date().toISOString())
  notifyRefresh()
  return { pushed, pulled, deleted }
}
