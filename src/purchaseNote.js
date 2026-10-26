export function formatPurchaseNote(purchase, vendor) {
  const cleanPurchase = String(purchase || '').trim()
  const cleanVendor = String(vendor || '').trim()
  return cleanPurchase + (cleanVendor ? '\n' + cleanVendor : '')
}

export function parsePurchaseNote(note) {
  const value = String(note || '').trim()
  if (!value) return { purchase: '-', vendor: '-' }

  if (value.includes('\n')) {
    const [purchase, ...vendorLines] = value.split('\n')
    return {
      purchase: purchase.trim() || '-',
      vendor: vendorLines.join('\n').trim() || '-'
    }
  }

  const parts = value.split(' · ')
  const material = parts.find((part) => part.startsWith('Bahan: '))
  const supplier = parts.find((part) => part.startsWith('Pemasok: '))
  return {
    purchase: material ? material.slice('Bahan: '.length) : value,
    vendor: supplier ? supplier.slice('Pemasok: '.length) : '-'
  }
}
