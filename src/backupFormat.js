export function createBackupChunks(rows, maxBytes, maxRows = 100) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 2
    || !Number.isSafeInteger(maxRows) || maxRows < 1) {
    throw new Error('Batas ukuran bagian backup tidak valid.')
  }

  const chunks = []
  let chunk = []
  let chunkBytes = 2
  for (const row of rows) {
    const serialized = JSON.stringify(row)
    if (typeof serialized !== 'string') {
      throw new Error('Data tidak dapat diserialisasi untuk backup.')
    }
    const rowBytes = new TextEncoder().encode(serialized).byteLength
    if (rowBytes + 2 > maxBytes) {
      throw new Error('Satu baris terlalu besar untuk dibackup dengan aman.')
    }

    const separatorBytes = chunk.length ? 1 : 0
    if (chunk.length >= maxRows || chunkBytes + separatorBytes + rowBytes > maxBytes) {
      chunks.push(chunk)
      chunk = []
      chunkBytes = 2
    }

    chunk.push(row)
    chunkBytes += (chunk.length > 1 ? 1 : 0) + rowBytes
  }

  if (chunk.length) chunks.push(chunk)
  return chunks
}

export function isValidBackupChunkManifestEntry(entry) {
  return Boolean(entry)
    && Number.isSafeInteger(entry.count)
    && entry.count >= 0
    && Number.isSafeInteger(entry.chunks)
    && entry.chunks >= 0
    && entry.chunks <= entry.count
    && (entry.count === 0 ? entry.chunks === 0 : entry.chunks > 0)
}

export function isValidBackupChunkRows(rows) {
  return Array.isArray(rows) && rows.length >= 1 && rows.length <= 100
}
