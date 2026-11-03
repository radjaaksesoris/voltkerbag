import { localDateValue } from '../dateFilter.js'

const MONTH_INDEX = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11
}

export function specificDateRangeForPeriod(period, now = new Date()) {
  const range = String(period || '').toLocaleLowerCase('id-ID')
  const exactDateMatch = range.match(/^tanggal\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (exactDateMatch) {
    const month = MONTH_INDEX[exactDateMatch[2]]
    if (month === undefined) return null
    const year = Number(exactDateMatch[3] || now.getFullYear())
    const dayOfMonth = Number(exactDateMatch[1])
    const date = new Date(year, month, dayOfMonth)
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== dayOfMonth) {
      throw new Error('Tanggal yang diminta tidak valid.')
    }
    const day = localDateValue(date)
    return { from: day, to: day }
  }

  const previousMonthDate = range.match(/^tanggal\s+(\d{1,2})\s+bulan\s+lalu$/)
  if (previousMonthDate) {
    const month = now.getMonth() - 1
    const dayOfMonth = Number(previousMonthDate[1])
    const date = new Date(now.getFullYear(), month, dayOfMonth)
    if (date.getDate() !== dayOfMonth || date.getMonth() !== (month + 12) % 12) {
      throw new Error('Tanggal tersebut tidak ada pada bulan lalu.')
    }
    const day = localDateValue(date)
    return { from: day, to: day }
  }

  const previousWeekday = range.match(/^hari\s+(senin|selasa|rabu|kamis|jumat|sabtu|minggu)\s+kemarin$/)
  if (previousWeekday) {
    const weekdays = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu']
    const offset = (now.getDay() - weekdays.indexOf(previousWeekday[1]) + 7) % 7 || 7
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const day = localDateValue(date)
    return { from: day, to: day }
  }

  return null
}

export function namedMonthDateRange(period, currentYear = new Date().getFullYear()) {
  const match = String(period || '').toLocaleLowerCase('id-ID').match(/^([a-z]+)(?:\s+(\d{4}))?$/)
  if (!match || !Object.hasOwn(MONTH_INDEX, match[1])) return null

  const year = match[2] ? Number(match[2]) : currentYear
  const month = MONTH_INDEX[match[1]]
  return {
    from: localDateValue(new Date(year, month, 1)),
    to: localDateValue(new Date(year, month + 1, 0))
  }
}
