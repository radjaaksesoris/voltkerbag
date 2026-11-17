export function returnedQuantity(transaction, lineIndex) {
  return (transaction.returns || []).reduce((total, entry) => (
    total + (entry.items || []).reduce((lineTotal, item) => (
      lineTotal + (Number(item.lineIndex) === lineIndex ? Number(item.qty) || 0 : 0)
    ), 0)
  ), 0)
}

export function returnedAmount(transaction, lineIndex) {
  return (transaction.returns || []).reduce((total, entry) => (
    total + (entry.items || []).reduce((lineTotal, item) => (
      lineTotal + (Number(item.lineIndex) === lineIndex
        ? (Number(item.price) || 0) * (Number(item.qty) || 0)
        : 0)
    ), 0)
  ), 0)
}

export function transactionRefundTotal(transaction) {
  return (transaction.returns || []).reduce(
    (total, entry) => total + (Number(entry.refundAmount) || 0),
    0
  )
}
