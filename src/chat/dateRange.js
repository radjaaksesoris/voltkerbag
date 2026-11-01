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
