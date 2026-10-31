export const QUERY_INTENTS = new Set([
  'stock', 'products', 'inventory_summary', 'debts', 'debt_payments', 'cashbook', 'daily_summary', 'sales_summary', 'finance_summary',
  'transactions', 'purchases', 'customers', 'vendors', 'expeditions', 'categories',
  'units', 'product_performance'
])

export const ACTION_INTENTS = new Set([
  'add_stock', 'sale', 'credit_payment', 'manual_debt', 'transaction_payment', 'finance_entry', 'purchase',
  'add_product', 'edit_product', 'delete_product', 'edit_finance_entry', 'delete_finance_entry',
  'record_expedition_cost', 'add_customer', 'edit_customer', 'delete_customer',
  'add_vendor', 'edit_vendor', 'delete_vendor', 'add_expedition', 'edit_expedition', 'delete_expedition',
  'add_category', 'delete_category', 'add_unit', 'delete_unit', 'backup', 'restore_backup', 'reset_store'
])

function hasValue(value) {
  return value !== undefined && value !== null
    && !(typeof value === 'string' && value.trim() === '')
}

export function getMissingProductDetails(args = {}) {
  const missing = []
  const unit = String(args.unit || '').trim().toLocaleLowerCase('id-ID')
  const standardUnit = ['pcs', 'lusin'].includes(unit)
  if (!String(args.name || '').trim()) missing.push('nama produk')
  if (!unit) missing.push('satuan produk (pcs, lusin, atau satuan custom yang sudah tersedia)')
  if (!hasValue(args.stock_quantity)) {
    missing.push(standardUnit ? 'jumlah stok awal dalam lusin' : 'jumlah stok awal dan satuannya')
  }
  if (!hasValue(args.unit_cost)) {
    missing.push(standardUnit ? 'harga modal per lusin' : 'harga modal per satuan produk')
  }
  if (standardUnit) {
    for (const saleUnit of ['pcs', 'lusin']) {
      if (!hasValue(args['sale_price_' + saleUnit]) && !hasValue(args['sale_markup_' + saleUnit + '_pct'])) {
        missing.push('harga jual ' + saleUnit)
      }
    }
  } else if (!unit) {
    missing.push('harga jual (PCS dan lusin untuk satuan standar, atau per satuan custom)')
  } else if (unit && !hasValue(args.sale_price)) {
    missing.push('harga jual per ' + unit)
  }
  return missing
}

export function validateAssistantPlan(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || !['reply', 'query', 'action'].includes(data.kind)
    || typeof data.message !== 'string'
    || !data.args || typeof data.args !== 'object' || Array.isArray(data.args)) {
    throw new Error('Jawaban asisten tidak memiliki format yang didukung.')
  }
  if (data.kind === 'query' && !QUERY_INTENTS.has(data.query)) {
    throw new Error('Jenis pertanyaan belum didukung oleh asisten.')
  }
  if (data.kind === 'action' && !ACTION_INTENTS.has(data.action)) {
    throw new Error('Jenis tindakan belum didukung oleh asisten.')
  }
  return {
    kind: data.kind,
    message: data.message.slice(0, 4_000),
    query: data.kind === 'query' ? data.query : '',
    action: data.kind === 'action' ? data.action : '',
    args: data.args
  }
}
