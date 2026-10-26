import { dateTime, rupiah } from './format.js'
import { getInvoiceNumber } from './invoice.js'

const WIDTH = 1240
const MARGIN = 76
const COLORS = {
  darkRed: '#851f28',
  red: '#b22c34',
  ink: '#2d2622',
  muted: '#706359',
  border: '#e8ddd1',
  panel: '#faf7f2',
  white: '#ffffff'
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapText(value, maxLength) {
  const words = String(value || '').split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    if (!word) continue
    if (word.length > maxLength) {
      if (line) lines.push(line)
      line = ''
      for (let index = 0; index < word.length; index += maxLength) {
        const part = word.slice(index, index + maxLength)
        if (part.length === maxLength) lines.push(part)
        else line = part
      }
      continue
    }
    if (line && (line + ' ' + word).length > maxLength) {
      lines.push(line)
      line = word
    } else {
      line = line ? line + ' ' + word : word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['-']
}

function text(x, y, value, { size = 24, color = COLORS.ink, weight = 400, anchor = 'start' } = {}) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${escapeXml(value)}</text>`
}

function multilineText(x, y, lines, { size = 24, color = COLORS.ink, weight = 400, lineHeight = 32 } = {}) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}">${lines.map((line, index) =>
    `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
  ).join('')}</text>`
}

export function createInvoiceSvg(transaction, logoDataUrl) {
  const invoiceNumber = getInvoiceNumber(transaction)
  const items = Array.isArray(transaction.items) ? transaction.items : []
  const rows = items.map((item) => {
    const nameLines = wrapText(item.name || 'Barang', 48)
    return {
      item,
      nameLines,
      height: Math.max(72, nameLines.length * 30 + 34)
    }
  })

  const paidAmount = transaction.paidAmount != null
    ? Number(transaction.paidAmount)
    : Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
  const isCredit = transaction.paymentType === 'credit'
  const summaryRows = [
    ['TOTAL TRANSAKSI', rupiah(transaction.total), true],
    ['Sudah dibayar', rupiah(paidAmount), false],
    ...(isCredit
      ? [['Sisa tagihan', rupiah(transaction.balanceDue ?? Math.max(0, transaction.total - paidAmount)), false]]
      : [['Tunai diterima', rupiah(transaction.payment), false], ['Kembalian', rupiah(transaction.change), false]])
  ]
  const payments = isCredit && transaction.payments?.length ? transaction.payments : []
  const rowsHeight = rows.reduce((height, row) => height + row.height, 0)
  const paymentsHeight = payments.length ? 82 + payments.length * 42 : 0
  const summaryHeight = 116 + summaryRows.length * 54
  const tableTop = 588
  const summaryTop = tableTop + 70 + rowsHeight + 42 + paymentsHeight
  const height = summaryTop + summaryHeight + 144

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">`,
    `<rect width="${WIDTH}" height="${height}" fill="${COLORS.white}"/>`,
    `<path d="M0 0h${WIDTH}v226H0z" fill="${COLORS.darkRed}"/>`,
    `<circle cx="1160" cy="-55" r="230" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="34"/>`,
    `<circle cx="1160" cy="-55" r="180" fill="none" stroke="#ffffff" stroke-opacity=".06" stroke-width="2"/>`,
    `<image href="${logoDataUrl}" x="${MARGIN}" y="67" width="400" height="99" preserveAspectRatio="xMinYMid meet"/>`,
    text(WIDTH - MARGIN, 87, 'FAKTUR PENJUALAN', { size: 34, color: COLORS.white, weight: 700, anchor: 'end' }),
    text(WIDTH - MARGIN, 133, invoiceNumber, { size: 24, color: '#ffdfd6', anchor: 'end' }),
    text(WIDTH - MARGIN, 171, dateTime(transaction.createdAt), { size: 21, color: '#ffdfd6', anchor: 'end' }),
    `<path d="M${MARGIN} 194H${WIDTH - MARGIN}" stroke="#ffffff" stroke-opacity=".4" stroke-width="2"/>`,
    text(MARGIN, 216, 'VOLTKER  ·  TOKO TAS', { size: 16, color: COLORS.white, weight: 700 }),
    `<rect x="${MARGIN}" y="266" width="${WIDTH - MARGIN * 2}" height="244" rx="20" fill="${COLORS.panel}" stroke="${COLORS.border}" stroke-width="2"/>`,
    text(MARGIN + 32, 312, 'TAGIHAN KEPADA', { size: 17, color: COLORS.red, weight: 700 }),
    text(660, 312, 'DETAIL FAKTUR', { size: 17, color: COLORS.red, weight: 700 }),
    multilineText(MARGIN + 32, 362, wrapText(transaction.customerName || 'Pelanggan', 38), { size: 28, weight: 700, lineHeight: 34 }),
    transaction.customerPhone
      ? text(MARGIN + 32, 405, 'Telp. ' + transaction.customerPhone, { size: 19, color: COLORS.muted })
      : '',
    transaction.customerAddress
      ? multilineText(MARGIN + 32, transaction.customerPhone ? 440 : 405, wrapText(transaction.customerAddress, 52).slice(0, 2), { size: 18, color: COLORS.muted, lineHeight: 25 })
      : '',
    text(660, 362, 'No. Faktur', { size: 19, color: COLORS.muted }),
    text(WIDTH - MARGIN - 32, 362, invoiceNumber, { size: 19, weight: 700, anchor: 'end' }),
    text(660, 408, 'Tanggal', { size: 19, color: COLORS.muted }),
    text(WIDTH - MARGIN - 32, 408, dateTime(transaction.createdAt), { size: 19, weight: 700, anchor: 'end' }),
    text(660, 454, 'Pembayaran', { size: 19, color: COLORS.muted }),
    text(WIDTH - MARGIN - 32, 454, isCredit ? 'Kredit' : 'Tunai', { size: 19, weight: 700, anchor: 'end' }),
    text(MARGIN, 558, 'RINCIAN PEMBELIAN', { size: 22, weight: 700 }),
    `<rect x="${MARGIN}" y="${tableTop}" width="${WIDTH - MARGIN * 2}" height="58" rx="12" fill="${COLORS.darkRed}"/>`,
    text(MARGIN + 25, tableTop + 37, 'BARANG', { size: 16, color: COLORS.white, weight: 700 }),
    text(824, tableTop + 37, 'QTY', { size: 16, color: COLORS.white, weight: 700, anchor: 'middle' }),
    text(1010, tableTop + 37, 'HARGA SATUAN', { size: 16, color: COLORS.white, weight: 700, anchor: 'end' }),
    text(WIDTH - MARGIN - 24, tableTop + 37, 'JUMLAH', { size: 16, color: COLORS.white, weight: 700, anchor: 'end' })
  ]

  let y = tableTop + 58
  rows.forEach(({ item, nameLines, height: rowHeight }, index) => {
    if (index % 2 === 0) svg.push(`<rect x="${MARGIN}" y="${y}" width="${WIDTH - MARGIN * 2}" height="${rowHeight}" fill="${COLORS.panel}"/>`)
    svg.push(multilineText(MARGIN + 25, y + 42, nameLines, { size: 20, lineHeight: 29 }))
    svg.push(text(824, y + 42, String(item.qty) + ' ' + String(item.unit || 'pcs'), { size: 19, anchor: 'middle' }))
    svg.push(text(1010, y + 42, rupiah(item.price), { size: 19, anchor: 'end' }))
    svg.push(text(WIDTH - MARGIN - 24, y + 42, rupiah(Number(item.price) * Number(item.qty)), { size: 19, weight: 700, anchor: 'end' }))
    svg.push(`<path d="M${MARGIN} ${y + rowHeight}H${WIDTH - MARGIN}" stroke="${COLORS.border}" stroke-width="2"/>`)
    y += rowHeight
  })

  if (payments.length) {
    y += 42
    svg.push(text(MARGIN, y, 'RIWAYAT PEMBAYARAN', { size: 19, color: COLORS.red, weight: 700 }))
    y += 38
    payments.forEach((payment) => {
      svg.push(text(MARGIN, y, dateTime(payment.date), { size: 18, color: COLORS.muted }))
      svg.push(text(WIDTH - MARGIN, y, rupiah(payment.amount), { size: 18, weight: 700, anchor: 'end' }))
      y += 42
    })
  }

  const summaryX = 560
  const summaryWidth = WIDTH - MARGIN - summaryX
  svg.push(`<rect x="${summaryX}" y="${summaryTop}" width="${summaryWidth}" height="${summaryHeight}" rx="18" fill="${COLORS.panel}" stroke="${COLORS.border}" stroke-width="2"/>`)
  summaryRows.forEach(([label, value, prominent], index) => {
    const rowY = summaryTop + 54 + index * 54
    svg.push(text(summaryX + 28, rowY, label, { size: prominent ? 20 : 18, color: prominent ? COLORS.red : COLORS.muted, weight: prominent ? 700 : 400 }))
    svg.push(text(summaryX + summaryWidth - 28, rowY, value, { size: prominent ? 21 : 18, color: prominent ? COLORS.darkRed : COLORS.ink, weight: prominent ? 700 : 600, anchor: 'end' }))
  })
  svg.push(`<path d="M${MARGIN} ${height - 88}H${WIDTH - MARGIN}" stroke="${COLORS.border}" stroke-width="2"/>`)
  svg.push(text(MARGIN, height - 48, 'Terima kasih telah berbelanja di VOLTKER.', { size: 18, color: COLORS.muted }))
  svg.push(text(WIDTH - MARGIN, height - 48, invoiceNumber, { size: 16, color: COLORS.muted, anchor: 'end' }))
  svg.push('</svg>')
  return svg.join('')
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Gagal menyiapkan gambar faktur.'))
    image.src = url
  })
}

function loadLogoDataUrl() {
  return fetch(import.meta.env.BASE_URL + 'voltker-logo-320.png')
    .then((response) => {
      if (!response.ok) throw new Error('Logo Voltker gagal dimuat untuk faktur.')
      return response.blob()
    })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Logo Voltker gagal disiapkan untuk faktur.'))
      reader.readAsDataURL(blob)
    }))
}

export async function downloadInvoiceJpeg(transaction) {
  const logoDataUrl = await loadLogoDataUrl()
  const svgBlob = new Blob([createInvoiceSvg(transaction, logoDataUrl)], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = image.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Browser tidak dapat menyiapkan gambar faktur.')
    context.fillStyle = COLORS.white
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const jpegBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Gagal membuat file JPEG faktur.'))
      }, 'image/jpeg', 0.94)
    })
    const downloadUrl = URL.createObjectURL(jpegBlob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = getInvoiceNumber(transaction) + '.jpg'
    link.hidden = true
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
