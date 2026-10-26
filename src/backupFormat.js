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
