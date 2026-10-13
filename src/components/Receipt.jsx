import { rupiah, dateTime } from '../format'

function printRupiah(amount) {
  return rupiah(amount).replace(/\u00a0/g, ' ')
}

export default function Receipt({ transaction }) {
  const payments = transaction.payments || []
  const paidAmount = transaction.paidAmount != null
    ? Number(transaction.paidAmount)
    : Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
  const balanceDue = transaction.balanceDue != null
    ? Number(transaction.balanceDue)
    : Math.max(0, (Number(transaction.total) || 0) - paidAmount)
  const isCredit = transaction.paymentType === 'credit'

  return (
    <article className="print-receipt" aria-label="Struk transaksi">
      <header className="receipt-header">
        <strong>VOLTKER</strong>
        <span>TOKO TAS</span>
        <span>BUKTI PEMBAYARAN</span>
      </header>

      <section className="receipt-meta">
        <div><span>No. Transaksi</span><strong>#{transaction.id}</strong></div>
        <div><span>Tanggal</span><strong>{dateTime(transaction.createdAt)}</strong></div>
        <div><span>Pelanggan</span><strong>{transaction.customerName || '-'}</strong></div>
        <div><span>Pembayaran</span><strong>{isCredit ? 'Kredit tanpa bunga' : 'Tunai'}</strong></div>
      </section>

      <table className="receipt-items">
        <thead>
          <tr><th>Barang</th><th className="receipt-qty">Jml</th><th className="receipt-money">Harga</th><th className="receipt-money">Jumlah</th></tr>
        </thead>
        <tbody>
          {transaction.items.map((item, index) => (
            <tr key={index}>
              <td>{item.name}</td>
              <td className="receipt-qty">{item.qty}</td>
              <td className="receipt-money">{printRupiah(item.price)}</td>
              <td className="receipt-money">{printRupiah(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="receipt-totals">
        <div className="receipt-total"><span>TOTAL</span><strong>{printRupiah(transaction.total)}</strong></div>
        <div><span>Sudah dibayar</span><strong>{printRupiah(paidAmount)}</strong></div>
        {isCredit ? (
          <>
            <div><span>Sisa tagihan</span><strong>{printRupiah(balanceDue)}</strong></div>
            {payments.length > 0 && (
              <div className="receipt-payment-list">
                <span>Rincian pembayaran</span>
                {payments.map((payment, index) => (
                  <strong key={index}>{dateTime(payment.date)} - {printRupiah(payment.amount)}</strong>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div><span>Tunai diterima</span><strong>{printRupiah(transaction.payment)}</strong></div>
            <div><span>Kembalian</span><strong>{printRupiah(transaction.change)}</strong></div>
          </>
        )}
      </section>

      <footer className="receipt-footer">
        <span>Terima kasih telah berbelanja</span>
        <span>Barang yang sudah dibeli tidak dapat ditukar</span>
      </footer>
    </article>
  )
}
