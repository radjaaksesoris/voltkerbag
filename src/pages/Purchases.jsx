import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createVendorPayable,
  getAll,
  getLatestStockPurchaseUnitCost,
  getPurchaseEntries,
  onRefresh,
  put,
  recordCreditStockPurchase,
  recordStockPurchase,
  removePurchaseEntry,
  requestPageRefresh
} from '../db'
import { dateOnly, rupiah } from '../format'
import { dateRangeTimestamps, localDateValue } from '../dateFilter'
import MoneyInput from '../components/MoneyInput.jsx'
import VendorSelect from '../components/VendorSelect.jsx'
import Icon from '../components/Icon.jsx'
import { formatPurchaseNote, parsePurchaseNote } from '../purchaseNote.js'
import { isSafeRupiahAmount } from '../money.js'
import { purchaseCostFactor, purchaseCostUnit, purchaseCostPerPiece, quantityToPcs } from '../productUnits.js'

const PURCHASE_CATEGORY = 'Pembelian bahan produksi'
const PURCHASE_PAGE_SIZE = 20

export default function Purchases() {
  const [entries, setEntries] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [vendorLoadError, setVendorLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [status, setStatus] = useState('')
  const [purchaseFormCollapsed, setPurchaseFormCollapsed] = useState(true)
  const [purchaseType, setPurchaseType] = useState('stock')
  const [paymentType, setPaymentType] = useState('cash')
  const [products, setProducts] = useState([])
  const [productLoadError, setProductLoadError] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [previousUnitCost, setPreviousUnitCost] = useState(null)
  const [previousUnitCostLoading, setPreviousUnitCostLoading] = useState(false)
  const [previousUnitCostError, setPreviousUnitCostError] = useState('')
  const [materialName, setMaterialName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [vendors, setVendors] = useState([])
  const [amount, setAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => localDateValue(new Date()))
  const [saving, setSaving] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState(null)
  const requestId = useRef(0)
  const vendorRequestId = useRef(0)
  const savingLock = useRef(false)
  const deletingLock = useRef(false)
  const purchaseRequest = useRef(null)

  useEffect(() => {
    if (!status) return undefined
    const timeout = window.setTimeout(() => setStatus(''), 3000)
    return () => window.clearTimeout(timeout)
  }, [status])

  useEffect(() => {
    let active = true

    async function load() {
      const request = ++requestId.current
      try {
        const result = await getPurchaseEntries(page, PURCHASE_PAGE_SIZE)
        if (!active || request !== requestId.current) return
        const pageCount = Math.max(1, Math.ceil(result.totalCount / PURCHASE_PAGE_SIZE))
        if (page > pageCount) {
          setPage(pageCount)
          return
        }
        setEntries(result.entries)
        setTotalCount(result.totalCount)
        setLoadError('')
      } catch (error) {
        if (active && request === requestId.current) {
          setLoadError(error.message || 'Gagal memuat riwayat pembelian bahan.')
        }
      } finally {
        if (active && request === requestId.current) setLoaded(true)
      }
    }

    async function loadMasters() {
      const request = ++vendorRequestId.current
      const [vendorResult, productResult] = await Promise.allSettled([getAll('vendors'), getAll('products')])
      if (!active || request !== vendorRequestId.current) return
      if (vendorResult.status === 'fulfilled') {
        setVendors(vendorResult.value)
        setVendorLoadError('')
      } else {
        setVendorLoadError(vendorResult.reason?.message || 'Gagal memuat daftar vendor.')
      }
      if (productResult.status === 'fulfilled') {
        setProducts(productResult.value)
        setProductLoadError('')
      } else {
        setProductLoadError(productResult.reason?.message || 'Gagal memuat daftar barang.')
      }
    }

    load()
    loadMasters()
    const unsubscribe = onRefresh(() => {
      load()
      loadMasters()
    }, 'purchases')
    return () => {
      active = false
      unsubscribe()
    }
  }, [page])

  useEffect(() => {
    if (supplier && !vendors.some((vendor) => vendor.name === supplier)) setSupplier('')
  }, [supplier, vendors])

  useEffect(() => {
    if (productId && !products.some((product) => String(product.id) === productId)) {
      setProductId('')
    }
  }, [productId, products])

  useEffect(() => {
    const selectedProduct = products.find((product) => String(product.id) === productId)
    if (!selectedProduct) {
      setPreviousUnitCost(null)
      setPreviousUnitCostError('')
      setPreviousUnitCostLoading(false)
      return undefined
    }

    let active = true
    setPreviousUnitCost(null)
    setPreviousUnitCostError('')
    setPreviousUnitCostLoading(true)
    getLatestStockPurchaseUnitCost(selectedProduct.id)
      .then((latestCost) => {
        if (!active) return
        const costPerPiece = latestCost ?? Number(selectedProduct.cost)
        setPreviousUnitCost(Number.isFinite(costPerPiece) && costPerPiece > 0 ? costPerPiece : null)
      })
      .catch((error) => {
        if (active) setPreviousUnitCostError(error.message || 'Gagal memuat harga beli sebelumnya.')
      })
      .finally(() => {
        if (active) setPreviousUnitCostLoading(false)
      })

    return () => {
      active = false
    }
  }, [productId, products])

  async function savePurchase(event) {
    event.preventDefault()
    if (savingLock.current) return
    setActionError('')
    setStatus('')

    const cleanSupplier = supplier.trim()
    const numericAmount = Number(amount)

    if (vendorLoadError) {
      setActionError('Daftar vendor gagal dimuat. Muat ulang halaman sebelum menyimpan.')
      return
    }
    if (!vendors.some((vendor) => vendor.name === cleanSupplier)) {
      setActionError('Pilih vendor dari master vendor di tab Setting.')
      return
    }
    try {
      dateRangeTimestamps({ from: purchaseDate, to: purchaseDate })
    } catch (error) {
      setActionError(error.message || 'Pilih tanggal pembelian yang valid.')
      return
    }

    savingLock.current = true
    setSaving(true)
    try {
      if (purchaseType === 'stock') {
        const selectedProduct = products.find((product) => String(product.id) === productId)
        const numericQuantity = Number(quantity)
        const enteredUnitCost = Number(unitCost)
        if (!selectedProduct) throw new Error('Pilih barang yang tersedia di daftar produk.')
        if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
          throw new Error('Jumlah barang harus berupa bilangan bulat lebih dari nol.')
        }
        if (!isSafeRupiahAmount(enteredUnitCost, true)) {
          throw new Error('Harga beli per unit harus berupa rupiah utuh yang valid.')
        }
        const stockQuantity = quantityToPcs(numericQuantity, selectedProduct.unit || 'pcs')
        const unitCostPerPiece = purchaseCostPerPiece(selectedProduct.unit, enteredUnitCost)
        const expenseAmount = Math.round(stockQuantity * unitCostPerPiece)
        if (!Number.isSafeInteger(stockQuantity) || stockQuantity <= 0 || stockQuantity > 2147483647) {
          throw new Error('Jumlah barang melebihi batas stok yang dapat disimpan.')
        }
        if (!isSafeRupiahAmount(expenseAmount)) {
          throw new Error('Total pembelian harus berupa rupiah utuh lebih dari Rp0.')
        }
        const fingerprint = JSON.stringify([
          purchaseType, paymentType, selectedProduct.id, stockQuantity,
          unitCostPerPiece, cleanSupplier, purchaseDate
        ])
        if (purchaseRequest.current?.fingerprint !== fingerprint) {
          purchaseRequest.current = { fingerprint, id: crypto.randomUUID() }
        }
        if (paymentType === 'credit') {
          await recordCreditStockPurchase({
            productId: selectedProduct.id,
            quantityPcs: stockQuantity,
            unitCost: unitCostPerPiece,
            vendor: cleanSupplier,
            description: `${selectedProduct.name} · ${numericQuantity} ${selectedProduct.unit || 'pcs'}`,
            amount: expenseAmount,
            date: new Date(purchaseDate + 'T12:00:00').toISOString(),
            requestId: purchaseRequest.current.id
          })
        } else {
          await recordStockPurchase({
            productId: selectedProduct.id,
            quantityPcs: stockQuantity,
            unitCost: unitCostPerPiece,
            vendor: cleanSupplier,
            date: new Date(purchaseDate + 'T12:00:00').toISOString(),
            requestId: purchaseRequest.current.id
          })
        }
        purchaseRequest.current = null
      } else {
        const cleanMaterialName = materialName.trim()
        if (!cleanMaterialName) throw new Error('Nama pembelian wajib diisi.')
        if (!isSafeRupiahAmount(numericAmount)) {
          throw new Error('Total pembelian harus berupa rupiah utuh lebih dari Rp0.')
        }
        const fingerprint = JSON.stringify([
          purchaseType, paymentType, cleanMaterialName, cleanSupplier, numericAmount, purchaseDate
        ])
        if (purchaseRequest.current?.fingerprint !== fingerprint) {
          purchaseRequest.current = { fingerprint, id: crypto.randomUUID() }
        }
        if (paymentType === 'credit') {
          await createVendorPayable({
            vendorName: cleanSupplier,
            description: cleanMaterialName,
            amount: numericAmount,
            date: new Date(purchaseDate + 'T12:00:00').toISOString(),
            requestId: purchaseRequest.current.id
          })
        } else {
          await put('finance', {
            type: 'expense',
            category: PURCHASE_CATEGORY,
            note: formatPurchaseNote(cleanMaterialName, cleanSupplier),
            amount: numericAmount,
            date: new Date(purchaseDate + 'T12:00:00').toISOString(),
            refId: null,
            requestId: null
          })
        }
        purchaseRequest.current = null
      }
      setProductId('')
      setQuantity('')
      setUnitCost('')
      setMaterialName('')
      setSupplier('')
      setAmount('')
      setPurchaseDate(localDateValue(new Date()))
      setPaymentType('cash')
      setPage(1)
      setStatus('Berhasil disimpan')
    } catch (error) {
      setActionError(error.message || 'Gagal mencatat pembelian bahan.')
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }

  async function deletePurchase(entry) {
    if (deletingLock.current) return
    const purchase = parsePurchaseNote(entry.note)
    const stockEntry = Boolean(entry.requestId || entry.stockPurchase || purchase.stockPurchase)
    if (!confirm(
      'Hapus riwayat pembelian "' + purchase.purchase + '"?' +
      (stockEntry
        ? '\n\nStok dan nilai modal akan dikurangi sesuai stok yang masih tersedia. Jika stok tidak cukup, penghapusan ditolak.'
        : '\n\nCatatan pengeluaran terkait juga akan dihapus dari Keuangan.') +
      '\n\nTindakan ini tidak dapat dibatalkan.'
    )) return

    deletingLock.current = true
    setDeletingEntryId(entry.id)
    setActionError('')
    setStatus('')
    try {
      await removePurchaseEntry(entry.id)
      setStatus('Riwayat pembelian berhasil dihapus')
    } catch (error) {
      setActionError(error.message || 'Gagal menghapus riwayat pembelian.')
    } finally {
      deletingLock.current = false
      setDeletingEntryId(null)
    }
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat riwayat pembelian...</p></div>
  if (loadError) {
    return (
      <div className="page">
        <p className="form-error" role="alert">{loadError}</p>
        <button className="btn" type="button" onClick={() => requestPageRefresh('purchases')}>
          Coba lagi
        </button>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / PURCHASE_PAGE_SIZE))
  const pageStart = (page - 1) * PURCHASE_PAGE_SIZE
  const selectedProduct = products.find((product) => String(product.id) === productId)
  const estimatedStockPurchaseTotal = selectedProduct && Number.isInteger(Number(quantity)) && Number(quantity) > 0
    ? Math.round(
      quantityToPcs(Number(quantity), selectedProduct.unit || 'pcs') *
      purchaseCostPerPiece(selectedProduct.unit, Number(unitCost))
    )
    : 0

  return (
    <div className="page purchase-page">
      <section className={'card purchase-form-card' + (purchaseFormCollapsed ? ' is-collapsed' : '')}>
        <div className="purchase-heading">
          <h2>Pembelian</h2>
          <button
            className="purchase-form-toggle"
            type="button"
            aria-label={purchaseFormCollapsed ? 'Tampilkan formulir pembelian' : 'Sembunyikan formulir pembelian'}
            aria-expanded={!purchaseFormCollapsed}
            aria-controls="purchase-form"
            onClick={() => setPurchaseFormCollapsed((collapsed) => !collapsed)}>
            <Icon name={purchaseFormCollapsed ? 'chevronDown' : 'chevronUp'} size={20} />
          </button>
        </div>
        <form id="purchase-form" className="purchase-form" hidden={purchaseFormCollapsed} onSubmit={savePurchase}>
          <div className="purchase-form-grid">
            <div className="purchase-field">
              <label htmlFor="purchase-type">Jenis pembelian *</label>
              <select
                id="purchase-type"
                className="input"
                value={purchaseType}
                onChange={(event) => setPurchaseType(event.target.value)}
                disabled={saving}>
                <option value="stock">Barang masuk stok</option>
                <option value="non-stock">Bahan / pengeluaran non-stok</option>
              </select>
            </div>
            <div className="purchase-field">
              <label htmlFor="purchase-payment-type">Pembayaran *</label>
              <select
                id="purchase-payment-type"
                className="input"
                value={paymentType}
                onChange={(event) => setPaymentType(event.target.value)}
                disabled={saving}>
                <option value="cash">Tunai / sudah dibayar</option>
                <option value="credit">Kredit / belum dibayar</option>
              </select>
            </div>
            {purchaseType === 'stock' ? (
              <>
                <div className="purchase-field">
                  <label htmlFor="purchase-product">Barang *</label>
                  {productLoadError ? (
                    <p className="form-error" role="alert">{productLoadError}</p>
                  ) : (
                    <select
                      id="purchase-product"
                      className="input"
                      value={productId}
                      onChange={(event) => {
                        setProductId(event.target.value)
                        setQuantity('')
                        setUnitCost('')
                      }}
                      disabled={saving || products.length === 0}
                      required>
                      <option value="">Pilih barang</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  )}
                  {products.length === 0 && !productLoadError && (
                    <p className="muted small purchase-vendor-hint">Tambahkan barang terlebih dahulu di menu Produk.</p>
                  )}
                </div>
                <div className="purchase-field">
                  <label htmlFor="purchase-quantity">Jumlah {selectedProduct ? `(${selectedProduct.unit || 'pcs'})` : ''} *</label>
                  <input
                    id="purchase-quantity"
                    className="input"
                    type="number"
                    inputMode="none"
                    data-custom-numpad="integer"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Masukkan jumlah"
                    required
                    disabled={saving || !selectedProduct}
                  />
                </div>
                <div className="purchase-field">
                  <label htmlFor="purchase-unit-cost">Harga beli per {selectedProduct ? purchaseCostUnit(selectedProduct.unit) : 'unit'} *</label>
                  <MoneyInput
                    id="purchase-unit-cost"
                    value={unitCost}
                    onChange={setUnitCost}
                    placeholder="Masukkan harga beli"
                    required
                    disabled={saving || !selectedProduct}
                  />
                  {previousUnitCostLoading ? (
                    <p className="muted small purchase-previous-cost">Memuat harga beli sebelumnya...</p>
                  ) : previousUnitCostError ? (
                    <p className="form-error small purchase-previous-cost" role="alert">{previousUnitCostError}</p>
                  ) : (
                    <p className="muted small purchase-previous-cost">
                      Harga beli sebelumnya:{' '}
                      <strong>
                        {previousUnitCost == null || !selectedProduct
                          ? 'Belum ada riwayat'
                          : `${rupiah(previousUnitCost * purchaseCostFactor(selectedProduct.unit))} / ${purchaseCostUnit(selectedProduct.unit)}`}
                      </strong>
                    </p>
                  )}
                </div>
                <div className="purchase-field purchase-total-field">
                  <label>{paymentType === 'credit' ? 'Total tagihan' : 'Total pembelian'}</label>
                  <p className="purchase-calculated-total">{rupiah(estimatedStockPurchaseTotal)}</p>
                </div>
              </>
            ) : (
              <>
                <div className="purchase-field">
                  <label htmlFor="purchase-material">Pembelian *</label>
                  <input
                    id="purchase-material"
                    className="input"
                    value={materialName}
                    onChange={(event) => setMaterialName(event.target.value)}
                    maxLength={200}
                    placeholder="Contoh: kain, bahan mentah"
                    required
                    disabled={saving}
                  />
                </div>
                <div className="purchase-field">
                  <label htmlFor="purchase-amount">Nominal *</label>
                  <MoneyInput
                    id="purchase-amount"
                    value={amount}
                    onChange={setAmount}
                    placeholder="Masukan nominal"
                    required
                    disabled={saving}
                  />
                </div>
              </>
            )}
            <div className="purchase-field">
              <label htmlFor="purchase-vendor">Vendor *</label>
              {vendorLoadError ? (
                <p className="form-error" role="alert">{vendorLoadError}</p>
              ) : (
                <VendorSelect
                  vendors={vendors}
                  id="purchase-vendor"
                  value={supplier}
                  onChange={setSupplier}
                  fieldName="Vendor"
                  placeholder="Pilih vendor"
                  disabled={saving || vendors.length === 0}
                />
              )}
              {vendors.length === 0 && !vendorLoadError && (
                <p className="muted small purchase-vendor-hint">Tambahkan vendor terlebih dahulu di tab Setting.</p>
              )}
            </div>
            <div className="purchase-field">
              <label htmlFor="purchase-date">Tanggal *</label>
              <input
                id="purchase-date"
                className="input"
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                required
              />
            </div>
          </div>
          {actionError && <p className="form-error" role="alert">{actionError}</p>}
          <button
            className="btn btn-primary purchase-submit"
            type="submit"
            disabled={saving || (purchaseType === 'stock' && (products.length === 0 || Boolean(productLoadError)))}>
            {saving ? 'Menyimpan...' : 'Simpan pembelian'}
          </button>
        </form>
      </section>
      {status && createPortal(
        <div className="purchase-toast" role="status" aria-live="polite">
          <Icon name="check" size={17} />
          <span>{status}</span>
        </div>,
        document.body
      )}

      <section className="card table-card purchase-history-card">
        <div className="purchase-history-heading">
          <div>
            <h3>Riwayat pembelian</h3>
          </div>
          <span className="settings-count">{totalCount} catatan</span>
        </div>
        <table className="purchase-table">
          <thead>
            <tr><th>No.</th><th>Pembelian</th><th>Tanggal</th><th>Nominal</th><th>Vendor</th></tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan="5" className="muted center">Belum ada pembelian bahan yang dicatat.</td></tr>
            ) : entries.map((entry, index) => {
              const purchase = parsePurchaseNote(entry.note)
              const stockPurchase = purchase.stockPurchase || entry.stockPurchase
              const purchaseKind = stockPurchase || entry.requestId ? 'Masuk stok' : 'Non-stok'
              const payableStatus = entry.purchaseSource === 'payable'
                ? Number(entry.payableBalance) > 0
                  ? `Kredit · sisa ${rupiah(entry.payableBalance)}`
                  : 'Lunas'
                : 'Tunai'
              return (
                <tr key={entry.id}>
                  <td className="purchase-row-number" data-label="No.">{pageStart + index + 1}</td>
                  <td className="purchase-details" data-label="Pembelian">
                    <div className="purchase-item-heading">
                      <div className="purchase-item-main">
                        <span className="purchase-item-title">{purchase.purchase}</span>
                        <button
                          className="btn btn-sm btn-danger purchase-delete-button"
                          type="button"
                          aria-label={'Hapus pembelian ' + purchase.purchase}
                          title={entry.purchaseSource === 'payable'
                            ? 'Pembelian kredit tidak dapat dihapus dari riwayat ini'
                            : 'Hapus riwayat pembelian'}
                          disabled={entry.purchaseSource === 'payable' || deletingEntryId !== null}
                          onClick={() => deletePurchase(entry)}>
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                      <div className="purchase-item-meta">
                        <span className="purchase-item-type">{purchaseKind}</span>
                        <span className={'purchase-payment-status' + (entry.purchaseSource === 'payable' ? ' is-credit' : '')}>
                          {payableStatus}
                        </span>
                        {stockPurchase && (
                          <span className="purchase-item-stock-meta">
                            {stockPurchase.quantityPcs} pcs · {rupiah(stockPurchase.unitCostPerPiece)}/pcs
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td data-label="Tanggal">{dateOnly(entry.date || entry.createdAt)}</td>
                  <td className="danger" data-label="Nominal">{rupiah(entry.amount)}</td>
                  <td className="purchase-details" data-label="Vendor">{purchase.vendor}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totalCount > 0 && (
          <div className="dashboard-pagination">
            <span className="muted small">
              Menampilkan {pageStart + 1}–{Math.min(pageStart + PURCHASE_PAGE_SIZE, totalCount)} dari {totalCount} pembelian
            </span>
            {pageCount > 1 && (
              <div className="dashboard-pagination-controls" aria-label="Navigasi halaman riwayat pembelian">
                <button className="btn btn-sm" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Sebelumnya
                </button>
                <span className="small">Halaman {page} dari {pageCount}</span>
                <button className="btn btn-sm" type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>
                  Berikutnya
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
