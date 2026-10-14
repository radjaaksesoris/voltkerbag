import { useEffect, useMemo, useRef, useState } from 'react'
import { getAll, getProductImageUrl, completeSale, recordTransactionPayment, onRefresh } from '../db'
import { rupiah, dateTime, isToday } from '../format'
import Receipt from '../components/Receipt'
import Icon from '../components/Icon.jsx'
import TransactionDetails from '../components/TransactionDetails'
import { getInvoiceNumber } from '../invoice'
import MoneyInput from '../components/MoneyInput.jsx'
import CustomerSelect from '../components/CustomerSelect.jsx'
import { productPrice, saleUnitPrice, saleUnits, stockInPcs, stockLabel, unitCost, unitFactor } from '../productUnits'

export default function Transactions() {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [history, setHistory] = useState([])
  const [cart, setCart] = useState([])
  const [q, setQ] = useState('')
  const [pay, setPay] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [checkoutError, setCheckoutError] = useState('')
  const [done, setDone] = useState(null)
  const [installmentTransaction, setInstallmentTransaction] = useState(null)
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentError, setInstallmentError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewTransaction, setPreviewTransaction] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const operationLock = useRef(false)
  const saleRequest = useRef(null)
  const installmentRequest = useRef(null)
  const [loadError, setLoadError] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function load() {
    try {
      const [productRows, txs, customerRows] = await Promise.all([
        getAll('products'),
        getAll('transactions'),
        getAll('customers')
      ])
      setProducts(productRows)
      setCustomers(customerRows)
      setHistory(txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat data kasir dari server.')
    } finally {
      setLoaded(true)
    }
  }
  useEffect(() => {
    load()
    return onRefresh(load)
  }, [])

  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])

  function remainingStockPcs(productId, excludedUnit) {
    const product = products.find((item) => item.id === productId)
    if (!product) return 0
    const reserved = cart
      .filter((item) => item.productId === productId && item.unit !== excludedUnit)
      .reduce((sum, item) => sum + item.qty * unitFactor(item.unit), 0)
    return Math.max(0, stockInPcs(product) - reserved)
  }

  function maxCartQuantity(productId, unit, excludedUnit = unit) {
    return Math.floor(remainingStockPcs(productId, excludedUnit) / unitFactor(unit))
  }

  function canAddOne(productId, unit) {
    const existingQty = cart.find((item) => item.productId === productId && item.unit === unit)?.qty || 0
    return maxCartQuantity(productId, unit) > existingQty
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat data dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) && stockInPcs(p) > 0
  )
  const paidNow = Number(pay || 0)
  const change = paidNow - total

  function addToCart(p, unit = p.unit || 'pcs') {
    const maxQty = maxCartQuantity(p.id, unit)
    if (maxQty < 1) {
      setCheckoutError('Stok "' + p.name + '" tidak cukup untuk dijual per ' + unit + '.')
      return
    }
    const found = cart.find((c) => c.productId === p.id && c.unit === unit)
    if (found && found.qty + 1 > maxQty) {
      setCheckoutError('Stok "' + p.name + '" tidak cukup untuk jumlah tersebut.')
      return
    }
    if (found) {
      setCart(cart.map((c) => (c.productId === p.id && c.unit === unit ? { ...c, qty: c.qty + 1 } : c)))
    } else {
      setCart([...cart, {
        productId: p.id,
        name: p.name,
        unit,
        price: saleUnitPrice(p, unit),
        cost: unitCost(p, unit),
        qty: 1,
        saleUnits: saleUnits(p.unit || 'pcs')
      }])
    }
    setCheckoutError('')
  }
  function setQty(productId, unit, qty) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((c) => !(c.productId === productId && c.unit === unit))
        : prev.map((c) => {
            if (c.productId !== productId || c.unit !== unit) return c
            return { ...c, qty: Math.min(qty, maxCartQuantity(productId, unit)) }
          })
    )
    setCheckoutError('')
  }

  function changeCartUnit(productId, oldUnit, newUnit) {
    const product = products.find((item) => item.id === productId)
    const cartItem = cart.find((item) => item.productId === productId && item.unit === oldUnit)
    if (!product || !cartItem || oldUnit === newUnit) return
    if (cart.some((item) => item.productId === productId && item.unit === newUnit)) {
      setCheckoutError('Keranjang sudah memiliki baris produk "' + product.name + '" dengan satuan ' + newUnit + '.')
      return
    }
    if (cartItem.qty > maxCartQuantity(productId, newUnit, oldUnit)) {
      setCheckoutError('Stok tidak cukup untuk jumlah ' + cartItem.qty + ' ' + newUnit + ' "' + product.name + '".')
      return
    }
    setCart((current) => {
      return current.map((item) => item.productId === productId && item.unit === oldUnit
        ? {
            ...item,
            unit: newUnit,
            price: saleUnitPrice(product, newUnit),
            cost: unitCost(product, newUnit),
          }
        : item)
    })
    setCheckoutError('')
  }

  async function checkout() {
    if (operationLock.current) return
    setCheckoutError('')
    if (!customers.some((customer) => customer.name === customerName)) {
      setCheckoutError('Pilih nama pelanggan yang masih tersedia dari tab Setting.')
      return
    }
    if (cart.length === 0) { setCheckoutError('Keranjang masih kosong.'); return }
    if (paymentType === 'cash' && change < 0) { setCheckoutError('Uang tunai kurang dari total belanja.'); return }
    if (paymentType === 'credit' && (paidNow < 0 || paidNow > total)) {
      setCheckoutError('Pembayaran awal harus antara Rp0 dan total belanja.')
      return
    }

    const now = new Date().toISOString()
    const initialPayment = paymentType === 'cash' ? total : paidNow
    const remaining = total - initialPayment
    const sale = {
      customerName: customerName.trim(),
      paymentType,
      items: cart.map((c) => ({ productId: c.productId, name: c.name, unit: c.unit, price: c.price, cost: c.cost, qty: c.qty })),
      total,
      payment: paidNow,
      paidAmount: initialPayment,
      balanceDue: remaining,
      payments: initialPayment > 0 ? [{ amount: initialPayment, date: now }] : [],
      change: paymentType === 'cash' ? change : 0
    }
    const requestFingerprint = JSON.stringify({
      customerName: sale.customerName,
      paymentType,
      payment: paidNow,
      cart: cart.map(({ productId, unit, price, qty }) => [productId, unit, price, qty])
    })
    if (saleRequest.current?.fingerprint !== requestFingerprint) {
      saleRequest.current = { fingerprint: requestFingerprint, id: crypto.randomUUID() }
    }
    operationLock.current = true
    setSaving(true)
    try {
      const txId = await completeSale(sale, cart, saleRequest.current.id)
      saleRequest.current = null
      const completedTransaction = {
        ...sale,
        id: txId,
        invoiceNo: getInvoiceNumber({ ...sale, id: txId, createdAt: now }),
        createdAt: now
      }
      setHistory((current) => [completedTransaction, ...current])
      setDone({
        id: txId,
        total,
        payment: initialPayment,
        change: paymentType === 'cash' ? change : 0,
        balance: remaining,
        paymentType
      })
      setCart([])
      setPay('')
      setCustomerName('')
      setPaymentType('cash')
    } catch (error) {
      setCheckoutError('Transaksi gagal disimpan: ' + error.message)
    } finally {
      operationLock.current = false
      setSaving(false)
    }
  }

  async function recordInstallment(e) {
    e.preventDefault()
    if (operationLock.current) return
    setInstallmentError('')
    const amount = Number(installmentAmount)
    const balance = getBalanceDue(installmentTransaction)
    if (!Number.isFinite(amount) || amount <= 0) {
      setInstallmentError('Masukkan jumlah pembayaran yang lebih dari Rp0.')
      return
    }
    if (amount > balance) {
      setInstallmentError('Pembayaran tidak boleh melebihi sisa utang ' + rupiah(balance) + '.')
      return
    }

    const requestFingerprint = installmentTransaction.id + ':' + amount
    if (installmentRequest.current?.fingerprint !== requestFingerprint) {
      installmentRequest.current = { fingerprint: requestFingerprint, id: crypto.randomUUID() }
    }
    operationLock.current = true
    setSaving(true)
    try {
      await recordTransactionPayment(
        installmentTransaction.id,
        amount,
        installmentRequest.current.id
      )
      installmentRequest.current = null
      setInstallmentTransaction(null)
      setInstallmentAmount('')
    } catch (error) {
      setInstallmentError('Gagal menyimpan cicilan: ' + error.message)
    } finally {
      operationLock.current = false
      setSaving(false)
    }
  }

  const summaryTransactions = history.filter((t) => isToday(t.createdAt))
  const summaryOmzet = summaryTransactions.reduce((s, t) => s + t.total, 0)

  return (
    <div className="page">
      <div className="page-toolbar">
        <p className="muted">Hari ini <strong>{summaryTransactions.length} transaksi</strong> · {rupiah(summaryOmzet)}</p>
      </div>

      <div className="pos-grid">
        <div>
          <input className="input search" placeholder="Cari tas... (stok 0 disembunyikan)"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="product-grid">
            {filtered.length === 0 && <p className="muted">Tidak ada produk. Tambahkan di menu Stok Barang.</p>}
            {filtered.map((p) => (
              <article key={p.id} className="product-card">
                {p.image_path ? (
                  <img className="product-card-image" src={getProductImageUrl(p.image_path)} alt="" />
                ) : (
                  <div className="product-illustration"><Icon name="bag" size={28} /></div>
                )}
                <strong>{p.name}</strong>
                <span className="muted small">{p.category || 'Umum'} · stok {stockLabel(p)}</span>
                <div className="product-sale-options" aria-label={'Satuan dan harga ' + p.name}>
                  {saleUnits(p.unit || 'pcs').map((unit) => (
                    <button
                      key={unit}
                      className="product-sale-option"
                      type="button"
                      disabled={!canAddOne(p.id, unit)}
                      onClick={() => addToCart(p, unit)}>
                      <span>+ {unit}</span>
                      <strong>{rupiah(saleUnitPrice(p, unit))}/{unit}</strong>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="card cart">
          <h3>Keranjang</h3>
          {cart.length === 0 && <p className="muted">Klik produk untuk menambahkan.</p>}
          {cart.map((c) => (
            <div key={c.productId + '-' + c.unit} className="cart-row">
              <div className="cart-info">
                <strong>{c.name}</strong>
                <div className="cart-item-meta">
                  <span className="muted small">{rupiah(c.price)} / {c.unit}</span>
                  <select
                    className="input cart-unit-select"
                    aria-label={'Satuan jual ' + c.name}
                    value={c.unit}
                    onChange={(event) => changeCartUnit(c.productId, c.unit, event.target.value)}>
                    {c.saleUnits.map((unit) => (
                      <option
                        key={unit}
                        value={unit}
                        disabled={unit !== c.unit && maxCartQuantity(c.productId, unit, c.unit) < c.qty}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="cart-item-bottom">
                <div className="qty-ctrl">
                  <button aria-label={'Kurangi jumlah ' + c.name} onClick={() => setQty(c.productId, c.unit, c.qty - 1)}>
                    <Icon name="minus" size={15} />
                  </button>
                  <span>{c.qty} {c.unit}</span>
                  <button
                    aria-label={'Tambah jumlah ' + c.name}
                    disabled={c.qty >= maxCartQuantity(c.productId, c.unit)}
                    onClick={() => setQty(c.productId, c.unit, c.qty + 1)}>
                    <Icon name="plus" size={15} />
                  </button>
                </div>
                <span className="cart-sub">{rupiah(c.price * c.qty)}</span>
              </div>
            </div>
          ))}

          <label>Nama pelanggan *</label>
          <CustomerSelect
            customers={customers}
            value={customerName}
            onChange={setCustomerName}
          />
          <label>Metode pembayaran</label>
          <select className="input" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
            <option value="cash">Tunai</option>
            <option value="credit">Kredit tanpa bunga</option>
          </select>
          <div className="cart-total">
            <span>Total</span>
            <strong className="accent">{rupiah(total)}</strong>
          </div>
          <label>{paymentType === 'cash' ? 'Uang tunai diterima' : 'Pembayaran awal / DP'}</label>
          <MoneyInput value={pay} onChange={setPay}
            placeholder={paymentType === 'cash' ? total ? String(total) : '0' : '0 jika belum membayar'} />
          {paymentType === 'cash' ? (
            <div className={'change ' + (change < 0 ? 'negative' : '')}>
              Kembalian: <strong>{rupiah(change < 0 ? 0 : change)}</strong>
            </div>
          ) : (
            <div className="change credit-balance">Sisa kredit: <strong>{rupiah(Math.max(0, total - paidNow))}</strong></div>
          )}
          {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
          <button className="btn btn-primary btn-block btn-lg" onClick={checkout} disabled={cart.length === 0 || !customerName || saving}>
            {saving ? 'Menyimpan…' : <><Icon name="bolt" size={17} /> Simpan Transaksi</>}
          </button>
        </div>
      </div>

      {done && (
        <div className="overlay" onClick={() => setDone(null)}>
          <div className="modal center-text" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon"><Icon name="check" size={32} /></div>
            <h3>Transaksi #{done.id} Berhasil</h3>
            <p className="muted">Total {rupiah(done.total)} · Dibayar {rupiah(done.payment)}
              {done.paymentType === 'credit' ? ' · Sisa kredit ' + rupiah(done.balance) : ' · Kembali ' + rupiah(done.change)}
            </p>
            <button className="btn btn-primary" onClick={() => {
              const transaction = history.find((item) => item.id === done.id)
              if (transaction) setPreviewTransaction(transaction)
            }}>Cetak struk</button>
            <button className="btn btn-primary" onClick={() => setDone(null)}>Tutup</button>
          </div>
        </div>
      )}

      {installmentTransaction && (
        <div className="overlay" onClick={() => setInstallmentTransaction(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={recordInstallment}>
            <h3>Catat cicilan</h3>
            <p className="muted small">{installmentTransaction.customerName} · Transaksi #{installmentTransaction.id}</p>
            <p className="installment-balance">Sisa utang <strong>{rupiah(getBalanceDue(installmentTransaction))}</strong></p>
            <label>Jumlah pembayaran</label>
            <MoneyInput value={installmentAmount} onChange={setInstallmentAmount}
              placeholder="Masukkan nominal pembayaran" required autoFocus />
            {installmentError && <p className="form-error" role="alert">{installmentError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setInstallmentTransaction(null)}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan pembayaran'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewTransaction && (
        <div className="overlay receipt-preview-overlay" onClick={() => setPreviewTransaction(null)}>
          <section
            className="receipt-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-preview-title"
            onClick={(event) => event.stopPropagation()}>
            <header className="receipt-preview-heading">
              <div>
                <h3 id="receipt-preview-title">Pratinjau struk</h3>
                <p className="muted small">Ukuran cetak 24 × 14 cm · continuous form</p>
              </div>
              <button className="btn" onClick={() => setPreviewTransaction(null)}>Tutup</button>
            </header>
            <div className="receipt-preview-paper">
              <Receipt transaction={previewTransaction} />
            </div>
            <footer className="receipt-preview-actions">
              <button className="btn" onClick={() => setPreviewTransaction(null)}>Batal</button>
              <button className="btn btn-primary" onClick={() => window.print()}>Cetak</button>
            </footer>
          </section>
        </div>
      )}
      {selectedTransaction && (
        <TransactionDetails transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
      )}
    </div>
  )
}

function getPaidAmount(transaction) {
  if (transaction.paidAmount != null && Number.isFinite(Number(transaction.paidAmount))) {
    return Number(transaction.paidAmount)
  }
  return Math.min(Number(transaction.total) || 0, Number(transaction.payment) || 0)
}

function getBalanceDue(transaction) {
  if (transaction.balanceDue != null && Number.isFinite(Number(transaction.balanceDue))) {
    return Number(transaction.balanceDue)
  }
  return Math.max(0, (Number(transaction.total) || 0) - getPaidAmount(transaction))
}
