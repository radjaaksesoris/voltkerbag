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
export async function completeSale(transaction, cart, financeEntry) {
  const db = await dbPromise
  const tx = db.transaction(['transactions', 'products', 'finance'], 'readwrite')
  const now = new Date().toISOString()
  const productStore = tx.objectStore('products')
  const products = await Promise.all(cart.map(async (item) => ({
    item,
    product: await productStore.get(item.productId)
  })))

  for (const { item, product } of products) {
    if (!product) throw new Error('Produk "' + item.name + '" tidak ditemukan.')
    if (Number(product.stock) < item.qty) {
      throw new Error('Stok "' + item.name + '" tidak cukup untuk menyelesaikan transaksi.')
    }
  }

  const transactionStore = tx.objectStore('transactions')
  const savedTransaction = {
    ...transaction,
    updatedAt: now,
    createdAt: transaction.createdAt || now
  }
  const transactionId = await transactionStore.add(savedTransaction)
  const transactionWithInvoice = {
    ...savedTransaction,
    id: transactionId,
    invoiceNo: createInvoiceNumber(savedTransaction.createdAt, transactionId)
  }
  await transactionStore.put(transactionWithInvoice)

  for (const { item, product } of products) {
    await productStore.put({
      ...product,
      stock: Number(product.stock) - item.qty,
      updatedAt: now
    })
  }

  if (financeEntry) {
    await tx.objectStore('finance').add({
      ...financeEntry,
      refId: transactionId,
      updatedAt: now,
      createdAt: financeEntry.createdAt || now
    })
  }

  await tx.done
  notifyRefresh()
  return transactionId
}

function createInvoiceNumber(createdAt, id) {
  const date = new Date(createdAt)
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
  return 'INV-' + datePart + '-' + String(id).padStart(6, '0')
}
export async function recordTransactionPayment(transactionId, amount, financeEntry) {
  const db = await dbPromise
  const tx = db.transaction(['transactions', 'finance'], 'readwrite')
  const now = new Date().toISOString()
  const transactionStore = tx.objectStore('transactions')
  const transaction = await transactionStore.get(transactionId)
  if (!transaction) throw new Error('Transaksi tidak ditemukan.')
  if (transaction.paymentType !== 'credit') throw new Error('Cicilan hanya dapat dicatat untuk transaksi kredit.')

  const total = Number(transaction.total) || 0
  const paidAmount = transaction.paidAmount != null
    ? Number(transaction.paidAmount)
    : Math.min(total, Number(transaction.payment) || 0)
  const balanceDue = transaction.balanceDue != null
    ? Number(transaction.balanceDue)
    : Math.max(0, total - paidAmount)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Nominal cicilan harus lebih dari Rp0.')
  if (amount > balanceDue) throw new Error('Nominal cicilan melebihi sisa utang ' + balanceDue + '.')

  const savedTransaction = {
    ...transaction,
    paidAmount: paidAmount + amount,
    balanceDue: Math.max(0, total - paidAmount - amount),
    payments: [...(transaction.payments || []), { amount, date: now }],
    updatedAt: now,
    createdAt: transaction.createdAt || now
  }
  const savedFinanceEntry = {
    ...financeEntry,
    refId: transactionId,
    updatedAt: now,
    createdAt: financeEntry.createdAt || now
  }
  await Promise.all([
    transactionStore.put(savedTransaction),
    tx.objectStore('finance').put(savedFinanceEntry)
  ])
  await tx.done
  notifyRefresh()
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
