import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidBackupChunkManifestEntry, isValidBackupChunkRows } from './backupFormat.js'

test('backup manifest accepts byte-split chunks with fewer than 100 rows', () => {
  assert.equal(isValidBackupChunkManifestEntry({ count: 203, chunks: 5 }), true)
  assert.equal(isValidBackupChunkManifestEntry({ count: 203, chunks: 3 }), true)
})

test('backup manifest requires chunks for nonempty tables only', () => {
  assert.equal(isValidBackupChunkManifestEntry({ count: 0, chunks: 0 }), true)
  assert.equal(isValidBackupChunkManifestEntry({ count: 1, chunks: 0 }), false)
  assert.equal(isValidBackupChunkManifestEntry({ count: 0, chunks: 1 }), false)
  assert.equal(isValidBackupChunkManifestEntry({ count: 10, chunks: 11 }), false)
  assert.equal(isValidBackupChunkManifestEntry({ count: 1.5, chunks: 1 }), false)
})

test('each backup chunk can contain any nonempty row count up to 100', () => {
  assert.equal(isValidBackupChunkRows([{ id: 1 }]), true)
  assert.equal(isValidBackupChunkRows(Array.from({ length: 100 }, (_, id) => ({ id }))), true)
  assert.equal(isValidBackupChunkRows([]), false)
  assert.equal(isValidBackupChunkRows(Array.from({ length: 101 }, (_, id) => ({ id }))), false)
})
