import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAll, getProductImageUrl, getProductThumbnailUrl, completeSale, recordTransactionPayment, onRefresh, requestPageRefresh } from '../db'
import { rupiah } from '../format'
import ReceiptPreview from '../components/ReceiptPreview'
import Icon from '../components/Icon.jsx'
import TransactionDetails from '../components/TransactionDetails'
import { getInvoiceNumber } from '../invoice'
import MoneyInput from '../components/MoneyInput.jsx'
import CustomerSelect from '../components/CustomerSelect.jsx'
import SelectInput from '../components/SelectInput.jsx'
import CustomerIdentity from '../components/CustomerIdentity.jsx'
import { saleUnitPrice, saleUnits, stockInPcs, stockLabel, unitCost, unitFactor } from '../productUnits'
import { downloadInvoiceJpeg } from '../invoiceJpeg'
import { isSafeRupiahAmount } from '../money'

const PRODUCT_BATCH_SIZE = 20
const PRODUCT_NAME_COLLATOR = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

export default function Transactions() {
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [expeditions, setExpeditions] = useState([])
  const [cart, setCart] = useState([])
  const [cartNotification, setCartNotification] = useState(null)
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [previewProduct, setPreviewProduct] = useState(null)
  const [q, setQ] = useState('')
  const [pay, setPay] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [expeditionName, setExpeditionName] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [checkoutError, setCheckoutError] = useState('')
  const [done, setDone] = useState(null)
  const [invoiceDownloading, setInvoiceDownloading] = useState(false)
  const [invoiceDownloadError, setInvoiceDownloadError] = useState('')
  const [invoiceDownloadStatus, setInvoiceDownloadStatus] = useState('')
  const [installmentTransaction, setInstallmentTransaction] = useState(null)
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentError, setInstallmentError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewTransaction, setPreviewTransaction] = useState(null)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [visibleProductCount, setVisibleProductCount] = useState(PRODUCT_BATCH_SIZE)
  const operationLock = useRef(false)
  const saleRequest = useRef(null)
  const installmentRequest = useRef(null)
  const productSearchRef = useRef(null)
  const transactionsPageRef = useRef(null)
  const productScrollTop = useRef(0)
  const cartNotificationTimeout = useRef(null)
  const cartNotificationRef = useRef(null)
  const [loadError, setLoadError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [notificationPosition, setNotificationPosition] = useState(null)

  useEffect(() => () => window.clearTimeout(cartNotificationTimeout.current), [])

  useLayoutEffect(() => {
    if (!cartNotification) {
      setNotificationPosition(null)
      return undefined
    }

    function positionNotification() {
      const toolbarBounds = transactionsPageRef.current
        ?.querySelector('.pos-products-toolbar')
        ?.getBoundingClientRect()
      const notification = cartNotificationRef.current
      if (!notification) {
        setNotificationPosition(null)
        return
      }

      if (!toolbarBounds?.width) {
        setNotificationPosition({
          top: 'auto',
          right: 16,
          bottom: 20,
          left: 'auto',
          maxWidth: 'min(420px, calc(100vw - 32px))',
          width: 'fit-content',
          height: 'auto',
          maxHeight: 'none'
        })
        return
      }

      const maxWidth = Math.min(420, toolbarBounds.width, window.innerWidth - 32)
      const notificationWidth = Math.min(notification.scrollWidth, maxWidth)
      const notificationHeight = notification.getBoundingClientRect().height
      const notificationCenterY = Math.max(
        notificationHeight / 2 + 8,
        Math.min(
          window.innerHeight - notificationHeight / 2 - 8,
          toolbarBounds.bottom + 8 + notificationHeight / 2
        )
      )
      setNotificationPosition({
        top: notificationCenterY,
        left: Math.max(16, toolbarBounds.left + (toolbarBounds.width - notificationWidth) / 2),
        right: 'auto',
        bottom: 'auto',
        maxWidth,
        width: 'max-content',
        height: 'auto',
        maxHeight: 'none'
      })
    }

    positionNotification()
    window.addEventListener('resize', positionNotification)
    window.addEventListener('scroll', positionNotification, true)
    return () => {
      window.removeEventListener('resize', positionNotification)
      window.removeEventListener('scroll', positionNotification, true)
    }
  }, [cartNotification, previewProduct])

  useEffect(() => {
    if (!previewProduct) return undefined
    function handlePreviewKeyDown(event) {
      if (event.key === 'Escape') setPreviewProduct(null)
    }
    window.addEventListener('keydown', handlePreviewKeyDown)
    return () => window.removeEventListener('keydown', handlePreviewKeyDown)
  }, [previewProduct])

  async function load() {
    try {
      const [productRows, customerRows, expeditionRows] = await Promise.all([
        getAll('products'),
        getAll('customers'),
        getAll('expeditions')
      ])
      setProducts(productRows)
      setCustomers(customerRows)
      setExpeditions(expeditionRows)
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat data kasir dari server.')
    } finally {
      setLoaded(true)
    }
  }
  useEffect(() => {
    load()
    return onRefresh(load, 'pos')
  }, [])

  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const cartStockByProduct = useMemo(() => {
    const stockByProduct = new Map()
    for (const item of cart) {
      let productStock = stockByProduct.get(item.productId)
      if (!productStock) {
        productStock = { totalPcs: 0, byUnit: new Map() }
        stockByProduct.set(item.productId, productStock)
      }
      const quantityInPcs = item.qty * unitFactor(item.unit)
      productStock.totalPcs += quantityInPcs
      productStock.byUnit.set(item.unit, (productStock.byUnit.get(item.unit) || 0) + quantityInPcs)
    }
    return stockByProduct
  }, [cart])

  function remainingStockPcs(productId, excludedUnit) {
    const product = productsById.get(productId)
    if (!product) return 0
    const productStock = cartStockByProduct.get(productId)
    const reserved = productStock
      ? productStock.totalPcs - (productStock.byUnit.get(excludedUnit) || 0)
      : 0
    return Math.max(0, stockInPcs(product) - reserved)
  }

  function maxCartQuantity(productId, unit, excludedUnit = unit) {
    return Math.floor(remainingStockPcs(productId, excludedUnit) / unitFactor(unit))
  }

  function canAddOne(productId, unit) {
    const existingQty = (cartStockByProduct.get(productId)?.byUnit.get(unit) || 0) / unitFactor(unit)
    return maxCartQuantity(productId, unit) > existingQty
  }

  const searchableProducts = useMemo(
    () => products
      .map((product) => ({
        product,
        searchName: product.name.toLowerCase(),
        inStock: stockInPcs(product) > 0
      }))
      .sort((left, right) => PRODUCT_NAME_COLLATOR.compare(left.product.name, right.product.name)),
    [products]
  )
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return searchableProducts
      .filter(({ searchName, inStock }) => inStock && searchName.includes(query))
      .map(({ product }) => product)
  }, [searchableProducts, q])
  const visibleProducts = filtered.slice(0, visibleProductCount)

  function switchMobileView(showCart) {
    setMobileCartOpen(showCart)
    if (!window.matchMedia('(max-width: 640px)').matches) return
    const content = transactionsPageRef.current?.closest('.content')
    if (showCart && content) productScrollTop.current = content.scrollTop
    requestAnimationFrame(() => {
      if (content) content.scrollTop = showCart ? 0 : productScrollTop.current
    })
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat data dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => requestPageRefresh('pos')}>Coba lagi</button>
    </div>
  }

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
    const nextQuantity = (found?.qty || 0) + 1
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
    setCartNotification({ name: p.name, qty: nextQuantity, unit })
    window.clearTimeout(cartNotificationTimeout.current)
    cartNotificationTimeout.current = window.setTimeout(() => setCartNotification(null), 2400)
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

  async function downloadInvoice(transaction) {
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

  async function checkout() {
    if (operationLock.current) return
    setCheckoutError('')
    if (!customers.some((customer) => customer.name === customerName)) {
      setCheckoutError('Pilih nama pelanggan yang masih tersedia dari tab Setting.')
      return
    }
    if (expeditionName && !expeditions.some((expedition) => expedition.name === expeditionName)) {
      setCheckoutError('Pilih ekspedisi yang masih tersedia dari tab Setting.')
      return
    }

    if (cart.length === 0) { setCheckoutError('Keranjang masih kosong.'); return }
    if (!isSafeRupiahAmount(total, true) || cart.some((item) => !isSafeRupiahAmount(item.price))) {
      setCheckoutError('Total transaksi melebihi batas nominal rupiah yang aman. Periksa harga produk.')
      return
    }
    if (!isSafeRupiahAmount(paidNow, true)) {
      setCheckoutError('Nominal pembayaran harus rupiah utuh dan tidak melebihi batas aman.')
      return
    }
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
      customerPhone: customers.find((customer) => customer.name === customerName)?.phone || '',
      customerAddress: customers.find((customer) => customer.name === customerName)?.address || '',
      expedition: expeditionName,
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
      expedition: sale.expedition,
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
      setDone({
        id: txId,
        total,
        payment: paidNow,
        change: paymentType === 'cash' ? change : 0,
        balance: remaining,
        paymentType,
        transaction: completedTransaction
      })
      setCart([])
      setPay('')
      setCustomerName('')
      setExpeditionName('')
      setPaymentType('cash')
      switchMobileView(false)
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
    if (!isSafeRupiahAmount(amount)) {
      setInstallmentError('Masukkan pembayaran rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
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

  return (
    <div className="page transactions-page" ref={transactionsPageRef}>
      <div className={'pos-grid' + (mobileCartOpen ? ' mobile-cart-open' : '')}>
        <div className="pos-products">
          <div className="pos-products-toolbar">
            <div className="search-field">
              <input
                ref={productSearchRef}
                className="input search"
                placeholder="Cari Item Barang..."
                aria-label="Cari produk"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setVisibleProductCount(PRODUCT_BATCH_SIZE)
                }}
              />
              {q && (
                <button
                  className="search-clear"
                  type="button"
                  aria-label="Hapus pencarian"
                  title="Hapus pencarian"
                  onClick={() => {
                    setQ('')
                    setVisibleProductCount(PRODUCT_BATCH_SIZE)
                    productSearchRef.current?.focus()
                  }}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <button
              className="btn btn-primary mobile-cart-toggle"
              type="button"
              aria-label={mobileCartOpen ? 'Kembali ke daftar produk' : 'Buka keranjang, ' + cart.length + ' item'}
              aria-expanded={mobileCartOpen}
              onClick={() => switchMobileView(!mobileCartOpen)}>
              <Icon name={mobileCartOpen ? 'bag' : 'cart'} size={17} />
              <span>{mobileCartOpen ? 'Produk' : 'Keranjang'}</span>
              {!mobileCartOpen && <span className="mobile-cart-count">{cart.length}</span>}
            </button>
          </div>
          <div className="product-grid">
            {filtered.length === 0 && (
              <p className="muted">
                {products.length === 0
                  ? 'Belum ada produk. Tambahkan di menu Stok Barang.'
                  : q.trim()
                    ? 'Tidak ada produk tersedia yang cocok dengan pencarian.'
                    : 'Tidak ada produk dengan stok tersedia.'}
              </p>
            )}
            {visibleProducts.map((p, index) => (
              <article
                key={p.id}
                className="product-card"
                role="button"
                tabIndex={0}
                onClick={() => setPreviewProduct(p)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setPreviewProduct(p)
                  }
                }}>
                <div className="product-card-heading">
                  <div className="product-image-trigger">
                    {p.image_path ? (
                      <img
                        className="product-card-image"
                        src={getProductThumbnailUrl(p.image_path)}
                        onError={(event) => {
                          const image = event.currentTarget
                          const originalUrl = getProductImageUrl(p.image_path)
                          if (image.src !== originalUrl) image.src = originalUrl
                        }}
                        width="48"
                        height="48"
                        alt=""
                        loading={index < 8 ? 'eager' : 'lazy'}
                        fetchPriority={index < 4 ? 'high' : 'auto'}
                        decoding="async"
                      />
                    ) : (
                      <div className="product-illustration"><Icon name="bag" size={22} /></div>
                    )}
                  </div>
                  <div className="product-card-info">
                    <strong>{p.name}</strong>
                    <span className="muted small product-stock-label">Stok {compactStockLabel(p)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {filtered.length > 0 && (
            <div className="product-grid-pagination">
              <span className="muted">Menampilkan {visibleProducts.length} dari {filtered.length} produk</span>
              {visibleProducts.length < filtered.length && (
                <button
                  className="btn"
                  type="button"
                  onClick={() => setVisibleProductCount((count) => count + PRODUCT_BATCH_SIZE)}>
                  Tampilkan {Math.min(PRODUCT_BATCH_SIZE, filtered.length - visibleProducts.length)} produk lagi
                </button>
              )}
            </div>
          )}
        </div>

        <div className="card cart">
          <div className="cart-view-header">
            <strong>{cart.length} item · {rupiah(total)}</strong>
            <button className="btn cart-back-button" type="button" onClick={() => switchMobileView(false)}>
              <Icon name="arrowLeft" size={16} />
              <span>Back</span>
            </button>
          </div>
          <div className="cart-items">
            <div className="cart-items-heading">
              <strong>Item transaksi</strong>
              <span>{cart.length} item</span>
            </div>
            {cart.length > 6 && <p className="cart-items-scroll-hint">Gulir daftar ini untuk melihat semua item</p>}
            <div className={'cart-items-list' + (cart.length === 0 ? ' cart-items-list-empty' : '')}>
              {cart.length === 0 ? (
                <div className="cart-empty" role="img" aria-label="Keranjang kosong">
                  <Icon name="cart" size={42} />
                </div>
              ) : cart.map((c) => (
                <div key={c.productId + '-' + c.unit} className="cart-row">
                  <div className="cart-info">
                    <strong>{c.name}</strong>
                    <div className="cart-item-meta">
                      <span className="muted small">{rupiah(c.price)} / {c.unit}</span>
                      <SelectInput
                        className="cart-unit-select"
                        ariaLabel={'Satuan jual ' + c.name}
                        value={c.unit}
                        onChange={(unit) => changeCartUnit(c.productId, c.unit, unit)}
                        options={c.saleUnits.map((unit) => ({
                          value: unit,
                          label: unit,
                          disabled: unit !== c.unit && maxCartQuantity(c.productId, unit, c.unit) < c.qty
                        }))} />
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
            </div>
          </div>

          <div className="cart-checkout">
            <div className="cart-checkout-options">
              <div>
                <label>Nama pelanggan *</label>
                <CustomerSelect
                  customers={customers}
                  value={customerName}
                  onChange={setCustomerName}
                />
              </div>
              <div>
                <label>Metode pembayaran</label>
                <div className="payment-method-options" role="group" aria-label="Metode pembayaran">
                  <button
                    className="payment-method-option"
                    type="button"
                    aria-pressed={paymentType === 'cash'}
                    onClick={() => setPaymentType('cash')}>
                    Tunai
                  </button>
                  <button
                    className="payment-method-option"
                    type="button"
                    aria-pressed={paymentType === 'credit'}
                    onClick={() => setPaymentType('credit')}>
                    Kredit
                  </button>
                </div>
              </div>
            </div>
            {customerName && (
              <div className="checkout-customer-row">
                <CustomerIdentity
                  name={customerName}
                  customer={customers.find((customer) => customer.name === customerName)}
                  className="checkout-customer-identity"
                />
                <div className="checkout-expedition-field">
                  <label htmlFor="checkout-expedition">Ekspedisi</label>
                  <SelectInput
                    id="checkout-expedition"
                    ariaLabel="Ekspedisi"
                    className="checkout-expedition-select"
                    value={expeditionName}
                    disabled={expeditions.length === 0}
                    onChange={setExpeditionName}
                    placeholder={expeditions.length ? 'Pilih' : 'Atur di Setting'}
                    options={[
                      { value: '', label: 'Pilih' },
                      ...expeditions.map((expedition) => ({
                        value: expedition.name,
                        label: expedition.name
                      }))
                    ]} />
                </div>
              </div>
            )}
            <div className="cart-total">
              <span>Total</span>
              <strong className="accent">{rupiah(total)}</strong>
            </div>
            <label>{paymentType === 'cash' ? 'Total tunai diterima *' : 'Pembayaran awal / DP'}</label>
            <MoneyInput
              value={pay}
              onChange={setPay}
              placeholder={paymentType === 'cash' ? 'Masukkan jumlah tunai' : 'Opsional'}
            />
            {paymentType === 'cash' ? (
              <div className={'change ' + (change < 0 ? 'negative' : '')}>
                Kembalian: <strong>{rupiah(change < 0 ? 0 : change)}</strong>
              </div>
            ) : (
              <div className="change credit-balance">Sisa kredit: <strong>{rupiah(Math.max(0, total - paidNow))}</strong></div>
            )}
            {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
            <div className="cart-submit-bar">
              <button className="btn btn-primary btn-block btn-lg" onClick={checkout} disabled={cart.length === 0 || !customerName || (paymentType === 'cash' && pay === '') || saving}>
                {saving ? 'Menyimpan…' : <><Icon name="bolt" size={17} /> Simpan Transaksi</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {cartNotification && (
        createPortal(
          <div
            ref={cartNotificationRef}
            className="cart-notification cart-notification-in-header"
            style={notificationPosition || undefined}
            role="status"
            aria-live="polite">
            <Icon name="check" size={17} />
            <span><strong>{cartNotification.name}</strong> · {cartNotification.qty} {cartNotification.unit} di keranjang</span>
          </div>,
          document.body
        )
      )}

      {previewProduct && (
        createPortal(
          <div className="overlay product-quick-view-overlay" onClick={() => setPreviewProduct(null)}>
            <section
              className="modal product-quick-view-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-quick-view-title"
              onClick={(event) => event.stopPropagation()}>
              {previewProduct.image_path ? (
                <img
                  className="product-quick-view-image"
                  src={getProductImageUrl(previewProduct.image_path)}
                  alt={previewProduct.name}
                />
              ) : (
                <div className="product-quick-view-placeholder"><Icon name="bag" size={42} /></div>
              )}
              <div className="product-quick-view-info">
                <h3 id="product-quick-view-title">{previewProduct.name}</h3>
                <p className="muted small">{previewProduct.category || 'Umum'} · stok {stockLabel(previewProduct)}</p>
              </div>
              <div className="product-quick-view-units">
                <strong>Pilih satuan</strong>
                {saleUnits(previewProduct.unit || 'pcs').map((unit) => {
                  const quantityInCart = cart.find((item) => item.productId === previewProduct.id && item.unit === unit)?.qty || 0
                  return (
                    <div
                      key={unit}
                      className={'product-quick-view-unit' + (quantityInCart > 0 ? ' is-in-cart' : '')}
                    >
                      <span className="product-quick-view-unit-copy">
                        <strong>{unit}</strong>
                        <small>Di keranjang: {quantityInCart} {unit}</small>
                      </span>
                      <strong className="product-quick-view-unit-price">{rupiah(saleUnitPrice(previewProduct, unit))}</strong>
                      <div className="qty-ctrl product-quick-view-qty">
                        <button
                          type="button"
                          aria-label={'Kurangi jumlah ' + previewProduct.name + ' ' + unit}
                          disabled={quantityInCart === 0}
                          onClick={() => setQty(previewProduct.id, unit, quantityInCart - 1)}>
                          <Icon name="minus" size={15} />
                        </button>
                        <span>{quantityInCart}</span>
                        <button
                          type="button"
                          aria-label={'Tambah jumlah ' + previewProduct.name + ' ' + unit}
                          disabled={!canAddOne(previewProduct.id, unit)}
                          onClick={() => addToCart(previewProduct, unit)}>
                          <Icon name="plus" size={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button
                className="btn btn-primary product-quick-view-close"
                type="button"
                autoFocus
                onClick={() => setPreviewProduct(null)}>
                Tutup
              </button>
            </section>
          </div>,
          document.body
        )
      )}

      {done && (
        <div className="overlay" onClick={() => setDone(null)}>
          <div className="modal center-text" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon"><Icon name="check" size={32} /></div>
            <h3>Transaksi #{done.id} Berhasil</h3>
            <p className="muted">Total {rupiah(done.total)} · Dibayar {rupiah(done.payment)}
              {done.paymentType === 'credit' ? ' · Sisa kredit ' + rupiah(done.balance) : ' · Kembali ' + rupiah(done.change)}
            </p>
            {invoiceDownloadError && <p className="form-error" role="alert">{invoiceDownloadError}</p>}
            {invoiceDownloadStatus && <p className="backup-success" role="status">{invoiceDownloadStatus}</p>}
            <div className="success-actions">
              <button className="btn btn-primary" onClick={() => {
                setPreviewTransaction(done.transaction)
              }}>Cetak struk</button>
              <button
                className="btn"
                type="button"
                aria-label={invoiceDownloading ? 'Menyiapkan download faktur' : 'Download faktur'}
                title={invoiceDownloading ? 'Menyiapkan download faktur' : 'Download faktur'}
                disabled={invoiceDownloading}
                onClick={() => downloadInvoice(done.transaction)}>
                <Icon name="download" size={15} />
              </button>
              <button className="btn btn-primary" onClick={() => setDone(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}

      {installmentTransaction && (
        <div className="overlay" onClick={() => !saving && setInstallmentTransaction(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={recordInstallment}>
            <h3>Catat cicilan</h3>
            <p className="muted small installment-customer">
              <CustomerIdentity
                name={installmentTransaction.customerName}
                customer={customers.find((customer) => customer.name === installmentTransaction.customerName)}
              />
              <span>Transaksi #{installmentTransaction.id}</span>
            </p>
            <p className="installment-balance">Sisa utang <strong>{rupiah(getBalanceDue(installmentTransaction))}</strong></p>
            <label>Jumlah pembayaran</label>
            <MoneyInput value={installmentAmount} onChange={setInstallmentAmount}
              placeholder="Masukkan nominal pembayaran" required autoFocus />
            {installmentError && <p className="form-error" role="alert">{installmentError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" disabled={saving} onClick={() => setInstallmentTransaction(null)}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan pembayaran'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewTransaction && (
        <ReceiptPreview
          transaction={previewTransaction}
          onClose={() => {
            setPreviewTransaction(null)
            if (done && previewTransaction === done.transaction) setDone(null)
          }}
        />
      )}
      {selectedTransaction && (
        <TransactionDetails transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
      )}
    </div>
  )
}

function compactStockLabel(product) {
  const quantity = stockInPcs(product)
  const factor = unitFactor(product.unit || 'pcs')
  if (factor === 1 || String(product.unit || '').trim().toLocaleLowerCase('id-ID') === 'kodi') {
    return String(quantity)
  }
  return `${Math.floor(quantity / factor)}/${quantity % factor}`
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
