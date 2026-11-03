import { isLowStock, quantityToPcs, stockInPcs, stockLabel } from '../productUnits.js'
import { localDateValue } from '../dateFilter.js'

const DAY_MS = 24 * 60 * 60 * 1000
const PRODUCT_COLLATOR = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

function dayNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null
  const timestamp = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(timestamp) ? timestamp / DAY_MS : null
}

function productKey(productId, name) {
  if (productId != null && String(productId).trim()) return 'id:' + String(productId)
  const normalizedName = String(name || '').trim().toLocaleLowerCase('id-ID')
  return normalizedName ? 'name:' + normalizedName : ''
}

export function getPreviousDateRange(range) {
  const from = dayNumber(range?.from)
  const to = dayNumber(range?.to)
  if (from === null && to === null) return null
  const end = to ?? from
  const start = from ?? end
  if (start > end) return null
  const duration = end - start + 1
  const previousTo = start - 1
  return {
    from: new Date((previousTo - duration + 1) * DAY_MS).toISOString().slice(0, 10),
    to: new Date(previousTo * DAY_MS).toISOString().slice(0, 10)
  }
}

export function compareSalesPeriods(current, previous) {
  const currentSales = Math.max(0, Number(current?.total) || 0)
  const previousSales = Math.max(0, Number(previous?.total) || 0)
  const currentCount = Math.max(0, Number(current?.transaction_count) || 0)
  const previousCount = Math.max(0, Number(previous?.transaction_count) || 0)
  const percentageChange = previousSales > 0
    ? ((currentSales - previousSales) / previousSales) * 100
    : null
  const sufficientData = currentCount >= 3 && previousCount >= 3

  return {
    current_sales: currentSales,
    previous_sales: previousSales,
    current_transaction_count: currentCount,
    previous_transaction_count: previousCount,
    change_amount: currentSales - previousSales,
    change_percent: percentageChange === null ? null : Number(percentageChange.toFixed(1)),
    significant_change: sufficientData && percentageChange !== null && Math.abs(percentageChange) >= 50,
    sufficient_data: sufficientData
  }
}

export function recommendRestock(products, transactions, {
  from,
  to,
  coverageDays = 14
} = {}) {
  const startDay = dayNumber(from)
  const endDay = dayNumber(to)
  if (startDay === null || endDay === null || startDay > endDay) {
    return { data_sufficient: false, sample_days: 0, coverage_days: coverageDays, products: [] }
  }
  const sampleDays = endDay - startDay + 1
  const soldByName = new Map()
  let transactionIndex = 0
  for (const transaction of transactions || []) {
    const transactionId = transaction.id ?? transactionIndex
    transactionIndex += 1
    const transactionTime = new Date(transaction.createdAt || 0).getTime()
    if (!Number.isFinite(transactionTime)) continue
    const transactionDay = dayNumber(localDateValue(new Date(transactionTime)))
    if (transactionDay === null || transactionDay < startDay || transactionDay > endDay) continue
    for (const item of transaction.items || []) {
      const key = productKey(item.productId, item.name)
      if (!key) continue
      const soldPcs = quantityToPcs(item.qty, item.unit)
      const aggregate = soldByName.get(key) || { soldPcs: 0, transactionIds: new Set() }
      aggregate.soldPcs += soldPcs
      aggregate.transactionIds.add(transactionId)
      soldByName.set(key, aggregate)
    }
  }

  const recommendations = []
  let sufficientProducts = 0
  for (const product of products || []) {
    const sales = soldByName.get(productKey(product.id))
      || soldByName.get(productKey(null, product.name))
    if (!sales || sales.soldPcs <= 0 || sales.transactionIds.size < 3) continue
    sufficientProducts += 1
    const soldPcs = sales.soldPcs
    const averageDailySales = soldPcs / sampleDays
    const currentStock = stockInPcs(product)
    const daysUntilStockout = currentStock / averageDailySales
    if (daysUntilStockout > coverageDays) continue
    const suggestedAdditionalUnits = Math.max(0, Math.ceil(averageDailySales * coverageDays - currentStock))
    recommendations.push({
      name: product.name,
      stock: stockLabel(product),
      sold_stock_units: soldPcs,
      average_daily_stock_units: Number(averageDailySales.toFixed(2)),
      estimated_stock_days: Number(daysUntilStockout.toFixed(1)),
      suggested_additional_stock_units: suggestedAdditionalUnits,
      suggested_additional: stockLabel({ ...product, stock_pcs: suggestedAdditionalUnits })
    })
  }

  recommendations.sort((left, right) =>
    left.estimated_stock_days - right.estimated_stock_days
    || PRODUCT_COLLATOR.compare(left.name, right.name)
  )
  return {
    data_sufficient: sufficientProducts > 0,
    sample_days: sampleDays,
    coverage_days: coverageDays,
    insufficient_product_count: Math.max(0, (products || []).length - sufficientProducts),
    products: recommendations.slice(0, 10)
  }
}

export function rankLowStockSellers(products, transactions, range) {
  const startDay = dayNumber(range?.from)
  const endDay = dayNumber(range?.to)
  const lowStock = (products || []).filter(isLowStock)
  const salesByName = new Map()

  for (const transaction of transactions || []) {
    const timestamp = new Date(transaction.createdAt || 0).getTime()
    if (!Number.isFinite(timestamp)) continue
    const transactionDay = dayNumber(localDateValue(new Date(timestamp)))
    if (startDay !== null && transactionDay < startDay) continue
    if (endDay !== null && transactionDay > endDay) continue
    for (const item of transaction.items || []) {
      const key = productKey(item.productId, item.name)
      if (!key) continue
      const aggregate = salesByName.get(key) || { quantity_stock_units: 0, sales: 0 }
      aggregate.quantity_stock_units += quantityToPcs(item.qty, item.unit)
      aggregate.sales += (Number(item.price) || 0) * (Number(item.qty) || 0)
      salesByName.set(key, aggregate)
    }
  }

  const matchingProducts = lowStock.map((product) => {
    const sales = salesByName.get(productKey(product.id))
      || salesByName.get(productKey(null, product.name))
    return sales
      ? {
          name: product.name,
          stock: stockLabel(product),
          quantity_label: stockLabel({ ...product, stock_pcs: sales.quantity_stock_units }),
          ...sales
        }
      : null
  }).filter(Boolean).sort((left, right) =>
    right.sales - left.sales || PRODUCT_COLLATOR.compare(left.name, right.name)
  )

  return {
    date_range: range,
    low_stock_count: lowStock.length,
    matched_count: matchingProducts.length,
    products: matchingProducts.slice(0, 10)
  }
}
