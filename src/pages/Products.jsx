import { useEffect, useState } from 'react'
import { getAll, put, remove, onRefresh } from '../db'
import { rupiah } from '../format'
import MoneyInput from '../components/MoneyInput.jsx'
import CategorySelect from '../components/CategorySelect.jsx'
import Icon from '../components/Icon.jsx'

const EMPTY = { name: '', category: '', price: '', cost: '', stock: '' }

export default function Products() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)

  async function load() {
    try {
      const [productRows, categoryRows] = await Promise.all([
        getAll('products'),
        getAll('categories')
      ])
      setItems(productRows)
      setCategories(categoryRows)
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
  const lowStock = items.filter((p) => Number(p.stock) <= 5)

  function openEdit(p) {
    setEditId(p.id)
    setForm({ name: p.name, category: p.category || '', price: p.price, cost: p.cost || '', stock: p.stock })
    setShowForm(true)
  }
  function openAdd() { setEditId(null); setForm(EMPTY); setShowForm(true) }

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

  async function save(e) {
    e.preventDefault()
    setActionError('')
    if (!form.name || !form.price) { setActionError('Nama dan harga jual wajib diisi.'); return }
    try {
      await put('products', {
        id: editId || undefined,
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0
      })
      setShowForm(false)
    } catch (error) {
      setActionError(error.message || 'Gagal menyimpan produk ke server.')
    }
  }

  async function del(p) {
    if (!confirm('Hapus "' + p.name + '"? Stok & produk ini akan dihapus.')) return
    try {
      await remove('products', p.id)
      setActionError('')
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
        <table>
          <thead>
            <tr><th>Produk</th><th>Kategori</th><th>Harga Beli</th><th>Harga Jual</th><th>Stok</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan="6" className="muted center">Belum ada produk. Klik "+ Tambah Produk".</td></tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong></td>
                <td>{p.category || '-'}</td>
                <td>{rupiah(p.cost)}</td>
                <td className="accent">{rupiah(p.price)}</td>
                <td>
                  <span className={'badge ' + (Number(p.stock) <= 5 ? 'badge-danger' : 'badge-ok')}>
                    {p.stock}
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
        <div className="overlay" onClick={() => setShowForm(false)}>
          <form className="modal product-modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <div className="product-modal-heading">
              <span className="product-modal-mark"><Icon name="bag" size={22} /></span>
              <div>
                <p className="product-modal-eyebrow">{editId ? 'Perbarui katalog' : 'Katalog produk'}</p>
                <h3>{editId ? 'Edit Produk' : 'Tambah Produk'}</h3>
              </div>
            </div>
            <label>Nama Produk *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="cth: Tas Ransel Volt Hitam" />
            <label>Kategori</label>
            <CategorySelect
              categories={categories}
              value={form.category}
              onChange={(category) => setForm({ ...form, category })}
              onAdd={addCategory}
              onDelete={deleteCategory}
            />
            <div className="grid-3">
              <div>
                <label>Harga Jual *</label>
                <MoneyInput value={form.price} onChange={(price) => setForm({ ...form, price })} />
              </div>
              <div>
                <label>Harga Beli</label>
                <MoneyInput value={form.cost} onChange={(cost) => setForm({ ...form, cost })} />
              </div>
              <div>
                <label>Stok</label>
                <input className="input" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              {actionError && <p className="form-error" role="alert">{actionError}</p>}
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" className="btn btn-primary">Simpan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
