const STOCK_TERMS = new Set(['stok', 'stoknya', 'stock', 'stocknya', 'persediaan'])
const STOCK_QUESTION_TERMS = new Set([
  'berapa', 'cek', 'lihat', 'cari', 'tampilkan', 'jumlah', 'ada', 'tersedia',
  'masih', 'sekarang', 'saat', 'ini', 'apakah', 'tolong', 'dong', 'produk',
  'barang', 'di', 'toko', 'yang', 'harga', 'harganya', 'hpp', 'modal',
  'pokok', 'per', 'pcs', 'lusin'
])
const STOCK_ACTION_TERMS = new Set([
  'tambah', 'tambahkan', 'menambah', 'masukkan', 'catat', 'kurangi', 'ubah',
  'setel', 'hapus', 'edit', 'perbarui', 'restok'
])
const PERFORMANCE_TERMS = new Set(['laku', 'laris', 'terjual', 'performa', 'penjualan'])

export function resolveFastQuery(message) {
  const words = String(message || '')
    .normalize('NFKC')
    .toLocaleLowerCase('id-ID')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.some((word) => STOCK_ACTION_TERMS.has(word) || PERFORMANCE_TERMS.has(word))) return null

  const asksStock = words.some((word) => STOCK_TERMS.has(word))
  const asksCost = words.includes('hpp') || words.includes('modal')
    || words.includes('pokok') && words.includes('harga')
  if (!asksStock && !asksCost) return null

  const product = words
    .filter((word) => !STOCK_TERMS.has(word) && !STOCK_QUESTION_TERMS.has(word))
    .join(' ')

  return {
    kind: 'query',
    query: 'stock',
    args: {
      ...(product ? { product } : {}),
      ...(asksCost ? { includeCost: true } : {})
    }
  }
}
