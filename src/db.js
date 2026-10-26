import { getClient } from './supabaseSync'
import JSZip from 'jszip'

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

export async function createBackupArchive() {
  const client = getClient()
  const { data: { user }, error: userError } = await client.auth.getUser()
  throwIfError(userError, 'Gagal memeriksa akun untuk backup')
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.')

  const tables = {
    products: 'products',
    categories: 'product_categories',
    units: 'product_units',
    customers: 'customer_names',
    transactions: 'transactions',
    finance: 'finance_entries',
    manualCredits: 'manual_customer_credits',
    stockAdjustments: 'product_stock_adjustments'
  }
  const records = {}
  for (const [key, table] of Object.entries(tables)) {
    const rows = []
    const pageSize = 1000
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client.from(table).select('*').order('id').range(from, from + pageSize - 1)
      throwIfError(error, 'Gagal membuat backup tabel ' + table)
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
    records[key] = rows
  }

  const archive = new JSZip()
  const imagePaths = [...new Set(records.products.map((product) => product.image_path).filter(Boolean))]
  const images = []
  for (const path of imagePaths) {
    if (!path.startsWith(user.id + '/')) {
      throw new Error('Backup dihentikan karena gambar produk tidak sesuai dengan akun toko.')
    }
    const { data, error } = await client.storage.from('product-images').download(path)
    throwIfError(error, 'Gagal mengambil gambar produk untuk backup')
    if (!data) throw new Error('Gambar produk tidak ditemukan saat membuat backup: ' + path)
    const archivePath = 'images/' + path
    archive.file(archivePath, data)
    images.push({ storagePath: path, archivePath })
  }

  archive.file('data.json', JSON.stringify({
    format: 'voltker-backup',
    version: 1,
    generatedAt: new Date().toISOString(),
    ownerId: user.id,
    records,
    images
  }, null, 2))

  const blob = await archive.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = user.id + '/backup-' + timestamp + '.zip'
  const { error: uploadError } = await client.storage.from('store-backups').upload(path, blob, {
    cacheControl: '3600',
    contentType: 'application/zip',
    upsert: false
  })
  throwIfError(uploadError, 'Gagal menyimpan backup ke Supabase Storage')
  return { path, size: blob.size, recordCount: Object.values(records).reduce((count, rows) => count + rows.length, 0) }
}

export async function restoreBackupArchive(file, onProgress = () => {}) {
  if (!file || !/\.zip$/i.test(file.name)) throw new Error('Pilih file backup dengan format ZIP.')

  const client = getClient()
  const { data: { user }, error: userError } = await client.auth.getUser()
  throwIfError(userError, 'Gagal memeriksa akun untuk restore')
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.')

  onProgress('Membaca file backup...')
  let archive
  try {
    archive = await JSZip.loadAsync(file)
  } catch {
    throw new Error('File ZIP tidak dapat dibaca atau rusak.')
  }
  const manifestFile = archive.file('data.json')
  if (!manifestFile) throw new Error('File backup tidak berisi data.json.')

  let backup
  try {
    backup = JSON.parse(await manifestFile.async('text'))
  } catch {
    throw new Error('Data backup tidak valid atau rusak.')
  }
  if (backup.format !== 'voltker-backup' || backup.version !== 1) {
    throw new Error('Format atau versi file backup tidak didukung.')
  }
  if (backup.ownerId !== user.id) {
    throw new Error('File backup hanya dapat dipulihkan ke akun toko yang membuatnya.')
  }

  const requiredRecordKeys = ['products', 'categories', 'units', 'customers', 'transactions', 'finance', 'stockAdjustments']
  if (!backup.records || requiredRecordKeys.some((key) => !Array.isArray(backup.records[key]))
    || (backup.records.manualCredits != null && !Array.isArray(backup.records.manualCredits))) {
    throw new Error('Data pada file backup tidak lengkap.')
  }
  if (!Array.isArray(backup.images)) throw new Error('Daftar foto pada file backup tidak valid.')

  const expectedImages = [...new Set(backup.records.products.map((product) => product.image_path).filter(Boolean))]
  const imageEntries = new Map()
  for (const image of backup.images) {
    if (!image || typeof image.storagePath !== 'string' || typeof image.archivePath !== 'string') {
      throw new Error('Daftar foto pada file backup tidak valid.')
    }
    if (!image.storagePath.startsWith(user.id + '/') || image.storagePath.split('/').length !== 2
      || image.archivePath !== 'images/' + image.storagePath) {
      throw new Error('Lokasi foto dalam file backup tidak valid.')
    }
    if (imageEntries.has(image.storagePath)) throw new Error('File backup memiliki entri foto ganda.')
    const imageFile = archive.file(image.archivePath)
    if (!imageFile) throw new Error('Foto produk tidak ditemukan dalam file backup: ' + image.storagePath)
    imageEntries.set(image.storagePath, imageFile)
  }
  if (expectedImages.length !== imageEntries.size || expectedImages.some((path) => !imageEntries.has(path))) {
    throw new Error('Daftar foto produk tidak cocok dengan data backup.')
  }

  const { data: existingProducts, error: productsError } = await client
    .from('products')
    .select('image_path')
  throwIfError(productsError, 'Gagal memeriksa gambar produk saat ini')
  const oldImagePaths = [...new Set((existingProducts || []).map((product) => product.image_path).filter(Boolean))]
  const restoreId = crypto.randomUUID()
  const uploadedPaths = []
  const restoredImagePaths = new Map()

  try {
    for (const [index, [originalPath, imageFile]] of [...imageEntries.entries()].entries()) {
      onProgress('Mengunggah foto produk ' + (index + 1) + ' dari ' + imageEntries.size + '...')
      const extension = originalPath.split('.').pop().toLowerCase()
      const contentTypes = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
      const contentType = contentTypes[extension]
      if (!contentType) throw new Error('Format foto dalam backup tidak didukung: ' + originalPath)
      const imageBlob = await imageFile.async('blob')
      if (imageBlob.size === 0 || imageBlob.size > 5 * 1024 * 1024) {
        throw new Error('Ukuran foto dalam backup tidak valid: ' + originalPath)
      }

      const filename = originalPath.split('/').pop()
      const restoredPath = user.id + '/restore-' + restoreId + '/' + filename
      const { error } = await client.storage.from('product-images').upload(restoredPath, imageBlob, {
        cacheControl: '3600',
        contentType,
        upsert: false
      })
      throwIfError(error, 'Gagal mengunggah foto produk dari backup')
      uploadedPaths.push(restoredPath)
      restoredImagePaths.set(originalPath, restoredPath)
    }

    onProgress('Memulihkan data toko...')
    const records = {
      ...backup.records,
      manualCredits: backup.records.manualCredits || [],
      products: backup.records.products.map((product) => ({
        ...product,
        image_path: product.image_path ? restoredImagePaths.get(product.image_path) : null
      }))
    }
    const { error: restoreError } = await client.rpc('restore_store_backup', { p_records: records })
    throwIfError(restoreError, 'Gagal memulihkan data dari backup')
  } catch (error) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await client.storage.from('product-images').remove(uploadedPaths)
      if (cleanupError) {
        throw new Error(error.message + ' Foto sementara gagal dibersihkan: ' + cleanupError.message)
      }
    }
    throw error
  }

  const currentImagePaths = new Set(restoredImagePaths.values())
  const obsoleteImagePaths = oldImagePaths.filter((path) => !currentImagePaths.has(path))
  let warning = ''
  for (let index = 0; index < obsoleteImagePaths.length; index += 100) {
    const { error } = await client.storage.from('product-images').remove(obsoleteImagePaths.slice(index, index + 100))
    if (error) {
      warning = 'Data sudah dipulihkan, tetapi beberapa foto lama gagal dibersihkan: ' + error.message
      break
    }
  }

  notifyRefresh()
  return {
    recordCount: Object.values(backup.records).reduce((count, rows) => count + rows.length, 0),
    imageCount: restoredImagePaths.size,
    warning
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

export async function getPurchaseEntries(page, pageSize) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, count, error } = await getClient()
    .from(tableFor('finance'))
    .select('*', { count: 'exact' })
    .eq('type', 'expense')
    .eq('category', 'Pembelian bahan produksi')
    .order('date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, to)
  throwIfError(error, 'Gagal memuat riwayat pembelian bahan')
  return { entries: data || [], totalCount: count || 0 }
}

export async function getTransactionSummary({ from, to }) {
  const { data, error } = await getClient().rpc('get_transaction_summary', {
    p_from: from,
    p_to: to
  })
  throwIfError(error, 'Gagal memuat ringkasan transaksi')
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

export async function recordCustomerCreditPayment(customerName, amount, requestId) {
  const { data, error } = await getClient().rpc('record_customer_credit_payment', {
    p_customer_name: customerName,
    p_amount: amount,
    p_request_id: requestId || crypto.randomUUID()
  })
  throwIfError(error, 'Gagal menyimpan pembayaran hutang pelanggan')
  notifyRefresh()
  return data
}

export async function addManualCustomerCredit(customerName, amount, requestId) {
  const { data, error } = await getClient().rpc('add_manual_customer_credit', {
    p_customer_name: customerName,
    p_amount: amount,
    p_request_id: requestId || crypto.randomUUID()
  })
  throwIfError(error, 'Gagal menambahkan hutang pelanggan')
  notifyRefresh()
  return data
}

export async function resetStoreData() {
  const { error } = await getClient().rpc('reset_store_data')
  throwIfError(error, 'Gagal menghapus data toko')
  notifyRefresh()
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
