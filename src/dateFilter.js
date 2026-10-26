export function localDateValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function hasDateRange(range) {
  return Boolean(range.from || range.to)
}

function localDateBoundary(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Tanggal filter tidak valid.')
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (localDateValue(date) !== value) throw new Error('Tanggal filter tidak valid.')
  return date
}

export function dateRangeTimestamps(range) {
  const fromDate = range.from ? localDateBoundary(range.from) : null
  const toDate = range.to ? localDateBoundary(range.to) : null
  if (fromDate && toDate && fromDate > toDate) {
    throw new Error('Tanggal awal tidak boleh melewati tanggal akhir.')
  }
  if (toDate) toDate.setDate(toDate.getDate() + 1)
  return {
    from: fromDate?.toISOString() ?? null,
    to: toDate?.toISOString() ?? null
  }
}
