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

export function getConfig() {
  return {
    url: localStorage.getItem('voltker_sb_url') || '',
    key: localStorage.getItem('voltker_sb_key') || ''
  }
}

export function saveConfig(url, key) {
  localStorage.setItem('voltker_sb_url', url.trim())
  localStorage.setItem('voltker_sb_key', key.trim())
}

export function isConfigured() {
  const { url, key } = getConfig()
  return Boolean(url && key)
}

export async function getLastSync() {
  return await getMeta('lastSync', null)
}

export async function syncAll(onProgress) {
  const { url, key } = getConfig()
  if (!url || !key) throw new Error('Supabase belum dikonfigurasi. Klik ikon gerigi dulu.')
  const sb = createClient(url, key)
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
