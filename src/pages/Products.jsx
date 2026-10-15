import { useEffect, useRef, useState } from 'react'
import { getAll, getProductImageUrl, put, remove, removeProductImage, uploadProductImage, onRefresh } from '../db'
import { rupiah } from '../format'
import MoneyInput from '../components/MoneyInput.jsx'
import CategorySelect from '../components/CategorySelect.jsx'
import UnitSelect from '../components/UnitSelect.jsx'
import Icon from '../components/Icon.jsx'
import { availableQuantity, productPrice, purchaseCostUnit, quantityToPcs, saleUnitPrice, saleUnits, stockInPcs, unitFactor, stockLabel } from '../productUnits'

const EMPTY = {
  name: '',
  category: '',
  unit: 'pcs',
  price: '',
  prices: { pcs: '', lusin: '', kodi: '' },
  cost: '',
  stock: '',
  image_path: null
}

export default function Products() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const nameInputRef = useRef(null)
  const originalImagePathRef = useRef(null)
  const categoryInputRef = useRef(null)
  const unitInputRef = useRef(null)
  const priceInputRefs = {
    pcs: useRef(null),
    lusin: useRef(null),
    kodi: useRef(null)
  }
  const customPriceInputRef = useRef(null)
  const costInputRef = useRef(null)
  const stockInputRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  async function load() {
    try {
      const [productRows, categoryRows, unitRows] = await Promise.all([
        getAll('products'),
        getAll('categories'),
        getAll('units')
      ])
      setItems(productRows)
      setCategories(categoryRows)
      setUnits(unitRows)
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat produk dari server.')
    } finally {
      setLoaded(true)
    }
  }
  useEffect(() => {
    load()
    return onRefresh(load)
  }, [])

  const filtered = items.filter((p) =>
    (p.name + ' ' + (p.category || '')).toLowerCase().includes(q.toLowerCase())
  )
  const lowStock = items.filter((p) => availableQuantity(p, p.unit || 'pcs') <= 5)

  function openEdit(p) {
    setEditId(p.id)
    originalImagePathRef.current = p.image_path || null
    setForm({
      name: p.name,
      category: p.category || '',
      unit: p.unit || 'pcs',
      price: p.price || '',
      prices: {
        pcs: productPrice(p, 'pcs'),
        lusin: productPrice(p, 'lusin'),
        kodi: productPrice(p, 'kodi')
      },
      cost: p.cost || '',
      stock: String(stockInPcs(p) / unitFactor(p.unit || 'pcs')),
      image_path: p.image_path || null
    })
    setImageFile(null)
    setImagePreview('')
    if (imageInputRef.current) imageInputRef.current.value = ''
    setShowForm(true)
  }
  function openAdd() {
    setEditId(null)
    originalImagePathRef.current = null
    setForm(EMPTY)
    setImageFile(null)
    setImagePreview('')
    if (imageInputRef.current) imageInputRef.current.value = ''
    setShowForm(true)
  }

  function closeProductForm() {
    if (saving) return
    setShowForm(false)
    setImageFile(null)
    setImagePreview('')
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  function selectProductImage(event) {
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
    setActionError('')
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearProductImage() {
    setImageFile(null)
    setImagePreview('')
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
    setForm((current) => {
      const conversion = unitFactor(unit) / unitFactor(current.unit)
      return {
        ...current,
        unit,
        cost: current.cost,
        stock: String((Number(current.stock) || 0) / conversion)
      }
    })
  }

  async function save(e) {
    e.preventDefault()
    setActionError('')
    if (!form.name) { setActionError('Nama produk wajib diisi.'); return }
    if (!form.unit) { setActionError('Satuan produk wajib dipilih.'); return }
    const isStandard = saleUnits(form.unit).length === 3
    const prices = Object.fromEntries(
      Object.entries(form.prices).map(([unit, value]) => [unit, Number(value) || 0])
    )
    const basePrice = isStandard
      ? prices[form.unit.trim().toLocaleLowerCase('id-ID')]
      : Number(form.price)
    if (isStandard && Object.values(prices).some((price) => price <= 0)) {
      setActionError('Isi harga jual pcs, lusin, dan kodi dengan nominal lebih dari Rp0.')
      return
    }
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      setActionError('Harga jual wajib diisi dengan nominal lebih dari Rp0.')
      return
    }
    const baseStock = Number(form.stock)
    if (!Number.isFinite(baseStock) || baseStock < 0) {
      setActionError('Stok harus berupa angka nol atau lebih.')
      return
    }
    const stockPcs = quantityToPcs(baseStock, form.unit)
    const previousImagePath = originalImagePathRef.current
    let imagePath = previousImagePath
    let uploadedImagePath = null
    setSaving(true)
    try {
      if (imageFile) {
        uploadedImagePath = await uploadProductImage(imageFile)
        imagePath = uploadedImagePath
      }
      await put('products', {
        id: editId || undefined,
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim(),
        price: isStandard ? basePrice * unitFactor(form.unit) : basePrice,
        price_pcs: isStandard ? prices.pcs : 0,
        price_lusin: isStandard ? prices.lusin : 0,
        price_kodi: isStandard ? prices.kodi : 0,
        cost: Number(form.cost) || 0,
        stock: stockPcs / unitFactor(form.unit),
        stock_pcs: stockPcs,
        image_path: imagePath
      })
      originalImagePathRef.current = imagePath
      setShowForm(false)
      setImageFile(null)
      setImagePreview('')
      if (previousImagePath && previousImagePath !== imagePath) {
        try {
          await removeProductImage(previousImagePath)
        } catch (error) {
          setActionError('Produk tersimpan, tetapi gambar lama gagal dihapus: ' + error.message)
        }
      }
    } catch (error) {
      let message = error.message || 'Gagal menyimpan produk ke server.'
      if (uploadedImagePath) {
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
    const priceFields = saleUnits(form.unit).length === 3
      ? ['pcs', 'lusin', 'kodi'].map((unit) => priceInputRefs[unit].current)
      : [customPriceInputRef.current]
    const fields = [
      nameInputRef.current,
      imageInputRef.current,
      categoryInputRef.current,
      unitInputRef.current,
      ...priceFields,
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

  if (!loaded) return <div className="page"><p className="muted">Memuat produk dari server...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  return (
    <div className="page">
      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      <div className="page-toolbar">
        <p className="muted"><strong>{items.length} produk</strong> · {lowStock.length} stok menipis (≤5)</p>
        <button className="btn btn-primary" onClick={openAdd}>+ Tambah Produk</button>
      </div>

      <input className="input search" placeholder="Cari produk atau kategori..."
        value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card table-card">
        <table className="products-table">
          <thead>
            <tr><th>Produk</th><th>Kategori</th><th>Satuan</th><th>Harga Beli / satuan dasar</th><th>Harga Jual</th><th>Stok</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="7" className="muted center">Belum ada produk. Klik "+ Tambah Produk".</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="product-name-cell">
                  <div className="product-name-content">
                    {p.image_path && <img src={getProductImageUrl(p.image_path)} alt="" />}
                    <strong>{p.name}</strong>
                  </div>
                </td>
                <td>{p.category || '-'}</td>
                <td>{p.unit || 'pcs'}</td>
                <td>{rupiah(p.cost)}/{purchaseCostUnit(p.unit)}</td>
                <td className="product-price-cell">
                  {saleUnits(p.unit || 'pcs').map((unit) => (
                    <div className="product-price-row" key={unit}>
                      <span>{unit}</span>
                      <strong>{rupiah(productPrice(p, unit))}/pcs</strong>
                    </div>
                  ))}
                </td>
                <td>
                  <span className={'badge ' + (availableQuantity(p, p.unit || 'pcs') <= 5 ? 'badge-danger' : 'badge-ok')}>
                    {stockLabel(p)}
                  </span>
                </td>
                <td className="row-actions">
                  <button className="btn btn-sm" onClick={() => openEdit(p)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => del(p)}>Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="overlay" onClick={closeProductForm}>
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
                disabled={saving}
                onChange={selectProductImage}
              />
              <p className="muted small">JPG, PNG, atau WebP · maksimal 5 MB.</p>
              {(imagePreview || form.image_path) && (
                <div className="product-image-preview">
                  <img src={imagePreview || getProductImageUrl(form.image_path)} alt="Pratinjau gambar produk" />
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
                />
              </div>
            </div>
            {saleUnits(form.unit).length === 3 ? (
              <div className="product-sale-prices">
                <label>Tarif per pcs saat dijual dalam satuan berikut *</label>
                <p className="muted small product-price-hint">Harga transaksi dikalikan isi satuan: 1 lusin = 12 pcs, 1 kodi = 20 pcs.</p>
                <div className="grid-3">
                  {['pcs', 'lusin', 'kodi'].map((unit) => (
                    <div key={unit}>
                      <label htmlFor={'product-price-' + unit}>{unit} (/pcs)</label>
                      <MoneyInput
                        inputRef={priceInputRefs[unit]}
                        id={'product-price-' + unit}
                        value={form.prices[unit]}
                        onChange={(price) => setForm({ ...form, prices: { ...form.prices, [unit]: price } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label>Harga Jual per {form.unit} *</label>
                <MoneyInput inputRef={customPriceInputRef} value={form.price} onChange={(price) => setForm({ ...form, price })} />
              </div>
            )}
            <div className="grid-2 product-stock-fields">
              <div>
                <label>Harga Beli per {purchaseCostUnit(form.unit)}</label>
                <MoneyInput inputRef={costInputRef} value={form.cost} onChange={(cost) => setForm({ ...form, cost })} />
              </div>
              <div>
                <label>Stok ({form.unit})</label>
                <input ref={stockInputRef} className="input" type="number" min="0" step="any" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>
            <p className="muted small product-stock-hint">Untuk satuan pcs, lusin, dan kodi, harga beli dihitung per pcs dan stok dikonversi ke pcs. Untuk satuan khusus, harga beli mengikuti satuan produk.</p>
            <div className="modal-actions">
              {actionError && <p className="form-error" role="alert">{actionError}</p>}
              <button type="button" className="btn" disabled={saving} onClick={closeProductForm}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
