const INVENTORY_PURCHASE_MARKER = '\n\u001einventory-purchase:'

export function formatPurchaseNote(purchase, vendor) {
  const cleanPurchase = String(purchase || '').trim()
  const cleanVendor = String(vendor || '').trim()
  return cleanPurchase + (cleanVendor ? '\n' + cleanVendor : '')
}

export function formatInventoryPurchaseNote(purchase, vendor, inventory) {
  return formatPurchaseNote(purchase, vendor) +
    INVENTORY_PURCHASE_MARKER +
    JSON.stringify(inventory)
}

export function parsePurchaseNote(note) {
  const rawValue = String(note || '').trim()
  const markerIndex = rawValue.indexOf(INVENTORY_PURCHASE_MARKER)
  let stockPurchase
  let value = markerIndex >= 0
    ? rawValue.slice(0, markerIndex).trim()
    : rawValue

  if (markerIndex >= 0) {
    try {
      const parsed = JSON.parse(rawValue.slice(markerIndex + INVENTORY_PURCHASE_MARKER.length))
      if (
        Number.isSafeInteger(parsed?.productId) &&
        Number.isSafeInteger(parsed?.quantityPcs) &&
        parsed.quantityPcs > 0 &&
        Number.isFinite(parsed?.unitCostPerPiece) &&
        parsed.unitCostPerPiece >= 0 &&
        typeof parsed?.unit === 'string'
      ) {
        stockPurchase = parsed
      }
    } catch (error) {
      console.error('Gagal membaca detail stok pembelian:', error)
    }
  }

  if (!value) return { purchase: '-', vendor: '-' }

  if (value.includes('\n')) {
    const [purchase, ...vendorLines] = value.split('\n')
    return {
      purchase: purchase.trim() || '-',
      vendor: vendorLines.join('\n').trim() || '-',
      ...(stockPurchase ? { stockPurchase } : {})
    }
  }

  const parts = value.split(' · ')
  const material = parts.find((part) => part.startsWith('Bahan: '))
  const supplier = parts.find((part) => part.startsWith('Pemasok: '))
  return {
    purchase: material ? material.slice('Bahan: '.length) : value,
    vendor: supplier ? supplier.slice('Pemasok: '.length) : '-',
    ...(stockPurchase ? { stockPurchase } : {})
  }
}
