export function invoiceNumber(createdAt, id) {
  const date = new Date(createdAt || Date.now())
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('')
  return `INV-${datePart}-${String(id).padStart(2, '0')}`
}

export function getInvoiceNumber(transaction) {
  if (!transaction.invoiceNo) return invoiceNumber(transaction.createdAt, transaction.id)
  return transaction.invoiceNo.replace(/-(\d+)$/, (_, sequence) =>
    '-' + String(Number(sequence)).padStart(2, '0')
  )
}
