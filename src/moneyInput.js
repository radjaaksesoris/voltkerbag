export function formatMoneyInput(value) {
  const normalizedValue = typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value))
    : String(value ?? '')
  const digits = normalizedValue.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function clampMoneyInput(value, maxAmount) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits || !Number.isSafeInteger(maxAmount) || maxAmount < 0) return digits
  const amount = Number(digits)
  return amount > maxAmount ? String(maxAmount) : digits
}
