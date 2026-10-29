import { getClient } from './supabaseSync'
import {
  createBackupChunks,
  isValidBackupChunkManifestEntry,
  isValidBackupChunkRows
} from './backupFormat'

const TABLES = {
  products: 'products',
  categories: 'product_categories',
  units: 'product_units',
  customers: 'customer_names',
  vendors: 'vendor_names',
  expeditions: 'expedition_names',
  transactions: 'transactions',
  finance: 'finance_entries'
}

const BACKUP_TABLES = {
  products: 'products',
  categories: 'product_categories',
  units: 'product_units',
  customers: 'customer_names',
  vendors: 'vendor_names',
  expeditions: 'expedition_names',
  transactions: 'transactions',
  transactionPayments: 'transaction_payments',
  manualCreditPayments: 'manual_customer_credit_payments',
  finance: 'finance_entries',
  manualCredits: 'manual_customer_credits',
  stockAdjustments: 'product_stock_adjustments'
}
const BACKUP_CHUNK_MAX_BYTES = 180 * 1024
const MASTER_DATA_CACHE_TTL_MS = 30_000
const masterDataCache = new Map()
let masterDataCacheGeneration = 0
let refreshCacheInvalidationInstalled = false

function invalidateMasterDataCache() {
  masterDataCacheGeneration += 1
  masterDataCache.clear()
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
  const { data: { session }, error: sessionError } = await client.auth.getSession()
  throwIfError(sessionError, 'Gagal memeriksa sesi saat memuat ' + table)
  const cacheKey = (session?.user?.id || 'anonymous') + ':' + store
  const cached = masterDataCache.get(cacheKey)
  if (cached && (cached.pending || cached.expiresAt > Date.now())) return cached.promise

  const rows = []
  const pageSize = 1000
  let lastId = 0
  const cacheGeneration = masterDataCacheGeneration

  const promise = (async () => {
    for (;;) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .gt('id', lastId)
        .order('id')
        .limit(pageSize)
      throwIfError(error, 'Gagal memuat ' + table)
      rows.push(...(data || []))
      if (!data || data.length < pageSize) return rows
      lastId = data[data.length - 1].id
    }
  })()

  const cacheEntry = { expiresAt: Date.now() + MASTER_DATA_CACHE_TTL_MS, pending: true, promise }
  masterDataCache.set(cacheKey, cacheEntry)
  try {
    const result = await promise
    if (cacheGeneration !== masterDataCacheGeneration) return getAll(store)
    cacheEntry.pending = false
    cacheEntry.expiresAt = Date.now() + MASTER_DATA_CACHE_TTL_MS
    return result
  } catch (error) {
    if (masterDataCache.get(cacheKey)?.promise === promise) masterDataCache.delete(cacheKey)
    throw error
  }
}

export async function createBackupArchive() {
  const client = getClient()
  const { data: { user }, error: userError } = await client.auth.getUser()
  throwIfError(userError, 'Gagal memeriksa akun untuk backup')
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.')

  const { data: startRevision, error: startRevisionError } = await client.rpc('get_store_backup_revision')
  if (startRevisionError?.code === 'PGRST202') {
    throw new Error('Pembaruan skema backup belum diterapkan. Jalankan supabase/schema.sql di Supabase sebelum membuat backup.')
  }
  throwIfError(startRevisionError, 'Gagal memeriksa konsistensi data backup')

  const { default: JSZip } = await import('jszip')
  const archive = new JSZip()
  const recordManifest = {}
  const imagePaths = new Set()
  let recordCount = 0
  for (const [key, table] of Object.entries(BACKUP_TABLES)) {
    let lastId = 0
    let chunkIndex = 0
    let tableCount = 0
    const pageSize = 100

    for (;;) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .gt('id', lastId)
        .order('id')
        .limit(pageSize)
      throwIfError(error, 'Gagal membuat backup tabel ' + table)
      if (!data?.length) break
      if (key === 'products') {
        for (const product of data) {
          if (product.image_path) imagePaths.add(product.image_path)
        }
      }
      let chunks
      try {
        chunks = createBackupChunks(data, BACKUP_CHUNK_MAX_BYTES)
      } catch (error) {
        throw new Error('Gagal membagi backup tabel ' + table + ': ' + error.message)
      }
      for (const rows of chunks) {
        archive.file('records/' + key + '/' + chunkIndex + '.json', JSON.stringify(rows))
        chunkIndex += 1
      }
      tableCount += data.length
      recordCount += data.length
      lastId = data[data.length - 1].id
      if (data.length < pageSize) break
    }
    recordManifest[key] = { count: tableCount, chunks: chunkIndex }
  }

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

  const { data: endRevision, error: endRevisionError } = await client.rpc('get_store_backup_revision')
  throwIfError(endRevisionError, 'Gagal memeriksa konsistensi data backup')
  if (String(startRevision) !== String(endRevision)) {
    throw new Error('Data toko berubah selama backup berlangsung. Tidak ada backup yang disimpan; silakan ulangi saat aktivitas data lebih tenang.')
  }

  archive.file('data.json', JSON.stringify({
    format: 'voltker-backup',
    version: 2,
    generatedAt: new Date().toISOString(),
    ownerId: user.id,
    records: recordManifest,
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
  return { path, size: blob.size, recordCount }
}

async function restoreChunkedBackupArchive({ client, user, archive, backup, onProgress }) {
  const requiredKeys = Object.keys(BACKUP_TABLES)
  if (!backup.records || requiredKeys.some((key) => {
    return !isValidBackupChunkManifestEntry(backup.records[key])
  }) || Object.keys(backup.records).length !== requiredKeys.length) {
    throw new Error('Manifest backup bertahap tidak lengkap atau tidak valid.')
  }
  if (!Array.isArray(backup.images)) throw new Error('Daftar foto pada file backup tidak valid.')

  const imageEntries = new Map()
  for (const image of backup.images) {
    if (!image || typeof image.storagePath !== 'string' || typeof image.archivePath !== 'string'
      || !image.storagePath.startsWith(user.id + '/')
      || image.storagePath.split('/').length !== 2
      || image.archivePath !== 'images/' + image.storagePath) {
      throw new Error('Daftar lokasi foto dalam file backup tidak valid.')
    }
    if (imageEntries.has(image.storagePath)) throw new Error('File backup memiliki entri foto ganda.')
    const imageFile = archive.file(image.archivePath)
    if (!imageFile) throw new Error('Foto produk tidak ditemukan dalam file backup: ' + image.storagePath)
    imageEntries.set(image.storagePath, imageFile)
  }

  const oldImagePaths = []
  let lastProductId = 0
  for (;;) {
    const { data, error } = await client
      .from('products')
      .select('id, image_path')
      .gt('id', lastProductId)
      .order('id')
      .limit(500)
    throwIfError(error, 'Gagal memeriksa gambar produk saat ini')
    if (!data?.length) break
    oldImagePaths.push(...data.map((product) => product.image_path).filter(Boolean))
    lastProductId = data[data.length - 1].id
    if (data.length < 500) break
  }

  const restoreId = crypto.randomUUID()
  const uploadedPaths = []
  const restoredImagePaths = new Map()
  let restoreSessionId = null
  let committed = false
  let commitAttempted = false
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

    onProgress('Menyiapkan pemulihan data...')
    const { data: sessionId, error: beginError } = await client.rpc('begin_store_backup_restore', {
      p_expected: backup.records
    })
    throwIfError(beginError, 'Gagal memulai pemulihan bertahap')
    if (typeof sessionId !== 'string') throw new Error('Server tidak mengembalikan sesi pemulihan yang valid.')
    restoreSessionId = sessionId

    let productImagePaths = new Set()
    let totalChunks = Object.values(backup.records).reduce((sum, entry) => sum + entry.chunks, 0)
    let completedChunks = 0
    for (const key of requiredKeys) {
      const { chunks } = backup.records[key]
      for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex += 1) {
        onProgress('Memulihkan ' + key + ' (' + (++completedChunks) + ' dari ' + totalChunks + ')...')
        const chunkFile = archive.file('records/' + key + '/' + chunkIndex + '.json')
        if (!chunkFile) throw new Error('Bagian backup tidak ditemukan: ' + key + '/' + chunkIndex)
        let chunkBytes
        try {
          chunkBytes = await chunkFile.async('uint8array')
        } catch {
          throw new Error('Bagian backup tidak dapat dibaca: ' + key + '/' + chunkIndex)
        }
        if (chunkBytes.byteLength > BACKUP_CHUNK_MAX_BYTES) {
          throw new Error('Bagian backup terlalu besar: ' + key + '/' + chunkIndex)
        }
        let rows
        try {
          rows = JSON.parse(new TextDecoder().decode(chunkBytes))
        } catch {
          throw new Error('Bagian backup tidak dapat dibaca: ' + key + '/' + chunkIndex)
        }
        if (!isValidBackupChunkRows(rows)) {
          throw new Error('Jumlah data pada bagian backup tidak valid: ' + key + '/' + chunkIndex)
        }
        if (key === 'products') {
          rows = rows.map((product) => {
            const originalPath = product.image_path
            if (!originalPath) return { ...product, image_path: null }
            productImagePaths.add(originalPath)
            const restoredPath = restoredImagePaths.get(originalPath)
            if (!restoredPath) throw new Error('Foto produk tidak ada di manifest: ' + originalPath)
            return { ...product, image_path: restoredPath }
          })
        }
        const { error } = await client.rpc('stage_store_backup_restore_chunk', {
          p_restore_id: sessionId,
          p_table_key: key,
          p_chunk_index: chunkIndex,
          p_records: rows
        })
        throwIfError(error, 'Gagal mengunggah bagian pemulihan ' + key)
      }
    }

    if (productImagePaths.size !== imageEntries.size
      || [...productImagePaths].some((path) => !imageEntries.has(path))) {
      throw new Error('Daftar foto produk tidak cocok dengan manifest backup.')
    }

    onProgress('Menerapkan data toko...')
    commitAttempted = true
    const { error: commitError } = await client.rpc('commit_store_backup_restore', {
      p_restore_id: sessionId
    })
    throwIfError(commitError, 'Gagal menerapkan data backup')
    committed = true
  } catch (error) {
    if (restoreSessionId) {
      const { error: abortError } = await client.rpc('abort_store_backup_restore', {
        p_restore_id: restoreSessionId
      })
      if (abortError) {
        throw new Error(error.message + ' Data sementara pemulihan gagal dibersihkan: ' + abortError.message)
      }
    }
    if (uploadedPaths.length && !commitAttempted) {
      const { error: cleanupError } = await client.storage.from('product-images').remove(uploadedPaths)
      if (cleanupError) {
        throw new Error(error.message + ' Foto sementara gagal dibersihkan: ' + cleanupError.message)
      }
    }
    if (uploadedPaths.length && commitAttempted) {
      throw new Error(error.message + ' Status penerapan mungkin sudah berhasil; foto sementara dipertahankan agar gambar tidak terputus. Periksa data toko sebelum menghapusnya.')
    }
    throw error
  }

  if (!committed) throw new Error('Pemulihan data tidak berhasil diselesaikan.')
  const restoredImagePathSet = new Set(restoredImagePaths.values())
  const obsoleteImagePaths = oldImagePaths.filter((path) => !restoredImagePathSet.has(path))
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
    recordCount: Object.values(backup.records).reduce((count, entry) => count + entry.count, 0),
    imageCount: restoredImagePaths.size,
    warning
  }
}

export async function restoreBackupArchive(file, onProgress = () => {}) {
  if (!file || !/\.zip$/i.test(file.name)) throw new Error('Pilih file backup dengan format ZIP.')

  const client = getClient()
  const { data: { user }, error: userError } = await client.auth.getUser()
  throwIfError(userError, 'Gagal memeriksa akun untuk restore')
  if (!user) throw new Error('Sesi login tidak ditemukan. Silakan masuk kembali.')

  onProgress('Membaca file backup...')
  const { default: JSZip } = await import('jszip')
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
  if (backup.format !== 'voltker-backup' || ![1, 2].includes(backup.version)) {
    throw new Error('Format atau versi file backup tidak didukung.')
  }
  if (backup.ownerId !== user.id) {
    throw new Error('File backup hanya dapat dipulihkan ke akun toko yang membuatnya.')
  }
  if (backup.version === 2) {
    const result = await restoreChunkedBackupArchive({ client, user, archive, backup, onProgress })
    return result
  }

  const requiredRecordKeys = ['products', 'categories', 'units', 'customers', 'transactions', 'finance', 'stockAdjustments']
  if (!backup.records || requiredRecordKeys.some((key) => !Array.isArray(backup.records[key]))
    || (backup.records.transactionPayments !== undefined && !Array.isArray(backup.records.transactionPayments))
    || (backup.records.manualCreditPayments !== undefined && !Array.isArray(backup.records.manualCreditPayments))
    || (backup.records.manualCredits != null && !Array.isArray(backup.records.manualCredits))
    || (backup.records.vendors != null && !Array.isArray(backup.records.vendors))
    || (backup.records.expeditions != null && !Array.isArray(backup.records.expeditions))) {
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
      vendors: backup.records.vendors || [],
      expeditions: backup.records.expeditions || [],
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

export async function getDashboardData({ from, to, summaryFrom, summaryTo, page, pageSize, creditFirst, nameSort }) {
  const { data, error } = await getClient().rpc('get_dashboard_data', {
    p_from: from,
    p_to: to,
    p_summary_from: summaryFrom,
    p_summary_to: summaryTo,
    p_page: page,
    p_page_size: pageSize,
    p_credit_first: creditFirst,
    p_name_sort: nameSort
  })
  throwIfError(error, 'Gagal memuat ringkasan dashboard')
  return data
}

export async function getFinanceData({ from, to, page, pageSize }) {
  const client = getClient()
  const { data, error } = await client.rpc('get_finance_data', {
    p_from: from,
    p_to: to,
    p_page: page,
    p_page_size: pageSize
  })
  throwIfError(error, 'Gagal memuat ringkasan keuangan')

  const expeditionEntries = (data?.entries || []).filter((entry) =>
    entry.refId != null
    && String(entry.category || '').trim().toLocaleLowerCase('id-ID') === 'biaya ekspedisi'
  )
  if (expeditionEntries.length) {
    const transactionIds = [...new Set(expeditionEntries.map((entry) => entry.refId))]
    const { data: transactions, error: transactionError } = await client
      .from(tableFor('transactions'))
      .select('id, expedition, customerName')
      .in('id', transactionIds)
    throwIfError(transactionError, 'Gagal memuat detail ekspedisi untuk Buku Kas')

    const transactionById = new Map((transactions || []).map((transaction) => [String(transaction.id), transaction]))
    const expeditionEntryIds = new Set(expeditionEntries.map((entry) => entry.id))
    data.entries = data.entries.map((entry) => {
      if (!expeditionEntryIds.has(entry.id)) return entry
      const transaction = transactionById.get(String(entry.refId))
      const expedition = String(transaction?.expedition || '').trim()
      if (!expedition) return entry
      const customerName = String(transaction.customerName || '').trim() || 'Pelanggan'
      return {
        ...entry,
        category: 'Biaya Ekspedisi ' + expedition + ' (' + customerName + ')'
      }
    })
  }

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

export async function getTransactionPayments(transactionId) {
  const { data, error } = await getClient()
    .from('transaction_payments')
    .select('id, amount, date')
    .eq('transaction_id', transactionId)
    .order('date', { ascending: true })
    .order('id', { ascending: true })
  throwIfError(error, 'Gagal memuat riwayat pembayaran transaksi')
  return data || []
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
    p_expedition: transaction.expedition || '',
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

export async function setProductStock(productId, stockPcs) {
  const { data, error } = await getClient().rpc('set_product_stock', {
    p_product_id: productId,
    p_stock_pcs: stockPcs
  })
  throwIfError(error, 'Gagal memperbarui stok produk')
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

export async function recordExpeditionCost(entryId, amount) {
  const { data, error } = await getClient().rpc('record_expedition_cost', {
    p_entry_id: entryId,
    p_amount: amount
  })
  throwIfError(error, 'Gagal menyimpan biaya ekspedisi')
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

export function getProductThumbnailUrl(path) {
  if (!path) return ''
  const { data } = getClient().storage.from('product-images').getPublicUrl(path, {
    transform: { width: 320, height: 320, resize: 'contain', quality: 72 }
  })
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
  invalidateMasterDataCache()
  window.dispatchEvent(new CustomEvent('voltker:refresh'))
}

export function requestPageRefresh(pageId) {
  window.dispatchEvent(new CustomEvent('voltker:refresh', { detail: { pageId } }))
}

export function onRefresh(fn, pageId) {
  if (!refreshCacheInvalidationInstalled) {
    window.addEventListener('voltker:refresh', invalidateMasterDataCache)
    refreshCacheInvalidationInstalled = true
  }
  function handleRefresh(event) {
    if (event.detail?.pageId && event.detail.pageId !== pageId) return
    fn()
  }
  window.addEventListener('voltker:refresh', handleRefresh)
  return () => window.removeEventListener('voltker:refresh', handleRefresh)
}
