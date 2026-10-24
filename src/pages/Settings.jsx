import { useEffect, useRef, useState } from 'react'
import { createBackupArchive, getAll, onRefresh, put, remove, restoreBackupArchive } from '../db'
import Icon from '../components/Icon.jsx'

export default function Settings() {
  const [customers, setCustomers] = useState([])
  const [name, setName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [backupSaving, setBackupSaving] = useState(false)
  const [backupStatus, setBackupStatus] = useState('')
  const [backupError, setBackupError] = useState('')
  const [restoreSaving, setRestoreSaving] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const restoreInputRef = useRef(null)

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

  async function createBackup() {
    setBackupSaving(true)
    setBackupError('')
    setBackupStatus('')
    try {
      const backup = await createBackupArchive()
      setBackupStatus(
        'Tersimpan di store-backups/' + backup.path + ' · ' + backup.recordCount + ' baris data, ' +
        new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(backup.size / 1024 / 1024) + ' MB).'
      )
    } catch (error) {
      setBackupError(error.message || 'Gagal membuat backup ke Supabase Storage.')
    } finally {
      setBackupSaving(false)
    }
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!confirm('Pulihkan backup ini? Seluruh data toko saat ini akan diganti dengan isi backup. Tindakan ini tidak dapat dibatalkan.')) return

    setRestoreSaving(true)
    setRestoreError('')
    setRestoreStatus('Menyiapkan pemulihan...')
    try {
      const result = await restoreBackupArchive(file, setRestoreStatus)
      setRestoreStatus(
        'Pemulihan selesai: ' + result.recordCount + ' baris data dan ' + result.imageCount + ' foto.' +
        (result.warning ? ' ' + result.warning : '')
      )
    } catch (error) {
      setRestoreError(error.message || 'Gagal memulihkan data dari backup.')
      setRestoreStatus('')
    } finally {
      setRestoreSaving(false)
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

      <section className="card settings-section backup-section">
        <div className="settings-section-heading">
          <div>
            <h3>Backup data</h3>
            <p className="muted small">Simpan seluruh data toko dan foto produk sebagai file ZIP privat di Supabase Storage.</p>
          </div>
        </div>
        {backupError && <p className="form-error" role="alert">{backupError}</p>}
        {backupStatus && <p className="backup-success" role="status">{backupStatus}</p>}
        <div className="backup-actions">
          <button className="btn btn-primary" type="button" disabled={backupSaving || restoreSaving} onClick={createBackup}>
          <Icon name="sync" size={16} />
          {backupSaving ? 'Membuat backup...' : 'Buat backup sekarang'}
          </button>
          <button
            className="btn"
            type="button"
            disabled={backupSaving || restoreSaving}
            onClick={() => restoreInputRef.current?.click()}>
            <Icon name="sync" size={16} />
            {restoreSaving ? 'Memulihkan backup...' : 'Pulihkan dari file ZIP'}
          </button>
          <input
            ref={restoreInputRef}
            className="backup-file-input"
            type="file"
            accept=".zip,application/zip"
            aria-label="Pilih file backup ZIP"
            onChange={restoreBackup}
          />
        </div>
        {restoreError && <p className="form-error" role="alert">{restoreError}</p>}
        {restoreStatus && <p className="backup-success" role="status">{restoreStatus}</p>}
      </section>
    </div>
  )
}
