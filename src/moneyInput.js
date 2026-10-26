export function formatMoneyInput(value) {
  const normalizedValue = typeof value === 'number' && Number.isFinite(value)
    ? String(Math.round(value))
    : String(value ?? '')
  const digits = normalizedValue.replace(/\D/g, '')
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
