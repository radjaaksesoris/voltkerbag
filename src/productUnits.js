export const STANDARD_UNITS = [
  { name: 'pcs', factor: 1 },
  { name: 'lusin', factor: 12 }
]

function normalizedUnit(unit) {
  return String(unit || '').trim().toLocaleLowerCase('id-ID')
}

export function unitFactor(unit) {
  if (normalizedUnit(unit) === 'kodi') return 20
  return STANDARD_UNITS.find((option) => option.name === normalizedUnit(unit))?.factor || 1
}

export function saleUnits(baseUnit) {
  const normalized = normalizedUnit(baseUnit)
  if (normalized === 'kodi') return STANDARD_UNITS.map((option) => option.name)
  return STANDARD_UNITS.some((option) => option.name === normalized)
    ? STANDARD_UNITS.map((option) => option.name)
    : [String(baseUnit || 'pcs').trim()]
}

export function purchaseCostUnit(unit) {
  const units = saleUnits(unit)
  return units.includes('pcs') && units.includes('lusin')
    ? 'lusin'
    : String(unit || 'pcs').trim()
}

export function purchaseCostFactor(unit) {
  return unitFactor(purchaseCostUnit(unit))
}

export function purchaseCostPerPiece(unit, cost) {
  return (Number(cost) || 0) / purchaseCostFactor(unit)
}

export function stockEntryUnit(unit) {
  return saleUnits(unit).length === 2
    ? 'lusin'
    : String(unit || 'pcs').trim()
}

export function stockInPcs(product) {
  if (product.stock_pcs != null) return Math.max(0, Number(product.stock_pcs) || 0)
  return Math.max(0, (Number(product.stock) || 0) * unitFactor(product.unit))
}

export function stockCostValue(product) {
  const storedValue = Number(product.stock_cost_value)
  if (product.stock_cost_value != null && Number.isFinite(storedValue)) {
    return Math.max(0, storedValue)
  }
  return (Number(product.cost) || 0) * stockInPcs(product)
}

export function stockReceiptValuation({ stockPcs, stockValue, receiptPcs, receiptUnitCost }) {
  const nextStockPcs = stockPcs + receiptPcs
  const nextStockValue = stockValue + receiptPcs * receiptUnitCost
  return {
    stockPcs: nextStockPcs,
    stockValue: nextStockValue,
    averageUnitCost: nextStockPcs > 0 ? nextStockValue / nextStockPcs : 0
  }
}

export function stockIssueValuation({ stockPcs, stockValue, issuePcs }) {
  const averageUnitCost = stockPcs > 0 ? stockValue / stockPcs : 0
  const issuedValue = Math.min(stockValue, averageUnitCost * issuePcs)
  return {
    stockPcs: Math.max(0, stockPcs - issuePcs),
    stockValue: Math.max(0, stockValue - issuedValue),
    issuedValue
  }
}

export function quantityToPcs(quantity, unit) {
  return Math.round((Number(quantity) || 0) * unitFactor(unit))
}

export function availableQuantity(product, unit) {
  return Math.floor(stockInPcs(product) / unitFactor(unit))
}

export function productPrice(product, unit) {
  const normalizedUnitName = normalizedUnit(unit)
  if (STANDARD_UNITS.some((option) => option.name === normalizedUnitName)) {
    const storedPrice = Number(product['price_' + normalizedUnitName])
    if (Number.isFinite(storedPrice) && storedPrice > 0) return storedPrice

    const legacyPrice = Number(product.price) || 0
    return Math.round(legacyPrice / unitFactor(product.unit))
  }
  return Number(product.price) || 0
}

export function saleUnitPrice(product, unit) {
  return productPrice(product, unit) * unitFactor(unit)
}

export function unitCost(product, unit) {
  return (Number(product.cost) || 0) * unitFactor(unit)
}

export function stockLabel(product) {
  const baseUnit = String(product.unit || 'pcs').trim()
  const quantity = stockInPcs(product)
  if (normalizedUnit(baseUnit) === 'kodi') return quantity + ' pcs'
  const factor = unitFactor(baseUnit)
  if (factor === 1 && normalizedUnit(baseUnit) !== 'pcs') return quantity + ' ' + baseUnit

  const fullUnits = Math.floor(quantity / factor)
  const remainingPcs = quantity % factor
  const parts = []
  if (fullUnits > 0) parts.push(fullUnits + ' ' + baseUnit)
  if (remainingPcs > 0) parts.push(remainingPcs + ' pcs')
  return parts.join(' ') || '0 ' + baseUnit
}
