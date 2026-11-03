import { isLowStock, stockInPcs, stockLabel } from '../productUnits.js'

export function createOperationalInsights({ dateRange, summary, products, watchedProducts = [] }) {
  const lowStockProducts = products
    .filter(isLowStock)
    .sort((left, right) => stockInPcs(left) - stockInPcs(right))
  const watched = watchedProducts.map((name) => {
    const product = products.find((candidate) =>
      candidate.name.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID')
    )
    return product
      ? { name: product.name, stock: stockLabel(product), low_stock: isLowStock(product) }
      : { name, not_found: true }
  })

  const recommendations = []
  if (lowStockProducts.length) {
    recommendations.push(
      'Periksa stok menipis: ' + lowStockProducts.slice(0, 5)
        .map((product) => product.name + ' (' + stockLabel(product) + ')')
        .join(', ') +
        (lowStockProducts.length > 5 ? ', dan ' + (lowStockProducts.length - 5) + ' produk lain.' : '.')
    )
  }
  if (Number(summary.pending_expedition_count) > 0) {
    recommendations.push(
      'Lengkapi nominal aktual untuk ' + summary.pending_expedition_count + ' biaya ekspedisi yang masih tertunda.'
    )
  }
  if (Number(summary.customer_debt) > 0) {
    recommendations.push('Tinjau saldo hutang pelanggan sebesar Rp ' + Number(summary.customer_debt).toLocaleString('id-ID') + '.')
  }
  const watchedLowStock = watched.filter((product) => product.low_stock)
  if (watchedLowStock.length) {
    recommendations.push('Prioritaskan produk pantauan yang menipis: ' +
      watchedLowStock.map((product) => product.name + ' (' + product.stock + ')').join(', ') + '.')
  }
  if (Number(summary.transaction_count) === 0) {
    recommendations.push('Belum ada transaksi pada periode ini; pastikan transaksi toko sudah tercatat.')
  }
  if (recommendations.length === 0) {
    recommendations.push('Tidak ada tindak lanjut prioritas yang terdeteksi dari data periode ini.')
  }

  return {
    date_range: dateRange,
    transaction_count: Number(summary.transaction_count) || 0,
    sales_total: Number(summary.sales_total) || 0,
    gross_profit: Number(summary.gross_profit) || 0,
    net_profit: Number(summary.net_profit) || 0,
    cash_balance: Number(summary.cash_balance) || 0,
    customer_debt: Number(summary.customer_debt) || 0,
    pending_expedition_count: Number(summary.pending_expedition_count) || 0,
    product_count: products.length,
    inventory_asset: Number(summary.inventory?.total_asset) || 0,
    low_stock_count: lowStockProducts.length,
    alerts: [
      ...(lowStockProducts.length
        ? [{
            type: 'low_stock',
            count: lowStockProducts.length,
            message: lowStockProducts.length + ' produk memiliki stok rendah.'
          }]
        : []),
      ...(Number(summary.pending_expedition_count) > 0
        ? [{
            type: 'pending_expedition',
            count: Number(summary.pending_expedition_count),
            message: Number(summary.pending_expedition_count) + ' biaya ekspedisi menunggu nominal aktual.'
          }]
        : [])
    ],
    low_stock_products: lowStockProducts.slice(0, 5).map((product) => ({
      name: product.name,
      stock: stockLabel(product)
    })),
    watched_products: watched,
    recommendations
  }
}
