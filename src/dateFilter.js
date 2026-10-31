export const DASHBOARD_DATE_RANGE_STORAGE_KEY = 'voltker.dashboard.date-range'

export function localDateValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function readDashboardDateRange(storage = globalThis.localStorage) {
  if (!storage) return null
  try {
    const saved = storage.getItem(DASHBOARD_DATE_RANGE_STORAGE_KEY)
    if (!saved) return null
    const range = JSON.parse(saved)
    if (typeof range?.from !== 'string' || typeof range?.to !== 'string') {
      throw new Error('Rentang tanggal tersimpan tidak valid.')
    }
    dateRangeTimestamps(range)
    return range
  } catch (error) {
    console.error('Gagal membaca filter tanggal Rekap Harian:', error)
    return null
  }
}

export function saveDashboardDateRange(range, storage = globalThis.localStorage) {
  if (!storage) return false
  try {
    dateRangeTimestamps(range)
    storage.setItem(DASHBOARD_DATE_RANGE_STORAGE_KEY, JSON.stringify(range))
    return true
  } catch (error) {
    console.error('Gagal menyimpan filter tanggal Rekap Harian:', error)
    return false
  }
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
