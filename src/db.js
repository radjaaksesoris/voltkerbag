import { getClient } from './supabaseSync'

const TABLES = {
  products: 'products',
  categories: 'product_categories',
  units: 'product_units',
  customers: 'customer_names',
  transactions: 'transactions',
  finance: 'finance_entries'
}

function tableFor(store) {
  const table = TABLES[store]
  if (!table) throw new Error('Jenis data tidak dikenal: ' + store)
  return table
}

function throwIfError(error, context) {
  if (error) throw new Error(context + ': ' + error.message)
}

export async function getAll(store) {
  const table = tableFor(store)
  const client = getClient()
  const rows = []
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select('*').order('id').range(from, from + pageSize - 1)
    throwIfError(error, 'Gagal memuat ' + table)
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function getDashboardData({ from, to, summaryFrom, summaryTo, page, pageSize, creditFirst }) {
  const { data, error } = await getClient().rpc('get_dashboard_data', {
    p_from: from,
    p_to: to,
    p_summary_from: summaryFrom,
    p_summary_to: summaryTo,
    p_page: page,
    p_page_size: pageSize,
    p_credit_first: creditFirst
  })
  throwIfError(error, 'Gagal memuat ringkasan dashboard')
  return data
}

export async function getFinanceData({ from, to, page, pageSize }) {
  const { data, error } = await getClient().rpc('get_finance_data', {
    p_from: from,
    p_to: to,
    p_page: page,
    p_page_size: pageSize
  })
  throwIfError(error, 'Gagal memuat ringkasan keuangan')
  return data
}

export async function getTransactionSummary({ from, to }) {
  const { data, error } = await getClient().rpc('get_transaction_summary', {
    p_from: from,
    p_to: to
  })
  throwIfError(error, 'Gagal memuat ringkasan transaksi')
  return data
}

export async function getOne(store, id) {
  const { data, error } = await getClient().from(tableFor(store)).select('*').eq('id', id).maybeSingle()
  throwIfError(error, 'Gagal memuat data')
  return data
}

export async function put(store, value) {
  const now = new Date().toISOString()
  const record = {
    ...value,
    updatedAt: now,
    createdAt: value.createdAt || now
  }
  if (record.id == null) delete record.id

  const query = getClient().from(tableFor(store))
  const { data, error } = record.id == null
    ? await query.insert(record).select('id').single()
    : await query.upsert(record, { onConflict: 'id' }).select('id').single()
  throwIfError(error, 'Gagal menyimpan data')
  notifyRefresh()
  return data.id
}

export async function updateProductDetails(id, value) {
  const { data, error } = await getClient()
    .from(tableFor('products'))
    .update({ ...value, updatedAt: new Date().toISOString() })
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error, 'Gagal memperbarui produk')
  notifyRefresh()
  return data.id
}

export async function completeSale(transaction, cart, requestId) {
  const { data, error } = await getClient().rpc('complete_sale', {
    p_customer_name: transaction.customerName,
    p_payment_type: transaction.paymentType,
    p_payment: transaction.payment,
    p_cart: cart.map((item) => ({ productId: item.productId, unit: item.unit, price: item.price, qty: item.qty })),
    p_request_id: requestId || crypto.randomUUID()
  })
  throwIfError(error, 'Gagal menyimpan transaksi')
  notifyRefresh()
  return data
}

export async function addProductStock(productId, quantityPcs, unitCost, requestId) {
  const { data, error } = await getClient().rpc('add_product_stock', {
    p_product_id: productId,
    p_quantity_pcs: quantityPcs,
    p_unit_cost: unitCost,
    p_request_id: requestId || crypto.randomUUID()
  })
  throwIfError(error, 'Gagal menambahkan stok produk')
  notifyRefresh()
  return data
}

export async function recordTransactionPayment(transactionId, amount, requestId) {
  const { data, error } = await getClient().rpc('record_transaction_payment', {
    p_transaction_id: transactionId,
    p_amount: amount,
    p_request_id: requestId || crypto.randomUUID()
  })
  throwIfError(error, 'Gagal menyimpan cicilan')
  notifyRefresh()
  return data
}

export async function uploadProductImage(file) {
  const allowedTypes = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }
  const extension = allowedTypes[file.type]
  if (!extension) throw new Error('Gunakan gambar JPG, PNG, atau WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 5 MB.')

  const client = getClient()
  const { data: { user }, error: userError } = await client.auth.getUser()
  throwIfError(userError, 'Gagal memeriksa akun untuk upload gambar')
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.')

  const path = user.id + '/' + crypto.randomUUID() + '.' + extension
  const { error } = await client.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  })
  throwIfError(error, 'Gagal mengunggah gambar produk')
  return path
}

export async function removeProductImage(path) {
  if (!path) return
  const { error } = await getClient().storage.from('product-images').remove([path])
  throwIfError(error, 'Gagal menghapus gambar produk')
}

export function getProductImageUrl(path) {
  if (!path) return ''
  const { data } = getClient().storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function remove(store, id) {
  if (store === 'categories' || store === 'units') {
    const rpc = store === 'categories' ? 'delete_product_category' : 'delete_product_unit'
    const { error } = await getClient().rpc(rpc, {
      [store === 'categories' ? 'p_category_id' : 'p_unit_id']: id
    })
    throwIfError(error, 'Gagal menghapus ' + (store === 'categories' ? 'kategori' : 'satuan'))
    notifyRefresh()
    return
  }
  if (store === 'finance') {
    const { error } = await getClient().rpc('delete_manual_finance_entry', {
      p_entry_id: id
    })
    throwIfError(error, 'Gagal menghapus catatan keuangan')
    notifyRefresh()
    return
  }
  const { error } = await getClient().from(tableFor(store)).delete().eq('id', id)
  throwIfError(error, 'Gagal menghapus data')
  notifyRefresh()
}

export function notifyRefresh() {
  window.dispatchEvent(new CustomEvent('voltker:refresh'))
}

export function onRefresh(fn) {
  window.addEventListener('voltker:refresh', fn)
  return () => window.removeEventListener('voltker:refresh', fn)
}
