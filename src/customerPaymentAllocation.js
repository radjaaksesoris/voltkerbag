export function allocateCustomerPayment(invoices, amount, excludedInvoiceIds = []) {
  const excluded = new Set(excludedInvoiceIds.map(String))
  const orderedInvoices = [...invoices]
    .filter((invoice) => Number(invoice.balanceDue) > 0 && !excluded.has(String(invoice.id)))
    .sort((left, right) => {
      const leftDate = Date.parse(left.createdAt)
      const rightDate = Date.parse(right.createdAt)
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
        return leftDate - rightDate
      }
      if (Number.isFinite(leftDate) !== Number.isFinite(rightDate)) {
        return Number.isFinite(leftDate) ? -1 : 1
      }
      return String(left.id).localeCompare(String(right.id), 'en', { numeric: true })
    })

  let remainingAmount = Number.isSafeInteger(amount) && amount > 0 ? amount : 0
  const allocations = []
  for (const invoice of orderedInvoices) {
    if (remainingAmount === 0) break
    const balanceDue = Number(invoice.balanceDue)
    if (!Number.isSafeInteger(balanceDue) || balanceDue <= 0) continue
    const allocatedAmount = Math.min(balanceDue, remainingAmount)
    allocations.push({ transactionId: invoice.id, amount: allocatedAmount, invoice })
    remainingAmount -= allocatedAmount
  }

  return {
    allocations,
    allocatedAmount: (Number.isSafeInteger(amount) && amount > 0 ? amount : 0) - remainingAmount,
    remainingAmount
  }
}
