import { openDB } from 'idb'

const DB_NAME = 'voltker-db'
const DB_VERSION = 1

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('products')) {
      db.createObjectStore('products', { keyPath: 'id', autoIncrement: true })
    }
    if (!db.objectStoreNames.contains('transactions')) {
      const tx = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
      tx.createIndex('createdAt', 'createdAt')
    }
    if (!db.objectStoreNames.contains('finance')) {
      db.createObjectStore('finance', { keyPath: 'id', autoIncrement: true })
    }
    if (!db.objectStoreNames.contains('tombstones')) {
      // catatan id yang dihapus, agar penghapusan ikut tersinkron ke Supabase
      db.createObjectStore('tombstones', { keyPath: 'key' })
    }
    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta', { keyPath: 'key' })
    }
  }
})

// ---- generic helpers ----
export async function getAll(store) {
  return (await dbPromise).getAll(store)
}
export async function getOne(store, id) {
  return (await dbPromise).get(store, id)
}
export async function put(store, value) {
  const now = new Date().toISOString()
  value.updatedAt = now
  if (!value.createdAt) value.createdAt = now
  const id = await (await dbPromise).put(store, value)
  notifyRefresh()
  return id
}
export async function bulkPut(store, values) {
  const db = await dbPromise
  const tx = db.transaction(store, 'readwrite')
  const now = new Date().toISOString()
  for (const v of values) {
    v.updatedAt = now
    if (!v.createdAt) v.createdAt = now
    await tx.store.put(v)
  }
  await tx.done
  notifyRefresh()
}
export async function remove(store, id) {
  const db = await dbPromise
  const key = store + ':' + id
  await db.put('tombstones', { key, store, id, deletedAt: new Date().toISOString() })
  await db.delete(store, id)
  notifyRefresh()
}
export async function getTombstones(store) {
  const all = await getAll('tombstones')
  return all.filter((t) => t.store === store)
}
export async function clearTombstones(store) {
  const db = await dbPromise
  const tombs = await getTombstones(store)
  const tx = db.transaction('tombstones', 'readwrite')
  for (const t of tombs) await tx.store.delete(t.key)
  await tx.done
}

// ---- meta (pengaturan lokal) ----
export async function getMeta(key, fallback = null) {
  const row = await (await dbPromise).get('meta', key)
  return row ? row.value : fallback
}
export async function setMeta(key, value) {
  await (await dbPromise).put('meta', { key, value })
  notifyRefresh()
}

// ---- refresh event agar semua halaman reaktif ----
export function notifyRefresh() {
  window.dispatchEvent(new CustomEvent('voltker:refresh'))
}
export function onRefresh(fn) {
  window.addEventListener('voltker:refresh', fn)
  return () => window.removeEventListener('voltker:refresh', fn)
}
