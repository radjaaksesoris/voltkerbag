import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getTransactionPayments, recordTransactionPayment, returnTransactionItems } from '../db'
import { rupiah, dateTime, dateOnly } from '../format'
import { getInvoiceNumber, invoiceDueDate } from '../invoice'
import MoneyInput from './MoneyInput'
import ReceiptPreview from './ReceiptPreview'
import Icon from './Icon.jsx'
import CustomerIdentity from './CustomerIdentity.jsx'
import { downloadInvoiceJpeg } from '../invoiceJpeg'
import { isSafeRupiahAmount } from '../money'
import { returnedQuantity } from '../transactionReturns.js'

export default function TransactionDetails({ transaction, onClose, onTransactionUpdated, allowPayment = true }) {
  const [currentTransaction, setCurrentTransaction] = useState(transaction)
  const [showReceipt, setShowReceipt] = useState(false)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)
  const [invoiceDownloadError, setInvoiceDownloadError] = useState('')
  const [invoiceDownloadStatus, setInvoiceDownloadStatus] = useState('')
  const [payments, setPayments] = useState(transaction.payments || [])
  const [paymentsError, setPaymentsError] = useState('')
  const [amount, setAmount] = useState(() => String(
    transaction.balanceDue ?? Math.max(
      0,
      (Number(transaction.total) || 0) - (
        transaction.paidAmount != null
          ? Number(transaction.paidAmount)
          : Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
      )
    )
  ))
  const [paymentError, setPaymentError] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)
  const [returnQuantities, setReturnQuantities] = useState({})
  const [returnError, setReturnError] = useState('')
  const [savingReturn, setSavingReturn] = useState(false)
  const paymentRequest = useRef(null)
  const returnRequest = useRef(null)
  const operationLock = useRef(false)
  const paymentsLoadGeneration = useRef(0)
  const paidAmount = currentTransaction.paidAmount != null
    ? Number(currentTransaction.paidAmount)
    : Math.min(Number(currentTransaction.total) || 0, Number(currentTransaction.payment) || 0)
  const balanceDue = currentTransaction.balanceDue != null
    ? Number(currentTransaction.balanceDue)
    : Math.max(0, (Number(currentTransaction.total) || 0) - paidAmount)

  useEffect(() => {
    setCurrentTransaction(transaction)
    setPayments(transaction.payments || [])
    setReturnQuantities({})
  }, [transaction])

  useEffect(() => {
    if (currentTransaction.paymentType !== 'credit') return
    let active = true
    const generation = ++paymentsLoadGeneration.current
    setPayments(currentTransaction.payments || [])
    setPaymentsError('')
    getTransactionPayments(currentTransaction.id)
      .then((rows) => {
        if (active && generation === paymentsLoadGeneration.current) {
          setPayments(rows)
          setCurrentTransaction((current) => (
            current.id === currentTransaction.id
              ? { ...current, payments: rows }
              : current
          ))
          setPaymentsError('')
        }
      })
      .catch((error) => {
        if (active && generation === paymentsLoadGeneration.current) {
          setPaymentsError(error.message || 'Gagal memuat riwayat pembayaran.')
        }
      })
    return () => {
      active = false
    }
  }, [currentTransaction.id, currentTransaction.paymentType])

  async function downloadInvoice() {
    setInvoiceDownloading(true)
    setInvoiceDownloadError('')
    setInvoiceDownloadStatus('')
    try {
      await downloadInvoiceJpeg(currentTransaction)
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
    if (!isSafeRupiahAmount(balanceDue, true)) {
      setPaymentError('Sisa tagihan melebihi batas nominal rupiah yang aman. Periksa data transaksi.')
      return
    }
    if (!isSafeRupiahAmount(paymentAmount)) {
      setPaymentError('Nominal harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (paymentAmount > balanceDue) {
      setPaymentError('Pembayaran tidak boleh melebihi sisa utang ' + rupiah(balanceDue) + '.')
      return
    }

    const fingerprint = currentTransaction.id + ':' + paymentAmount
    if (paymentRequest.current?.fingerprint !== fingerprint) {
      paymentRequest.current = { fingerprint, id: crypto.randomUUID() }
    }

    operationLock.current = true
    setSavingPayment(true)
    try {
      await recordTransactionPayment(
        currentTransaction.id,
        paymentAmount,
        paymentRequest.current.id
      )
      paymentRequest.current = null
      const updatedPaidAmount = paidAmount + paymentAmount
      const updatedTransaction = {
        ...currentTransaction,
        paidAmount: updatedPaidAmount,
        balanceDue: Math.max(0, Number(currentTransaction.total) - updatedPaidAmount),
        payments: [...payments, { amount: paymentAmount, date: new Date().toISOString() }]
      }
      paymentsLoadGeneration.current += 1
      setPayments(updatedTransaction.payments)
      setCurrentTransaction(updatedTransaction)
      onTransactionUpdated?.(updatedTransaction)
      setAmount(String(updatedTransaction.balanceDue))
    } catch (error) {
      setPaymentError('Gagal menyimpan pembayaran: ' + error.message)
    } finally {
      operationLock.current = false
      setSavingPayment(false)
    }
  }

  async function submitReturn(event) {
    event.preventDefault()
    if (operationLock.current) return
    setReturnError('')
    const items = Object.entries(returnQuantities)
      .map(([lineIndex, qty]) => ({ lineIndex: Number(lineIndex), qty: Number(qty) }))
      .filter(({ qty }) => qty > 0)
    if (!items.length || items.some(({ lineIndex, qty }) => (
      !Number.isSafeInteger(lineIndex)
      || !Number.isSafeInteger(qty)
      || qty <= 0
      || qty > Number(currentTransaction.items[lineIndex]?.qty) - returnedQuantity(currentTransaction, lineIndex)
    ))) {
      setReturnError('Periksa jumlah retur. Jumlah harus bilangan bulat dan tidak melebihi sisa barang.')
      return
    }
    const returnValue = items.reduce((total, item) => (
      total + Number(currentTransaction.items[item.lineIndex].price) * item.qty
    ), 0)
    if (!isSafeRupiahAmount(returnValue)) {
      setReturnError('Nilai retur melebihi batas nominal rupiah yang aman.')
      return
    }
    const fingerprint = currentTransaction.id + ':' + JSON.stringify(items)
    if (returnRequest.current?.fingerprint !== fingerprint) {
      returnRequest.current = { fingerprint, id: crypto.randomUUID() }
    }

    operationLock.current = true
    setSavingReturn(true)
    try {
      const returnedEvent = await returnTransactionItems(
        currentTransaction.id,
        items,
        returnRequest.current.id
      )
      returnRequest.current = null
      const updatedTransaction = {
        ...currentTransaction,
        total: returnedEvent.total,
        paidAmount: returnedEvent.paidAmount,
        balanceDue: returnedEvent.balanceDue,
        returns: [...(currentTransaction.returns || []), returnedEvent]
      }
      setCurrentTransaction(updatedTransaction)
      setReturnQuantities({})
      setAmount(String(updatedTransaction.balanceDue))
      onTransactionUpdated?.(updatedTransaction)
    } catch (error) {
      setReturnError('Gagal mencatat retur: ' + error.message)
    } finally {
      operationLock.current = false
      setSavingReturn(false)
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
            <p className="muted small">{getInvoiceNumber(currentTransaction)}</p>
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

        <dl className={'transaction-details-meta' + (currentTransaction.expedition ? ' has-expedition' : '')}>
          <div><dt>Nama pelanggan</dt><dd>
            <CustomerIdentity
              name={currentTransaction.customerName}
              customer={{ phone: currentTransaction.customerPhone, address: currentTransaction.customerAddress }}
            />
          </dd></div>
          {currentTransaction.expedition && <div><dt>Ekspedisi</dt><dd>{currentTransaction.expedition}</dd></div>}
          <div><dt>Tanggal transaksi</dt><dd>{dateOnly(currentTransaction.createdAt)}</dd></div>
          <div><dt>Metode pembayaran</dt><dd>{currentTransaction.paymentType === 'credit' ? 'Kredit' : 'Tunai'}</dd></div>
          {currentTransaction.paymentType === 'credit' && (
            <div><dt>Jatuh tempo</dt><dd>{dateOnly(invoiceDueDate(currentTransaction.createdAt))}</dd></div>
          )}
        </dl>

        <div className="table-card transaction-details-items">
          <table>
            <thead><tr><th>Barang</th><th className="right">Jumlah</th><th className="right">Harga</th><th className="right">Subtotal</th></tr></thead>
            <tbody>
              {currentTransaction.items.map((item, index) => {
                const returnedQty = returnedQuantity(currentTransaction, index)
                const remainingQty = Number(item.qty) - returnedQty
                if (remainingQty <= 0) return null
                return (
                  <tr key={index}>
                    <td><strong>{item.name}</strong></td>
                    <td className="right">
                      {remainingQty} {item.unit || 'pcs'}
                      {returnedQty > 0 && <span className="transaction-returned-quantity"> (retur {returnedQty})</span>}
                    </td>
                    <td className="right">{rupiah(item.price)}</td>
                    <td className="right">{rupiah(item.price * remainingQty)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr><th colSpan="3">Total transaksi</th><th className="right accent">{rupiah(currentTransaction.total)}</th></tr>
              <tr><td colSpan="3">Sudah dibayar</td><td className="right">{rupiah(paidAmount)}</td></tr>
              <tr><td colSpan="3">Sisa tagihan</td><td className="right">{rupiah(balanceDue)}</td></tr>
            </tfoot>
          </table>
        </div>

        {(currentTransaction.returns || []).length > 0 && (
          <section className="transaction-details-payments transaction-return-history">
            <h4>Riwayat retur</h4>
            <ul>
              {currentTransaction.returns.map((entry, index) => (
                <li key={entry.requestId || index}>
                  <span>{dateTime(entry.date)} · {(entry.items || []).map((item) => `${item.name} ${item.qty} ${item.unit || 'pcs'}`).join(', ')}</span>
                  <strong>{rupiah(entry.amount)}{entry.refundAmount > 0 ? ` · Refund ${rupiah(entry.refundAmount)}` : ''}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        {currentTransaction.items.some((item, index) => Number(item.qty) > returnedQuantity(currentTransaction, index)) && (
          <form className="transaction-details-return-form" onSubmit={submitReturn}>
            <h4>Retur barang</h4>
            <p className="muted small">Stok akan dikembalikan otomatis. Jika pembayaran melebihi total baru, kelebihannya dicatat sebagai refund tunai.</p>
            <div className="transaction-return-lines">
              {currentTransaction.items.map((item, index) => {
                const remaining = Number(item.qty) - returnedQuantity(currentTransaction, index)
                if (remaining <= 0) return null
                return (
                  <label key={index}>
                    <span>{item.name} <small>(sisa {remaining} {item.unit || 'pcs'})</small></span>
                    <input
                      type="number"
                      inputMode="none"
                      data-custom-numpad="integer"
                      min="0"
                      max={remaining}
                      step="1"
                      value={returnQuantities[index] || ''}
                      aria-label={`Jumlah retur ${item.name}`}
                      onChange={(event) => setReturnQuantities((values) => ({ ...values, [index]: event.target.value }))}
                    />
                  </label>
                )
              })}
            </div>
            {returnError && <p className="form-error" role="alert">{returnError}</p>}
            <button type="submit" className="btn btn-primary" disabled={savingReturn || savingPayment}>
              {savingReturn ? 'Menyimpan retur...' : 'Simpan retur'}
            </button>
          </form>
        )}

        {currentTransaction.paymentType === 'credit' && (
          <section className="transaction-details-payments">
            <h4>Riwayat pembayaran</h4>
            {paymentsError && <p className="form-error" role="alert">{paymentsError}</p>}
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

        {allowPayment && currentTransaction.paymentType === 'credit' && balanceDue > 0 && (
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
        <ReceiptPreview transaction={currentTransaction} onClose={() => setShowReceipt(false)} />
      )}
    </div>,
    document.body
  )
}
