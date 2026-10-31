import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addProductStock, getAll, getProductImageUrl, put, remove, removeProductImage, setProductStock, updateProductDetails, uploadProductImage, onRefresh, requestPageRefresh } from '../db'
import { rupiah } from '../format'
import { isSafeRupiahAmount } from '../money'
import { compressProductImage } from '../productImage'
import MoneyInput from '../components/MoneyInput.jsx'
import CategorySelect from '../components/CategorySelect.jsx'
import UnitSelect from '../components/UnitSelect.jsx'
import Icon from '../components/Icon.jsx'
import { availableQuantity, isWholeStockQuantity, productMarkupPercentage, productPrice, purchaseCostFactor, purchaseCostPerPiece, purchaseCostUnit, quantityToPcs, saleMarkupPercentage, saleMarkupPrice, salePricesFromMarkups, saleUnitPrice, saleUnits, stockCostValue, stockEntryUnit, stockInPcs, stockReceiptValuation, unitFactor, stockLabel } from '../productUnits'

const EMPTY = {
  name: '',
  category: '',
  unit: 'lusin',
  price: '',
  markups: { pcs: '', lusin: '' },
  salePrices: { pcs: '', lusin: '' },
  cost: '',
  stock: '',
  image_path: null
}

const PRODUCT_NAME_COLLATOR = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

export default function Products() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [stockProduct, setStockProduct] = useState(null)
  const [actionMenuProductId, setActionMenuProductId] = useState(null)
  const [actionMenuPosition, setActionMenuPosition] = useState(null)
  const [stockAmount, setStockAmount] = useState('')
  const [stockUnitCost, setStockUnitCost] = useState('')
  const [stockSaving, setStockSaving] = useState(false)
  const [stockError, setStockError] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [imageRemoved, setImageRemoved] = useState(false)
  const [compressingImage, setCompressingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const nameInputRef = useRef(null)
  const originalImagePathRef = useRef(null)
  const categoryInputRef = useRef(null)
  const unitInputRef = useRef(null)
  const markupInputRefs = {
    pcs: useRef(null),
    lusin: useRef(null)
  }
  const salePriceInputRefs = {
    pcs: useRef(null),
    lusin: useRef(null)
  }
  const customPriceInputRef = useRef(null)
  const costInputRef = useRef(null)
  const stockInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const imageProcessingRef = useRef(false)
  const stockRequest = useRef(null)
  const actionButtonRef = useRef(null)
  const actionMenuRef = useRef(null)

  function updateActionMenuPosition() {
    if (!actionButtonRef.current) return
    const rect = actionButtonRef.current.getBoundingClientRect()
    const menuWidth = 148
    const leftOfButton = rect.left - menuWidth - 8
    const left = leftOfButton >= 8 ? leftOfButton : rect.right + 8
    const menuHeight = 132
    setActionMenuPosition({
      left: Math.min(left, window.innerWidth - menuWidth - 8),
      top: Math.min(
        Math.max(rect.top + rect.height / 2, menuHeight / 2 + 8),
        window.innerHeight - menuHeight / 2 - 8
      )
    })
  }

  useEffect(() => {
    if (actionMenuProductId === null) return

    function closeOnOutsideClick(event) {
      if (!(event.target instanceof Node)) return
      if (actionButtonRef.current?.contains(event.target) || actionMenuRef.current?.contains(event.target)) return
      setActionMenuProductId(null)
    }

    function closeOnEscape(event) {
      if (event.key !== 'Escape') return
      setActionMenuProductId(null)
      actionButtonRef.current?.focus()
    }

    updateActionMenuPosition()
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updateActionMenuPosition)
    window.addEventListener('scroll', updateActionMenuPosition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updateActionMenuPosition)
      window.removeEventListener('scroll', updateActionMenuPosition, true)
    }
  }, [actionMenuProductId])

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  useEffect(() => {
    if (!showForm && !stockProduct) return

    function preventBackgroundScroll(event) {
      if (event.target instanceof Element && event.target.closest('.modal')) return
      event.preventDefault()
    }

    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false })
    document.addEventListener('wheel', preventBackgroundScroll, { passive: false })
    return () => {
      document.removeEventListener('touchmove', preventBackgroundScroll)
      document.removeEventListener('wheel', preventBackgroundScroll)
    }
  }, [showForm, stockProduct])

  async function load() {
    try {
      const [productRows, categoryRows, unitRows] = await Promise.all([
        getAll('products'),
        getAll('categories'),
        getAll('units')
      ])
      setItems(productRows)
      setCategories(categoryRows)
      setUnits(unitRows.filter((unit) => (unit.name || '').trim().toLocaleLowerCase('id-ID') !== 'kodi'))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat produk dari server.')
    } finally {
      setLoaded(true)
    }
  }
  useEffect(() => {
    load()
    return onRefresh(load, 'stok')
  }, [])

  const filtered = items
    .filter((p) => (p.name + ' ' + (p.category || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((left, right) => PRODUCT_NAME_COLLATOR.compare(left.name, right.name))
  const lowStock = items.filter((p) => availableQuantity(p, p.unit || 'pcs') <= 5)
  const stockReceiptPreview = stockProduct && Number(stockAmount) > 0 && stockUnitCost !== '' && Number(stockUnitCost) >= 0
    ? stockReceiptValuation({
        stockPcs: stockInPcs(stockProduct),
        stockValue: stockCostValue(stockProduct),
        receiptPcs: quantityToPcs(Number(stockAmount), stockProduct.unit || 'pcs'),
        receiptUnitCost: purchaseCostPerPiece(stockProduct.unit, stockUnitCost)
      })
    : null

  function openEdit(p) {
    const baseUnit = p.unit || 'pcs'
    const editUnit = baseUnit.trim().toLocaleLowerCase('id-ID') === 'kodi' ? 'pcs' : baseUnit
    setEditId(p.id)
    originalImagePathRef.current = p.image_path || null
    setForm({
      name: p.name,
      category: p.category || '',
      unit: editUnit,
      price: p.price || '',
      markups: {
        pcs: productMarkupPercentage(p, 'pcs'),
        lusin: productMarkupPercentage(p, 'lusin')
      },
      salePrices: {
        pcs: productPrice(p, 'pcs'),
        lusin: productPrice(p, 'lusin')
      },
      cost: Math.round((Number(p.cost) || 0) * purchaseCostFactor(editUnit)),
      stock: String(saleUnits(editUnit).length === 2
        ? stockInPcs(p)
        : stockInPcs(p) / unitFactor(stockEntryUnit(editUnit))),
      image_path: p.image_path || null
    })
    setImageFile(null)
    setImagePreview('')
    setImageRemoved(false)
    if (imageInputRef.current) imageInputRef.current.value = ''
    setShowForm(true)
  }
  function openAdd() {
    setEditId(null)
    originalImagePathRef.current = null
    setForm(EMPTY)
    setImageFile(null)
    setImagePreview('')
    setImageRemoved(false)
    if (imageInputRef.current) imageInputRef.current.value = ''
    setShowForm(true)
  }

  function openAddStock(product) {
    setStockProduct(product)
    setStockAmount('')
    setStockUnitCost('')
    setStockError('')
  }

  async function addStock(event) {
    event.preventDefault()
    if (!stockProduct || stockSaving) return
    setStockError('')

    const amount = Number(stockAmount)
    const enteredUnitCost = Number(stockUnitCost)
    const unit = stockProduct.unit || 'pcs'
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      setStockError('Masukkan jumlah stok berupa bilangan bulat yang lebih dari nol.')
      return
    }
    if (!isSafeRupiahAmount(enteredUnitCost, true)) {
      setStockError('Harga modal harus rupiah utuh dan tidak melebihi batas nominal yang aman.')
      return
    }

    const unitCost = purchaseCostPerPiece(unit, enteredUnitCost)
    const nextStockPcs = stockInPcs(stockProduct) + quantityToPcs(amount, unit)
    if (!Number.isSafeInteger(nextStockPcs) || nextStockPcs > 2147483647) {
      setStockError('Jumlah stok melebihi batas yang dapat disimpan.')
      return
    }
    setStockSaving(true)
    try {
      const quantityPcs = quantityToPcs(amount, unit)
      const requestFingerprint = stockProduct.id + ':' + quantityPcs + ':' + unitCost
      if (stockRequest.current?.fingerprint !== requestFingerprint) {
        stockRequest.current = { fingerprint: requestFingerprint, id: crypto.randomUUID() }
      }
      await addProductStock(stockProduct.id, quantityPcs, unitCost, stockRequest.current.id)
      stockRequest.current = null
      setStockProduct(null)
    } catch (error) {
      setStockError(error.message || 'Gagal menambahkan stok produk.')
    } finally {
      setStockSaving(false)
    }
  }

  function closeProductForm() {
    if (saving || imageProcessingRef.current) return
    setShowForm(false)
    setImageFile(null)
    setImagePreview('')
    setImageRemoved(false)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function selectProductImage(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setActionError('Gunakan gambar JPG, PNG, atau WebP.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionError('Ukuran gambar maksimal 5 MB.')
      event.target.value = ''
      return
    }
    if (imageProcessingRef.current) return

    imageProcessingRef.current = true
    setCompressingImage(true)
    setActionError('')
    try {
      const compressedFile = await compressProductImage(file)
      setImageFile(compressedFile)
      setImagePreview(URL.createObjectURL(compressedFile))
      setImageRemoved(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    } catch (error) {
      setActionError(error.message || 'Gagal mengompres gambar produk.')
      if (imageInputRef.current) imageInputRef.current.value = ''
    } finally {
      imageProcessingRef.current = false
      setCompressingImage(false)
    }
  }

  function clearProductImage() {
    setImageFile(null)
    setImagePreview('')
    setImageRemoved(true)
    setForm((current) => ({ ...current, image_path: null }))
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function addCategory(name) {
    if (categories.some((category) => category.name.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID'))) {
      throw new Error('Kategori "' + name + '" sudah ada.')
    }
    const id = await put('categories', { name })
    setForm((current) => ({ ...current, category: name }))
    return id
  }

  async function deleteCategory(category) {
    await remove('categories', category.id)
    if (form.category === category.name) {
      setForm((current) => ({ ...current, category: '' }))
    }
  }

  async function addUnit(name) {
    if (units.some((unit) => unit.name.toLocaleLowerCase('id-ID') === name.toLocaleLowerCase('id-ID'))) {
      throw new Error('Satuan "' + name + '" sudah ada.')
    }
    await put('units', { name })
    setForm((current) => ({ ...current, unit: name }))
  }

  async function deleteUnit(unit) {
    await remove('units', unit.id)
    if (form.unit === unit.name) setForm((current) => ({ ...current, unit: '' }))
  }

  function changeBaseUnit(unit) {
    if (editId) return
    setForm((current) => {
      const stockPcs = (Number(current.stock) || 0) * unitFactor(stockEntryUnit(current.unit))
      return {
        ...current,
        unit,
        cost: current.cost,
        stock: String(stockPcs / unitFactor(stockEntryUnit(unit)))
      }
    })
  }

  async function save(e) {
    e.preventDefault()
    setActionError('')
    const productName = form.name.trim()
    if (!productName) { setActionError('Nama produk wajib diisi.'); return }
    if (!form.unit) { setActionError('Satuan produk wajib dipilih.'); return }
    const isStandard = saleUnits(form.unit).length === 2
    const markups = Object.fromEntries(
      Object.entries(form.markups).map(([unit, value]) => [unit, Number(value)])
    )
    const prices = Object.fromEntries(
      Object.entries(form.salePrices).map(([unit, value]) => [unit, Number(value)])
    )
    const modalPerPiece = purchaseCostPerPiece(form.unit, form.cost)
    const basePrice = isStandard
      ? prices[form.unit.trim().toLocaleLowerCase('id-ID')]
      : Number(form.price)
    if (isStandard && (!isSafeRupiahAmount(form.cost) || !Number.isFinite(modalPerPiece) || modalPerPiece <= 0)) {
      setActionError('Harga modal wajib lebih dari Rp0 untuk menghitung harga jual.')
      return
    }
    if (isStandard && Object.values(form.markups).some((value) => value === '' || !Number.isFinite(Number(value)))) {
      setActionError('Isi persentase markup PCS dan LUSIN dengan angka yang valid.')
      return
    }
    if (isStandard && Object.values(prices).some((price) => !isSafeRupiahAmount(price))) {
      setActionError('Harga jual harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (!isSafeRupiahAmount(basePrice)) {
      setActionError('Harga jual harus rupiah utuh lebih dari Rp0 dan tidak melebihi batas aman.')
      return
    }
    if (!isStandard && !isSafeRupiahAmount(form.cost, true)) {
      setActionError('Harga modal harus rupiah utuh dan tidak melebihi batas nominal yang aman.')
      return
    }
    const baseStock = Number(form.stock)
    if (!Number.isFinite(baseStock) || baseStock < 0 || (editId && !Number.isInteger(baseStock))) {
      setActionError(editId
        ? 'Stok harus berupa bilangan bulat nol atau lebih.'
        : 'Stok harus berupa angka nol atau lebih.')
      return
    }
    const stockUnit = editId && isStandard ? 'pcs' : stockEntryUnit(form.unit)
    if (!isWholeStockQuantity(baseStock, stockUnit)) {
      setActionError('Jumlah stok harus menghasilkan jumlah PCS utuh. Periksa kembali jumlah dan satuannya.')
      return
    }
    const stockPcs = quantityToPcs(baseStock, stockUnit)
    if (stockPcs > 2147483647) {
      setActionError('Jumlah stok melebihi batas yang dapat disimpan.')
      return
    }
    const previousImagePath = originalImagePathRef.current
    let imagePath = imageRemoved ? null : previousImagePath
    let uploadedImagePath = null
    let productDetailsSaved = false
    setSaving(true)
    try {
      if (imageFile) {
        uploadedImagePath = await uploadProductImage(imageFile)
        imagePath = uploadedImagePath
      }
      const productRecord = {
        name: productName,
        category: form.category.trim(),
        unit: form.unit.trim(),
        price: basePrice,
        price_pcs: isStandard ? prices.pcs : 0,
        price_lusin: isStandard ? prices.lusin : 0,
        sale_markup_pcs_pct: isStandard ? markups.pcs : null,
        sale_markup_lusin_pct: isStandard ? markups.lusin : null,
        price_kodi: 0,
        image_path: imagePath
      }
      if (!editId) {
        productRecord.cost = purchaseCostPerPiece(form.unit, form.cost)
        productRecord.stock = stockPcs / unitFactor(form.unit)
        productRecord.stock_pcs = stockPcs
        productRecord.stock_cost_value = productRecord.cost * stockPcs
      }
      if (editId) {
        await updateProductDetails(editId, productRecord)
        productDetailsSaved = true
        const currentProduct = items.find((product) => product.id === editId)
        if (!currentProduct) throw new Error('Produk tidak ditemukan untuk memperbarui stok.')
        if (stockInPcs(currentProduct) !== stockPcs) {
          await setProductStock(editId, stockPcs)
        }
      } else {
        await put('products', productRecord)
      }
      originalImagePathRef.current = imagePath
      setShowForm(false)
      setImageFile(null)
      setImagePreview('')
      setImageRemoved(false)
      if (previousImagePath && previousImagePath !== imagePath) {
        try {
          await removeProductImage(previousImagePath)
        } catch (error) {
          setActionError('Produk tersimpan, tetapi gambar lama gagal dihapus: ' + error.message)
        }
      }
    } catch (error) {
      let message = error.message || 'Gagal menyimpan produk ke server.'
      if (productDetailsSaved) {
        message = 'Detail produk tersimpan, tetapi stok gagal diperbarui: ' + message
      } else if (uploadedImagePath) {
        try {
          await removeProductImage(uploadedImagePath)
        } catch (cleanupError) {
          message += ' Gambar yang gagal disimpan juga tidak berhasil dibersihkan: ' + cleanupError.message
        }
      }
      setActionError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleProductFormKeyDown(event) {
    if (event.key !== 'Tab') return
    const fields = saleUnits(form.unit).length === 2
      ? [
          nameInputRef.current,
          imageInputRef.current,
          categoryInputRef.current,
          unitInputRef.current,
          costInputRef.current,
          markupInputRefs.pcs.current,
          salePriceInputRefs.pcs.current,
          markupInputRefs.lusin.current,
          salePriceInputRefs.lusin.current,
          stockInputRef.current
        ]
      : [
      nameInputRef.current,
      imageInputRef.current,
      categoryInputRef.current,
      unitInputRef.current,
      customPriceInputRef.current,
      costInputRef.current,
      stockInputRef.current
      ]
    const currentIndex = fields.indexOf(event.target)
    if (currentIndex < 0) return
    const direction = event.shiftKey ? -1 : 1
    const nextIndex = currentIndex + direction
    if (nextIndex < 0 || nextIndex >= fields.length) return
    event.preventDefault()
    fields[nextIndex].focus()
  }

  async function del(p) {
    if (!confirm('Hapus "' + p.name + '"? Stok & produk ini akan dihapus.')) return
    try {
      await remove('products', p.id)
      setActionError('')
      if (p.image_path) {
        try {
          await removeProductImage(p.image_path)
        } catch (error) {
          setActionError('Produk terhapus, tetapi gambar gagal dihapus: ' + error.message)
        }
      }
    } catch (error) {
      setActionError(error.message || 'Gagal menghapus produk dari server.')
    }
  }

  function toggleActionMenu(product, event) {
    if (actionMenuProductId === product.id) {
      setActionMenuProductId(null)
      return
    }
    actionButtonRef.current = event.currentTarget
    setActionMenuProductId(product.id)
  }

  function navigateActionMenu(event) {
    const menuItems = actionMenuRef.current?.querySelectorAll('[role="menuitem"]')
    if (!menuItems?.length) return

    const currentIndex = Array.from(menuItems).indexOf(document.activeElement)
    let nextIndex
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % menuItems.length
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = menuItems.length - 1
    else return

    event.preventDefault()
    menuItems[nextIndex].focus()
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat produk dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => requestPageRefresh('stok')}>Coba lagi</button>
    </div>
  }

  const editingProduct = editId ? items.find((product) => product.id === editId) : null

  return (
    <div className="page">
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <div className="page-toolbar">
        <p className="muted"><strong>{items.length} produk</strong> · {lowStock.length} stok menipis (≤5)</p>
        <button className="btn btn-primary" onClick={openAdd}>+ Tambah Produk</button>
      </div>

      <input className="input search products-search" placeholder="Cari produk atau kategori..."
        value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card table-card products-table-card">
        <table className="products-table">
          <thead>
            <tr><th>No.</th><th>Produk</th><th>Kategori</th><th>Satuan</th><th>Modal Rata-rata</th><th>Harga Jual</th><th>Stok</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="8" className="muted center">Belum ada produk. Klik "+ Tambah Produk".</td></tr>
            )}
            {filtered.map((p, index) => (
              <tr key={p.id}>
                <td className="product-number-cell">{index + 1}</td>
                <td className="product-name-cell">
                  <div className="product-name-content">
                    {p.image_path && (
                      <img
                        src={getProductImageUrl(p.image_path)}
                        width="42"
                        height="42"
                        alt=""
                        loading={index < 4 ? 'eager' : 'lazy'}
                        fetchPriority={index < 2 ? 'high' : 'auto'}
                        decoding="async"
                      />
                    )}
                    <div className="product-name-text">
                      <strong>{p.name}</strong>
                      <span className="product-category-mobile">{p.category || '-'}</span>
                    </div>
                  </div>
                </td>
                <td>{p.category || '-'}</td>
                <td>{p.unit || 'pcs'}</td>
                <td>{rupiah((Number(p.cost) || 0) * purchaseCostFactor(p.unit))}/{purchaseCostUnit(p.unit)}</td>
                <td className="product-price-cell">
                  {saleUnits(p.unit || 'pcs').map((unit) => (
                    <div className="product-price-row" key={unit}>
                      <strong>{rupiah(saleUnitPrice(p, unit))}/{unit}</strong>
                    </div>
                  ))}
                </td>
                <td>
                  <span className={'badge product-stock-badge ' + (availableQuantity(p, p.unit || 'pcs') <= 5 ? 'badge-danger' : 'badge-ok')}>
                    <span className="product-stock-desktop">{stockLabel(p)}</span>
                  </span>
                </td>
                <td className="row-actions">
                  <button
                    className="btn btn-sm product-action-trigger"
                    type="button"
                    aria-label={'Aksi untuk ' + p.name}
                    aria-haspopup="menu"
                    aria-expanded={actionMenuProductId === p.id}
                    onClick={(event) => toggleActionMenu(p, event)}
                  >
                    <Icon name="more" size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionMenuProductId !== null && actionMenuPosition && createPortal(
        <div
          ref={actionMenuRef}
          className="product-action-menu"
          role="menu"
          aria-label="Aksi produk"
          onKeyDown={navigateActionMenu}
          style={{ left: actionMenuPosition.left, top: actionMenuPosition.top }}
        >
          <button type="button" role="menuitem" onClick={() => {
            const product = items.find((item) => item.id === actionMenuProductId)
            setActionMenuProductId(null)
            if (product) openAddStock(product)
          }}>
            <Icon name="plus" size={14} /> Tambah Stok
          </button>
          <button type="button" role="menuitem" onClick={() => {
            const product = items.find((item) => item.id === actionMenuProductId)
            setActionMenuProductId(null)
            if (product) openEdit(product)
          }}>
            <Icon name="edit" size={14} /> Edit
          </button>
          <button type="button" role="menuitem" className="product-action-menu-delete" onClick={() => {
            const product = items.find((item) => item.id === actionMenuProductId)
            setActionMenuProductId(null)
            if (product) del(product)
          }}>
            <Icon name="trash" size={14} /> Hapus
          </button>
        </div>,
        document.body
      )}

      {showForm && (
        createPortal(
        <div className="overlay product-form-overlay">
          <form className="modal product-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleProductFormKeyDown} onSubmit={save}>
            <div className="product-modal-heading">
              <span className="product-modal-mark"><Icon name="bag" size={22} /></span>
              <div>
                <p className="product-modal-eyebrow">{editId ? 'Perbarui katalog' : 'Katalog produk'}</p>
                <h3>{editId ? 'Edit Produk' : 'Tambah Produk'}</h3>
              </div>
            </div>
            <label>Nama Produk *</label>
            <input ref={nameInputRef} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth: Tas Ransel Volt Hitam" />
            <div className="product-image-field">
              <label htmlFor="product-image">Gambar produk</label>
              <input
                ref={imageInputRef}
                id="product-image"
                className="input product-image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={saving || compressingImage}
                onChange={selectProductImage}
              />
              <p className="muted small" role="status">
                {compressingImage
                  ? 'Mengoptimalkan gambar...'
                  : 'Gambar otomatis dikompres ke WebP, maksimal 1200 px.'}
              </p>
              {(imagePreview || form.image_path) && (
                <div className="product-image-preview">
                  <img src={imagePreview || getProductImageUrl(form.image_path)} width="92" height="76" alt="Pratinjau gambar produk" />
                  <button className="btn btn-sm btn-danger" type="button" onClick={clearProductImage}>
                    <Icon name="trash" size={14} /> Hapus gambar
                  </button>
                </div>
              )}
            </div>
            <div className="product-option-fields">
              <div>
                <label>Kategori</label>
                <CategorySelect
                  categories={categories}
                  value={form.category}
                  onChange={(category) => setForm({ ...form, category })}
                  onAdd={addCategory}
                  onDelete={deleteCategory}
                  triggerRef={categoryInputRef}
                />
              </div>
              <div>
                <label>Satuan *</label>
                <UnitSelect
                  categories={units}
                  value={form.unit}
                  onChange={changeBaseUnit}
                  onAdd={addUnit}
                  onDelete={deleteUnit}
                  triggerRef={unitInputRef}
                  disabled={Boolean(editId)}
                />
              </div>
            </div>
            {saleUnits(form.unit).length === 2 ? (
              <>
                <div className="product-modal-cost-field">
                  <label>{editId ? 'Modal rata-rata per lusin' : 'Harga modal per lusin'} *</label>
                  <MoneyInput
                    inputRef={costInputRef}
                    value={form.cost}
                    onChange={(cost) => setForm((current) => ({
                      ...current,
                      cost,
                      salePrices: {
                        ...current.salePrices,
                        ...salePricesFromMarkups(cost, current.markups, current.unit)
                      }
                    }))}
                    disabled={Boolean(editId)}
                  />
                </div>
                <div className="product-markup-fields">
                  {['pcs', 'lusin'].map((unit) => {
                    return (
                      <div className="product-markup-row" key={unit}>
                        <div>
                          <label htmlFor={'product-markup-' + unit}>Persentase {unit}</label>
                          <div className="product-percent-input">
                            <input
                              id={'product-markup-' + unit}
                              ref={markupInputRefs[unit]}
                              className="input"
                              type="number"
                              inputMode="none"
                              data-custom-numpad="decimal"
                              step="any"
                              value={form.markups[unit]}
                              onChange={(event) => setForm({
                                ...form,
                                markups: { ...form.markups, [unit]: event.target.value },
                                salePrices: {
                                  ...form.salePrices,
                                  [unit]: saleMarkupPrice(
                                    purchaseCostPerPiece(form.unit, form.cost),
                                    unit,
                                    event.target.value
                                  )
                                }
                              })}
                            />
                            <span>%</span>
                          </div>
                        </div>
                        <div>
                          <label htmlFor={'product-sale-price-' + unit}>Harga jual {unit}</label>
                          <MoneyInput
                            inputRef={salePriceInputRefs[unit]}
                            id={'product-sale-price-' + unit}
                            value={form.salePrices[unit]}
                            onChange={(price) => setForm({
                              ...form,
                              salePrices: { ...form.salePrices, [unit]: price },
                              markups: {
                                ...form.markups,
                                [unit]: saleMarkupPercentage(
                                  price,
                                  purchaseCostPerPiece(form.unit, form.cost),
                                  unit
                                )
                              }
                            })}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div>
                <label>Harga Jual per {form.unit} *</label>
                <MoneyInput inputRef={customPriceInputRef} value={form.price} onChange={(price) => setForm({ ...form, price })} />
              </div>
            )}
            {saleUnits(form.unit).length === 2 ? (
              <div className="product-stock-fields">
                <div>
                  <label>Stok ({editId ? 'pcs' : stockEntryUnit(form.unit)})</label>
                  <input ref={stockInputRef} className="input" type="number" inputMode="none" data-custom-numpad={editId ? 'integer' : 'decimal'} min="0" step={editId ? '1' : 'any'} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  {editId && saleUnits(form.unit).length === 2 && (
                    <span className="muted small">Stok saat ini: {editingProduct ? stockLabel(editingProduct) : '-'}</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid-2 product-stock-fields">
                <div>
                  <label>{editId ? 'Modal rata-rata per' : 'Harga modal awal per'} {purchaseCostUnit(form.unit)}</label>
                  <MoneyInput inputRef={costInputRef} value={form.cost} onChange={(cost) => setForm({ ...form, cost })} disabled={Boolean(editId)} />
                </div>
                <div>
                  <label>Stok ({editId && saleUnits(form.unit).length === 2 ? 'pcs' : stockEntryUnit(form.unit)})</label>
                  <input ref={stockInputRef} className="input" type="number" inputMode="none" data-custom-numpad={editId ? 'integer' : 'decimal'} min="0" step={editId ? '1' : 'any'} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
                  {editId && saleUnits(form.unit).length === 2 && (
                    <span className="muted small">Stok saat ini: {editingProduct ? stockLabel(editingProduct) : '-'}</span>
                  )}
                </div>
              </div>
            )}
            <div className="modal-actions">
              {actionError && <p className="form-error" role="alert">{actionError}</p>}
              <button type="button" className="btn" disabled={saving || compressingImage} onClick={closeProductForm}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={saving || compressingImage}>
                {compressingImage ? 'Mengoptimalkan gambar...' : saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>,
        document.body
        )
      )}

      {stockProduct && (
        createPortal(
        <div className="overlay" onClick={() => !stockSaving && setStockProduct(null)}>
          <form className="modal add-stock-modal" onClick={(event) => event.stopPropagation()} onSubmit={addStock}>
            <h3>Tambah Stok</h3>
            <p className="muted small">{stockProduct.name}</p>
            <p className="add-stock-current">Stok saat ini <strong>{stockLabel(stockProduct)}</strong></p>
            <p className="add-stock-current">Nilai modal saat ini <strong>{rupiah(stockProduct.stock_cost_value ?? stockProduct.cost * stockInPcs(stockProduct))}</strong></p>
            <label htmlFor="add-stock-amount">Jumlah yang ditambahkan ({stockProduct.unit || 'pcs'}) *</label>
            <input
              id="add-stock-amount"
              className="input"
              type="number"
              inputMode="none"
              data-custom-numpad="integer"
              min="0"
              step="1"
              value={stockAmount}
              onChange={(event) => setStockAmount(event.target.value)}
              placeholder={'Jumlah ' + (stockProduct.unit || 'pcs')}
              required
              autoFocus
            />
            <label htmlFor="add-stock-unit-cost">Harga modal barang baru per {purchaseCostUnit(stockProduct.unit)} *</label>
            <MoneyInput
              id="add-stock-unit-cost"
              value={stockUnitCost}
              onChange={setStockUnitCost}
              placeholder="Masukkan harga modal"
              required
            />
            {stockReceiptPreview && (
              <>
                <p className="add-stock-current">
                  Nilai modal setelah tambah stok
                  <strong>{rupiah(stockReceiptPreview.stockValue)}</strong>
                </p>
                <p className="add-stock-current">
                  Modal rata-rata baru per {purchaseCostUnit(stockProduct.unit)}
                  <strong>{rupiah(stockReceiptPreview.averageUnitCost * purchaseCostFactor(stockProduct.unit))}</strong>
                </p>
              </>
            )}
            <p className="muted small">Nilai modal stok baru ditambahkan ke nilai stok yang ada. Saat penjualan, modal berkurang secara proporsional berdasarkan modal rata-rata. Untuk produk PCS/LUSIN, perubahan modal rata-rata otomatis memperbarui harga jual sesuai persentase markup.</p>
            {stockError && <p className="form-error" role="alert">{stockError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" disabled={stockSaving} onClick={() => setStockProduct(null)}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={stockSaving || !stockAmount || !stockUnitCost}>
                {stockSaving ? 'Menyimpan…' : 'Tambah Stok'}
              </button>
            </div>
          </form>
        </div>,
        document.body
        )
      )}
    </div>
  )
}
