export const QUERY_INTENTS = new Set([
  'stock', 'products', 'inventory_summary', 'debts', 'daily_summary', 'sales_summary', 'finance_summary',
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
