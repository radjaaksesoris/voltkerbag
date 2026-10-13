import { rupiah, dateTime } from '../format'
import { getInvoiceNumber } from '../invoice'

export default function TransactionDetails({ transaction, onClose }) {
  const payments = transaction.payments || []
  const paidAmount = transaction.paidAmount != null
    ? Number(transaction.paidAmount)
    : Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
  const balanceDue = transaction.balanceDue != null
    ? Number(transaction.balanceDue)
    : Math.max(0, (Number(transaction.total) || 0) - paidAmount)

  return (
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
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>

        <dl className="transaction-details-meta">
          <div><dt>Nama pelanggan</dt><dd>{transaction.customerName || 'Pelanggan lama'}</dd></div>
          <div><dt>Tanggal transaksi</dt><dd>{dateTime(transaction.createdAt)}</dd></div>
          <div><dt>Metode pembayaran</dt><dd>{transaction.paymentType === 'credit' ? 'Kredit tanpa bunga' : 'Tunai'}</dd></div>
        </dl>

        <div className="table-card transaction-details-items">
          <table>
            <thead><tr><th>Barang</th><th className="right">Jumlah</th><th className="right">Harga</th><th className="right">Subtotal</th></tr></thead>
            <tbody>
              {transaction.items.map((item, index) => (
                <tr key={index}>
                  <td><strong>{item.name}</strong></td>
                  <td className="right">{item.qty}</td>
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
      </section>
    </div>
  )
}
