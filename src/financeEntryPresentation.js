export function getFinanceEntryCustomerName(entry) {
  if (entry.type !== 'income') return ''

  let note = String(entry.note || '').trim()
  const batchIndex = note.lastIndexOf(' · batch=')
  if (batchIndex !== -1) note = note.slice(0, batchIndex)

  const prefixes = [
    'Penjualan · ',
    'Cicilan kredit pelanggan · ',
    'Pembayaran umum piutang pelanggan · ',
    'Pembayaran piutang lama · '
  ]
  const prefix = prefixes.find((value) => note.startsWith(value))
  if (prefix) return note.slice(prefix.length).trim()

  if (note.startsWith('Cicilan transaksi ')) {
    const separatorIndex = note.lastIndexOf(' · ')
    if (separatorIndex !== -1) return note.slice(separatorIndex + 3).trim()
  }
  return ''
}
