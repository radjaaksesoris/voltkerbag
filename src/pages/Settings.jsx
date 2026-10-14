import { useEffect, useState } from 'react'
import { getAll, onRefresh, put, remove } from '../db'
import Icon from '../components/Icon.jsx'

export default function Settings() {
  const [customers, setCustomers] = useState([])
  const [name, setName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  async function load() {
    try {
      setCustomers(await getAll('customers'))
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat daftar nama pelanggan.')
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    load()
    return onRefresh(load)
  }, [])

  async function addCustomer(event) {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName) {
      setActionError('Nama pelanggan wajib diisi.')
      return
    }
    if (customers.some((customer) => customer.name.toLocaleLowerCase('id-ID') === normalizedName.toLocaleLowerCase('id-ID'))) {
      setActionError('Nama pelanggan tersebut sudah ada.')
      return
    }

    setSaving(true)
    setActionError('')
    try {
      await put('customers', { name: normalizedName })
      setName('')
    } catch (error) {
      setActionError(error.message || 'Gagal menambahkan nama pelanggan.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCustomer(customer) {
    if (!confirm('Hapus nama pelanggan "' + customer.name + '" dari daftar? Riwayat transaksi tidak akan dihapus.')) return
    setActionError('')
    try {
      await remove('customers', customer.id)
    } catch (error) {
      setActionError(error.message || 'Gagal menghapus nama pelanggan.')
    }
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat daftar pelanggan...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  return (
    <div className="page settings-page">
      <section className="card settings-section">
        <div className="settings-section-heading">
          <div>
            <h3>Nama pelanggan</h3>
            <p className="muted small">Kelola pilihan nama yang tersedia di kasir.</p>
          </div>
          <span className="settings-count">{customers.length} nama</span>
        </div>

        {actionError && <p className="form-error" role="alert">{actionError}</p>}

        <form className="settings-add-form" onSubmit={addCustomer}>
          <div>
            <label htmlFor="new-customer-name">Nama pelanggan baru</label>
            <input
              id="new-customer-name"
              className="input"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Masukkan nama pelanggan"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}>
            <Icon name="plus" size={16} /> {saving ? 'Menyimpan...' : 'Tambah nama'}
          </button>
        </form>

        {customers.length === 0 ? (
          <div className="settings-empty">
            <span>Daftar pelanggan masih kosong.</span>
            <span>Tambahkan nama di atas agar bisa dipilih saat transaksi.</span>
          </div>
        ) : (
          <ul className="customer-list">
            {customers.map((customer) => (
              <li key={customer.id}>
                <span>{customer.name}</span>
                <button
                  className="btn btn-sm btn-danger"
                  type="button"
                  aria-label={'Hapus ' + customer.name}
                  onClick={() => deleteCustomer(customer)}>
                  <Icon name="trash" size={14} /> Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card settings-section">
        <div className="settings-section-heading">
          <div>
            <h3>Gambar produk</h3>
            <p className="muted small">Unggah foto pada formulir Tambah/Edit Produk di Stok Barang. Gambar akan disimpan di Supabase Storage.</p>
          </div>
        </div>
        <p className="settings-storage-note">Format JPG, PNG, atau WebP · maksimal 5 MB per gambar.</p>
      </section>
    </div>
  )
}
