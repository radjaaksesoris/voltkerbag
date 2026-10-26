import { dateTime, rupiah } from './format'
import { getInvoiceNumber } from './invoice'

const PAGE_WIDTH = 210
const MARGIN = 15
const DARK_RED = [133, 31, 40]
const RED = [178, 44, 52]
const INK = [45, 38, 34]
const MUTED = [112, 99, 89]
const BORDER = [232, 221, 209]

function money(value) {
  return rupiah(value).replace(/\u00a0/g, ' ')
}

function setTextColor(document, color) {
  document.setTextColor(...color)
}

function addHeader(document, logo, invoiceNumber, transaction, pageNumber) {
  document.setFillColor(...DARK_RED)
  document.rect(0, 0, PAGE_WIDTH, 51, 'F')
  document.addImage(logo, 'PNG', MARGIN, 12, 61, 15)
  document.setFont('helvetica', 'bold')
  document.setFontSize(18)
  document.setTextColor(255, 255, 255)
  document.text('FAKTUR PENJUALAN', PAGE_WIDTH - MARGIN, 18, { align: 'right' })
  document.setFont('helvetica', 'normal')
  document.setFontSize(9)
  document.text(invoiceNumber, PAGE_WIDTH - MARGIN, 27, { align: 'right' })
  document.setTextColor(255, 223, 214)
  document.text(dateTime(transaction.createdAt), PAGE_WIDTH - MARGIN, 34, { align: 'right' })
  document.setDrawColor(255, 255, 255)
  document.setLineWidth(.4)
  document.line(MARGIN, 39, PAGE_WIDTH - MARGIN, 39)
  document.setFontSize(7)
  document.text('VOLTKER · TOKO TAS', MARGIN, 45)
  document.text('Halaman ' + pageNumber, PAGE_WIDTH - MARGIN, 45, { align: 'right' })
}

function addTableHeader(document, y) {
  document.setFillColor(...DARK_RED)
  document.roundedRect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, 10, 2, 2, 'F')
  document.setFont('helvetica', 'bold')
  document.setFontSize(8)
  document.setTextColor(255, 255, 255)
  document.text('BARANG', MARGIN + 5, y + 6.5)
  document.text('QTY', 137, y + 6.5, { align: 'center' })
  document.text('HARGA SATUAN', 169, y + 6.5, { align: 'right' })
  document.text('JUMLAH', PAGE_WIDTH - MARGIN - 4, y + 6.5, { align: 'right' })
}

function addFooter(document, pageNumber) {
  document.setDrawColor(...BORDER)
  document.setLineWidth(.3)
  document.line(MARGIN, 278, PAGE_WIDTH - MARGIN, 278)
  document.setFont('helvetica', 'normal')
  document.setFontSize(8)
  setTextColor(document, MUTED)
  document.text('Terima kasih telah berbelanja di VOLTKER.', MARGIN, 285)
  document.text(String(pageNumber), PAGE_WIDTH - MARGIN, 285, { align: 'right' })
}

async function loadLogo() {
  const response = await fetch(import.meta.env.BASE_URL + 'voltker-logo-320.png')
  if (!response.ok) throw new Error('Logo Voltker gagal dimuat untuk faktur.')
  return new Uint8Array(await response.arrayBuffer())
}

export async function downloadInvoicePdf(transaction) {
  const [{ jsPDF }, logo] = await Promise.all([
    import('jspdf'),
    loadLogo()
  ])
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const invoiceNumber = getInvoiceNumber(transaction)
  document.setProperties({
    title: invoiceNumber + ' - VOLTKER',
    subject: 'Faktur penjualan',
    creator: 'VOLTKER'
  })

  let pageNumber = 1
  addHeader(document, logo, invoiceNumber, transaction, pageNumber)

  document.setFillColor(250, 247, 242)
  document.setDrawColor(...BORDER)
  document.roundedRect(MARGIN, 59, PAGE_WIDTH - MARGIN * 2, 42, 3, 3, 'FD')
  document.setFont('helvetica', 'bold')
  document.setFontSize(8)
  setTextColor(document, RED)
  document.text('TAGIHAN KEPADA', MARGIN + 6, 67)
  document.text('DETAIL FAKTUR', 116, 67)

  document.setFontSize(11)
  setTextColor(document, INK)
  document.text(transaction.customerName || 'Pelanggan', MARGIN + 6, 75)
  document.setFont('helvetica', 'normal')
  document.setFontSize(8)
  setTextColor(document, MUTED)
  let customerY = 82
  if (transaction.customerPhone) {
    document.text('Telp. ' + transaction.customerPhone, MARGIN + 6, customerY)
    customerY += 5
  }
  if (transaction.customerAddress) {
    const addressLines = document.splitTextToSize(transaction.customerAddress, 82)
    document.text(addressLines.slice(0, 2), MARGIN + 6, customerY)
  }
  document.setFont('helvetica', 'normal')
  document.setFontSize(8)
  setTextColor(document, MUTED)
  document.text('No. Faktur', 116, 75)
  document.text('Tanggal', 116, 83)
  document.text('Pembayaran', 116, 91)
  document.setFont('helvetica', 'bold')
  setTextColor(document, INK)
  document.text(invoiceNumber, 189, 75, { align: 'right' })
  document.text(dateTime(transaction.createdAt), 189, 83, { align: 'right' })
  document.text(transaction.paymentType === 'credit' ? 'Kredit' : 'Tunai', 189, 91, { align: 'right' })

  document.setFont('helvetica', 'bold')
  document.setFontSize(10)
  setTextColor(document, INK)
  document.text('Rincian Pembelian', MARGIN, 114)
  addTableHeader(document, 119)

  let y = 129
  const items = Array.isArray(transaction.items) ? transaction.items : []
  for (const [index, item] of items.entries()) {
    const itemName = String(item.name || 'Barang')
    const nameLines = document.splitTextToSize(itemName, 86)
    const rowHeight = Math.max(11, nameLines.length * 4.5 + 4)
    if (y + rowHeight > 267) {
      addFooter(document, pageNumber)
      document.addPage()
      pageNumber += 1
      addHeader(document, logo, invoiceNumber, transaction, pageNumber)
      addTableHeader(document, 59)
      y = 69
    }
    if (index % 2 === 0) {
      document.setFillColor(250, 247, 242)
      document.rect(MARGIN, y, PAGE_WIDTH - MARGIN * 2, rowHeight, 'F')
    }
    document.setFont('helvetica', 'normal')
    document.setFontSize(8)
    setTextColor(document, INK)
    document.text(nameLines, MARGIN + 5, y + 6)
    document.text(String(item.qty) + ' ' + String(item.unit || 'pcs'), 137, y + 6, { align: 'center' })
    document.text(money(item.price), 169, y + 6, { align: 'right' })
    document.setFont('helvetica', 'bold')
    document.text(money(Number(item.price) * Number(item.qty)), PAGE_WIDTH - MARGIN - 4, y + 6, { align: 'right' })
    y += rowHeight
  }

  const paidAmount = transaction.paidAmount != null
    ? Number(transaction.paidAmount)
    : Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
  const isCredit = transaction.paymentType === 'credit'
  const summaryRows = [
    ['TOTAL', money(transaction.total), true],
    ['Sudah dibayar', money(paidAmount), false],
    ...(isCredit
      ? [['Sisa tagihan', money(transaction.balanceDue ?? Math.max(0, transaction.total - paidAmount)), false]]
      : [['Tunai diterima', money(transaction.payment), false], ['Kembalian', money(transaction.change), false]])
  ]
  const summaryHeight = 10 + summaryRows.length * 8
  if (y + summaryHeight > 267) {
    addFooter(document, pageNumber)
    document.addPage()
    pageNumber += 1
    addHeader(document, logo, invoiceNumber, transaction, pageNumber)
    y = 61
  } else {
    y += 8
  }
  const summaryX = 104
  const summaryWidth = PAGE_WIDTH - MARGIN - summaryX
  document.setFillColor(250, 247, 242)
  document.setDrawColor(...BORDER)
  document.roundedRect(summaryX, y, summaryWidth, summaryHeight, 3, 3, 'FD')
  summaryRows.forEach(([label, value, prominent], index) => {
    const rowY = y + 8 + index * 8
    document.setFont('helvetica', prominent ? 'bold' : 'normal')
    document.setFontSize(prominent ? 10 : 8)
    setTextColor(document, prominent ? RED : MUTED)
    document.text(label, summaryX + 5, rowY)
    setTextColor(document, prominent ? DARK_RED : INK)
    document.text(value, summaryX + summaryWidth - 5, rowY, { align: 'right' })
  })

  addFooter(document, pageNumber)
  document.save(invoiceNumber + '.pdf')
}
