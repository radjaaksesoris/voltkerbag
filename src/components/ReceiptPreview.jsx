import { createPortal } from 'react-dom'
import Receipt from './Receipt'

export default function ReceiptPreview({ transaction, onClose }) {
  return createPortal(
    <div className="overlay receipt-preview-overlay" onClick={onClose}>
      <section
        className="receipt-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-preview-title"
        onClick={(event) => event.stopPropagation()}>
        <header className="receipt-preview-heading">
          <div>
            <h3 id="receipt-preview-title">Pratinjau faktur</h3>
            <p className="muted small">Ukuran cetak 24 × 14 cm · continuous form</p>
          </div>
          <button className="btn" type="button" onClick={onClose}>Tutup</button>
        </header>
        <div className="receipt-preview-paper">
          <Receipt transaction={transaction} />
        </div>
        <footer className="receipt-preview-actions">
          <button className="btn" type="button" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" type="button" onClick={() => window.print()}>Cetak</button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
