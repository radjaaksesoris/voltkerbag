export function allocateVendorPayment(payables, amount, excludedPayableIds = []) {
  const excluded = new Set(excludedPayableIds.map(String))
  const orderedPayables = [...payables]
    .filter((payable) => Number(payable.balance_due) > 0 && !excluded.has(String(payable.id)))
    .sort((left, right) => {
      const leftDate = Date.parse(left.date || left.createdAt)
      const rightDate = Date.parse(right.date || right.createdAt)
      if (Number.isFinite(leftDate) && Number.isFinite(rightDate) && leftDate !== rightDate) {
        return leftDate - rightDate
      }
      if (Number.isFinite(leftDate) !== Number.isFinite(rightDate)) {
        return Number.isFinite(leftDate) ? -1 : 1
      }
      return String(left.id).localeCompare(String(right.id), 'en', { numeric: true })
    })

  const requestedAmount = Number.isSafeInteger(amount) && amount > 0 ? amount : 0
  let remainingAmount = requestedAmount
  const allocations = []
  for (const payable of orderedPayables) {
    if (remainingAmount === 0) break
    const balanceDue = Number(payable.balance_due)
    if (!Number.isSafeInteger(balanceDue) || balanceDue <= 0) continue
    const allocatedAmount = Math.min(balanceDue, remainingAmount)
    allocations.push({ payableId: payable.id, amount: allocatedAmount, payable })
    remainingAmount -= allocatedAmount
  }

  return {
    allocations,
    allocatedAmount: requestedAmount - remainingAmount,
    remainingAmount
  }
}
