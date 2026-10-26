import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { recordTransactionPayment } from '../db'
import { rupiah, dateTime, dateOnly } from '../format'
import { getInvoiceNumber } from '../invoice'
import MoneyInput from './MoneyInput'
import ReceiptPreview from './ReceiptPreview'
import Icon from './Icon.jsx'
import CustomerIdentity from './CustomerIdentity.jsx'
import { downloadInvoiceJpeg } from '../invoiceJpeg'

export default function TransactionDetails({ transaction, onClose, onTransactionUpdated, allowPayment = true }) {
  const [showReceipt, setShowReceipt] = useState(false)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)
  const [invoiceDownloadError, setInvoiceDownloadError] = useState('')
  const [invoiceDownloadStatus, setInvoiceDownloadStatus] = useState('')
  const payments = transaction.payments || []
  const paidAmount = transaction.paidAmount != null
    ? Number(transaction.paidAmount)
    : Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
  const balanceDue = transaction.balanceDue != null
    ? Number(transaction.balanceDue)
    : Math.max(0, (Number(transaction.total) || 0) - paidAmount)
  const [amount, setAmount] = useState(() => String(balanceDue))
  const [paymentError, setPaymentError] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const paymentRequest = useRef(null)
  const operationLock = useRef(false)

  async function downloadInvoice() {
    setInvoiceDownloading(true)
    setInvoiceDownloadError('')
    setInvoiceDownloadStatus('')
    try {
      await downloadInvoiceJpeg(transaction)
      setInvoiceDownloadStatus('Faktur JPEG berhasil diunduh.')
    } catch (error) {
      setInvoiceDownloadError(error.message || 'Gagal mengunduh faktur.')
    } finally {
      setInvoiceDownloading(false)
    }
  }

  async function submitPayment(event) {
    event.preventDefault()
    if (operationLock.current) return
    setPaymentError('')
    const paymentAmount = Number(amount)
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setPaymentError('Masukkan nominal pembayaran lebih dari Rp0.')
      return
    }
    if (paymentAmount > balanceDue) {
      setPaymentError('Pembayaran tidak boleh melebihi sisa utang ' + rupiah(balanceDue) + '.')
      return
    }

    const fingerprint = transaction.id + ':' + paymentAmount
    if (paymentRequest.current?.fingerprint !== fingerprint) {
      paymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }

    operationLock.current = true
    setSavingPayment(true)
    try {
      await recordTransactionPayment(
        transaction.id,
        paymentAmount,
        paymentRequest.current.id
      )
      paymentRequest.current = null
      const updatedPaidAmount = paidAmount + paymentAmount
      const updatedTransaction = {
        ...transaction,
        paidAmount: updatedPaidAmount,
        balanceDue: Math.max(0, Number(transaction.total) - updatedPaidAmount),
        payments: [...payments, { amount: paymentAmount, date: new Date().toISOString() }]
      }
      onTransactionUpdated?.(updatedTransaction)
      setAmount(String(updatedTransaction.balanceDue))
    } catch (error) {
      setPaymentError('Gagal menyimpan pembayaran: ' + error.message)
    } finally {
      operationLock.current = false
      setSavingPayment(false)
    }
  }

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <section
        className="modal transaction-details"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-details-title"
        onClick={(event) => event.stopPropagation()}>
        <div className="transaction-details-heading">
          <div>
            <h3 id="transaction-details-title">Detail transaksi</h3>
            <p className="muted small">{getInvoiceNumber(transaction)}</p>
          </div>
          <div className="transaction-details-heading-actions">
            <button className="btn btn-primary" type="button" onClick={() => setShowReceipt(true)}>
              <Icon name="print" size={15} />
              PRINT
            </button>
            <button
              className="btn"
              type="button"
              aria-label={invoiceDownloading ? 'Menyiapkan download faktur' : 'Download faktur'}
              title={invoiceDownloading ? 'Menyiapkan download faktur' : 'Download faktur'}
              disabled={invoiceDownloading}
              onClick={downloadInvoice}>
              <Icon name="download" size={15} />
            </button>
            <button className="btn" type="button" onClick={onClose}>Tutup</button>
          </div>
        </div>
        {invoiceDownloadError && <p className="form-error" role="alert">{invoiceDownloadError}</p>}
        {invoiceDownloadStatus && <p className="backup-success" role="status">{invoiceDownloadStatus}</p>}

        <dl className="transaction-details-meta">
          <div><dt>Nama pelanggan</dt><dd>
            <CustomerIdentity
              name={transaction.customerName}
              customer={{ phone: transaction.customerPhone, address: transaction.customerAddress }}
            />
          </dd></div>
          {transaction.expedition && <div><dt>Ekspedisi</dt><dd>{transaction.expedition}</dd></div>}
          <div><dt>Tanggal transaksi</dt><dd>{dateOnly(transaction.createdAt)}</dd></div>
          <div><dt>Metode pembayaran</dt><dd>{transaction.paymentType === 'credit' ? 'Kredit' : 'Tunai'}</dd></div>
        </dl>

        <div className="table-card transaction-details-items">
          <table>
            <thead><tr><th>Barang</th><th className="right">Jumlah</th><th className="right">Harga</th><th className="right">Subtotal</th></tr></thead>
            <tbody>
              {transaction.items.map((item, index) => (
                <tr key={index}>
                  <td><strong>{item.name}</strong></td>
                  <td className="right">{item.qty} {item.unit || 'pcs'}</td>
                  <td className="right">{rupiah(item.price)}</td>
                  <td className="right">{rupiah(item.price * item.qty)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th colSpan="3">Total transaksi</th><th className="right accent">{rupiah(transaction.total)}</th></tr>
              <tr><td colSpan="3">Sudah dibayar</td><td className="right">{rupiah(paidAmount)}</td></tr>
              <tr><td colSpan="3">Sisa tagihan</td><td className="right">{rupiah(balanceDue)}</td></tr>
            </tfoot>
          </table>
        </div>

        {transaction.paymentType === 'credit' && (
          <section className="transaction-details-payments">
            <h4>Riwayat pembayaran</h4>
            {payments.length === 0 ? (
              <p className="muted small">Belum ada pembayaran.</p>
            ) : (
              <ul>
                {payments.map((payment, index) => (
                  <li key={index}><span>{dateTime(payment.date)}</span><strong>{rupiah(payment.amount)}</strong></li>
                ))}
              </ul>
            )}
          </section>
        )}

        {allowPayment && transaction.paymentType === 'credit' && balanceDue > 0 && (
          <form className="transaction-details-payment-form" onSubmit={submitPayment}>
            <h4>Catat pembayaran</h4>
            <p className="muted small">Isi sebesar sisa utang untuk melunasi, atau ubah nominal untuk membayar sebagian.</p>
            <label htmlFor="transaction-payment-amount">Jumlah pembayaran</label>
            <MoneyInput
              id="transaction-payment-amount"
              value={amount}
              onChange={setAmount}
              placeholder="Masukkan nominal pembayaran"
              required
            />
            {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
            <button type="submit" className="btn btn-primary" disabled={savingPayment}>
              {savingPayment ? 'Menyimpan...' : 'Simpan pembayaran'}
            </button>
          </form>
        )}
      </section>
      {showReceipt && (
        <ReceiptPreview transaction={transaction} onClose={() => setShowReceipt(false)} />
      )}
    </div>,
    document.body
  )
}
