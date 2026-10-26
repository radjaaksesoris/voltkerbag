export function isSafeRupiahAmount(value, allowZero = false) {
  const amount = Number(value)
  return Number.isSafeInteger(amount) && (allowZero ? amount >= 0 : amount > 0)
}
