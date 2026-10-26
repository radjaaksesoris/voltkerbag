import { useEffect, useRef, useState } from 'react'
import { createBackupArchive, getAll, onRefresh, put, remove, resetStoreData, restoreBackupArchive } from '../db'
import Icon from '../components/Icon.jsx'

export default function Settings() {
  const [customers, setCustomers] = useState([])
  const [vendors, setVendors] = useState([])
  const [expeditions, setExpeditions] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [editingVendor, setEditingVendor] = useState(null)
  const [editVendorName, setEditVendorName] = useState('')
  const [expeditionName, setExpeditionName] = useState('')
  const [editingExpedition, setEditingExpedition] = useState(null)
  const [editExpeditionName, setEditExpeditionName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [vendorActionError, setVendorActionError] = useState('')
  const [expeditionActionError, setExpeditionActionError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [backupSaving, setBackupSaving] = useState(false)
  const [backupStatus, setBackupStatus] = useState('')
  const [backupError, setBackupError] = useState('')
  const [restoreSaving, setRestoreSaving] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const restoreInputRef = useRef(null)

  async function load() {
    try {
      const [customerRows, vendorRows, expeditionRows] = await Promise.all([
        getAll('customers'),
        getAll('vendors'),
        getAll('expeditions')
      ])
      setCustomers(customerRows)
      setVendors(vendorRows)
      setExpeditions(expeditionRows)
      setLoadError('')
    } catch (error) {
      setLoadError(error.message || 'Gagal memuat data pelanggan, vendor, dan ekspedisi.')
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
      await put('customers', {
        name: normalizedName,
        phone: phone.trim() || null,
        address: address.trim() || null
      })
      setName('')
      setPhone('')
      setAddress('')
    } catch (error) {
      setActionError(error.message || 'Gagal menambahkan nama pelanggan.')
    } finally {
      setSaving(false)
    }
  }

  function startEditingCustomer(customer) {
    setActionError('')
    setEditingCustomer(customer)
    setEditName(customer.name)
    setEditPhone(customer.phone || '')
    setEditAddress(customer.address || '')
  }

  function cancelEditingCustomer() {
    setEditingCustomer(null)
    setEditName('')
    setEditPhone('')
    setEditAddress('')
  }

  async function saveCustomer(event) {
    event.preventDefault()
    const normalizedName = editName.trim()
    if (!normalizedName) {
      setActionError('Nama pelanggan wajib diisi.')
      return
    }
    if (customers.some((customer) =>
      customer.id !== editingCustomer.id
      && customer.name.toLocaleLowerCase('id-ID') === normalizedName.toLocaleLowerCase('id-ID')
    )) {
      setActionError('Nama pelanggan tersebut sudah ada.')
      return
    }

    setSaving(true)
    setActionError('')
    try {
      await put('customers', {
        ...editingCustomer,
        name: normalizedName,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null
      })
      cancelEditingCustomer()
    } catch (error) {
      setActionError(error.message || 'Gagal memperbarui data pelanggan.')
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

  async function addVendor(event) {
    event.preventDefault()
    const normalizedName = vendorName.trim()
    if (!normalizedName) {
      setVendorActionError('Nama vendor wajib diisi.')
      return
    }
    if (vendors.some((vendor) => vendor.name.toLocaleLowerCase('id-ID') === normalizedName.toLocaleLowerCase('id-ID'))) {
      setVendorActionError('Nama vendor tersebut sudah ada.')
      return
    }

    setSaving(true)
    setVendorActionError('')
    try {
      await put('vendors', { name: normalizedName })
      setVendorName('')
    } catch (error) {
      setVendorActionError(error.message || 'Gagal menambahkan nama vendor.')
    } finally {
      setSaving(false)
    }
  }

  function startEditingVendor(vendor) {
    setVendorActionError('')
    setEditingVendor(vendor)
    setEditVendorName(vendor.name)
  }

  function cancelEditingVendor() {
    setEditingVendor(null)
    setEditVendorName('')
  }

  async function saveVendor(event) {
    event.preventDefault()
    const normalizedName = editVendorName.trim()
    if (!normalizedName) {
      setVendorActionError('Nama vendor wajib diisi.')
      return
    }
    if (vendors.some((vendor) =>
      vendor.id !== editingVendor.id
      && vendor.name.toLocaleLowerCase('id-ID') === normalizedName.toLocaleLowerCase('id-ID')
    )) {
      setVendorActionError('Nama vendor tersebut sudah ada.')
      return
    }

    setSaving(true)
    setVendorActionError('')
    try {
      await put('vendors', { ...editingVendor, name: normalizedName })
      cancelEditingVendor()
    } catch (error) {
      setVendorActionError(error.message || 'Gagal memperbarui nama vendor.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteVendor(vendor) {
    if (!confirm('Hapus nama vendor "' + vendor.name + '" dari daftar? Riwayat pembelian tidak akan dihapus.')) return
    setVendorActionError('')
    try {
      await remove('vendors', vendor.id)
    } catch (error) {
      setVendorActionError(error.message || 'Gagal menghapus nama vendor.')
    }
  }

  async function addExpedition(event) {
    event.preventDefault()
    const normalizedName = expeditionName.trim()
    if (!normalizedName) {
      setExpeditionActionError('Nama ekspedisi wajib diisi.')
      return
    }
    if (expeditions.some((expedition) => expedition.name.toLocaleLowerCase('id-ID') === normalizedName.toLocaleLowerCase('id-ID'))) {
      setExpeditionActionError('Nama ekspedisi tersebut sudah ada.')
      return
    }

    setSaving(true)
    setExpeditionActionError('')
    try {
      await put('expeditions', { name: normalizedName })
      setExpeditionName('')
    } catch (error) {
      setExpeditionActionError(error.message || 'Gagal menambahkan nama ekspedisi.')
    } finally {
      setSaving(false)
    }
  }

  function startEditingExpedition(expedition) {
    setExpeditionActionError('')
    setEditingExpedition(expedition)
    setEditExpeditionName(expedition.name)
  }

  function cancelEditingExpedition() {
    setEditingExpedition(null)
    setEditExpeditionName('')
  }

  async function saveExpedition(event) {
    event.preventDefault()
    const normalizedName = editExpeditionName.trim()
    if (!normalizedName) {
      setExpeditionActionError('Nama ekspedisi wajib diisi.')
      return
    }
    if (expeditions.some((expedition) =>
      expedition.id !== editingExpedition.id
      && expedition.name.toLocaleLowerCase('id-ID') === normalizedName.toLocaleLowerCase('id-ID')
    )) {
      setExpeditionActionError('Nama ekspedisi tersebut sudah ada.')
      return
    }

    setSaving(true)
    setExpeditionActionError('')
    try {
      await put('expeditions', { ...editingExpedition, name: normalizedName })
      cancelEditingExpedition()
    } catch (error) {
      setExpeditionActionError(error.message || 'Gagal memperbarui nama ekspedisi.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExpedition(expedition) {
    if (!confirm('Hapus nama ekspedisi "' + expedition.name + '" dari daftar? Riwayat transaksi tidak akan diubah.')) return
    setExpeditionActionError('')
    try {
      await remove('expeditions', expedition.id)
    } catch (error) {
      setExpeditionActionError(error.message || 'Gagal menghapus nama ekspedisi.')
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

  async function resetStore() {
    if (resetConfirmation !== 'HAPUS DATA') return

    setResetSaving(true)
    setResetError('')
    setResetStatus('')
    try {
      await resetStoreData()
      setCustomers([])
      setVendors([])
      setExpeditions([])
      setName('')
      setPhone('')
      setAddress('')
      setEditingCustomer(null)
      setEditName('')
      setEditPhone('')
      setEditAddress('')
      setVendorName('')
      setEditingVendor(null)
      setEditVendorName('')
      setExpeditionName('')
      setEditingExpedition(null)
      setEditExpeditionName('')
      setActionError('')
      setVendorActionError('')
      setExpeditionActionError('')
      setResetStatus('Data operasional berhasil dibersihkan. Akun, backup, dan foto produk tetap tersimpan.')
      setResetConfirmation('')
      setShowResetDialog(false)
    } catch (error) {
      setResetError(error.message || 'Gagal membersihkan data toko.')
    } finally {
      setResetSaving(false)
    }
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat data pelanggan, vendor, dan ekspedisi...</p></div>
  if (loadError) {
    return <div className="page"><p className="form-error" role="alert">{loadError}</p>
      <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>Coba lagi</button>
    </div>
  }

  return (
    <div className="page settings-page">
      <details className="card settings-section" defaultOpen>
        <summary className="settings-section-heading">
          <div>
            <h3>Nama pelanggan</h3>
            <p className="muted small">Kelola pilihan nama yang tersedia di kasir.</p>
          </div>
          <div className="settings-section-controls">
            <span className="settings-count">{customers.length} nama</span>
            <Icon name="chevronDown" size={18} />
          </div>
        </summary>
        <div className="settings-section-content">

        {actionError && <p className="form-error" role="alert">{actionError}</p>}

        <form className="settings-add-form" onSubmit={addCustomer}>
          <div className="settings-customer-fields">
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
            <div>
              <label htmlFor="new-customer-phone">No. telepon (opsional)</label>
              <input
                id="new-customer-phone"
                className="input"
                type="tel"
                autoComplete="tel"
                maxLength={32}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Contoh: 081234567890"
              />
            </div>
            <div>
              <label htmlFor="new-customer-address">Alamat (opsional)</label>
              <input
                id="new-customer-address"
                className="input"
                autoComplete="street-address"
                maxLength={250}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Masukkan alamat pelanggan"
              />
            </div>
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
                {editingCustomer?.id === customer.id ? (
                  <form className="customer-edit-form" onSubmit={saveCustomer}>
                    <div className="settings-customer-fields">
                      <div>
                        <label htmlFor={'edit-customer-name-' + customer.id}>Nama pelanggan</label>
                        <input
                          id={'edit-customer-name-' + customer.id}
                          className="input"
                          value={editName}
                          maxLength={100}
                          onChange={(event) => setEditName(event.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor={'edit-customer-phone-' + customer.id}>No. telepon (opsional)</label>
                        <input
                          id={'edit-customer-phone-' + customer.id}
                          className="input"
                          type="tel"
                          autoComplete="tel"
                          maxLength={32}
                          value={editPhone}
                          onChange={(event) => setEditPhone(event.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor={'edit-customer-address-' + customer.id}>Alamat (opsional)</label>
                        <input
                          id={'edit-customer-address-' + customer.id}
                          className="input"
                          autoComplete="street-address"
                          maxLength={250}
                          value={editAddress}
                          onChange={(event) => setEditAddress(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="customer-actions">
                      <button className="btn btn-sm" type="button" onClick={cancelEditingCustomer} disabled={saving}>Batal</button>
                      <button className="btn btn-sm btn-primary" type="submit" disabled={saving || !editName.trim()}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="customer-info">
                      <strong>{customer.name}</strong>
                      {(customer.phone || customer.address) && (
                        <span className="customer-contact">
                          {[customer.phone, customer.address].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                    <div className="customer-actions">
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={() => startEditingCustomer(customer)}
                        disabled={saving}
                        aria-label={'Edit ' + customer.name}>
                        <Icon name="edit" size={14} />
                        <span className="settings-action-label">Edit</span>
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        type="button"
                        aria-label={'Hapus ' + customer.name}
                        onClick={() => deleteCustomer(customer)}
                        disabled={saving}>
                        <Icon name="trash" size={14} />
                        <span className="settings-action-label">Hapus</span>
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>

      <details className="card settings-section">
        <summary className="settings-section-heading">
          <div>
            <h3>Nama vendor</h3>
            <p className="muted small">Kelola pilihan vendor yang tersedia saat mencatat pembelian.</p>
          </div>
          <div className="settings-section-controls">
            <span className="settings-count">{vendors.length} nama</span>
            <Icon name="chevronDown" size={18} />
          </div>
        </summary>
        <div className="settings-section-content">

        {vendorActionError && <p className="form-error" role="alert">{vendorActionError}</p>}

        <form className="settings-add-form settings-vendor-add-form" onSubmit={addVendor}>
          <div>
            <label htmlFor="new-vendor-name">Nama vendor baru</label>
            <input
              id="new-vendor-name"
              className="input"
              value={vendorName}
              maxLength={120}
              onChange={(event) => setVendorName(event.target.value)}
              placeholder="Masukkan nama vendor"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !vendorName.trim()}>
            <Icon name="plus" size={16} /> {saving ? 'Menyimpan...' : 'Tambah nama'}
          </button>
        </form>

        {vendors.length === 0 ? (
          <div className="settings-empty">
            <span>Daftar vendor masih kosong.</span>
            <span>Tambahkan nama di atas agar bisa dipilih saat mencatat pembelian.</span>
          </div>
        ) : (
          <ul className="customer-list">
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                {editingVendor?.id === vendor.id ? (
                  <form className="customer-edit-form settings-vendor-edit-form" onSubmit={saveVendor}>
                    <div>
                      <label htmlFor={'edit-vendor-name-' + vendor.id}>Nama vendor</label>
                      <input
                        id={'edit-vendor-name-' + vendor.id}
                        className="input"
                        value={editVendorName}
                        maxLength={120}
                        onChange={(event) => setEditVendorName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="customer-actions">
                      <button className="btn btn-sm" type="button" onClick={cancelEditingVendor} disabled={saving}>Batal</button>
                      <button className="btn btn-sm btn-primary" type="submit" disabled={saving || !editVendorName.trim()}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="customer-info"><strong>{vendor.name}</strong></div>
                    <div className="customer-actions">
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={() => startEditingVendor(vendor)}
                        disabled={saving}
                        aria-label={'Edit ' + vendor.name}>
                        <Icon name="edit" size={14} />
                        <span className="settings-action-label">Edit</span>
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        type="button"
                        aria-label={'Hapus ' + vendor.name}
                        onClick={() => deleteVendor(vendor)}
                        disabled={saving}>
                        <Icon name="trash" size={14} />
                        <span className="settings-action-label">Hapus</span>
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>

      <details className="card settings-section">
        <summary className="settings-section-heading">
          <div>
            <h3>Nama ekspedisi</h3>
            <p className="muted small">Kelola pilihan ekspedisi yang tersedia saat checkout transaksi.</p>
          </div>
          <div className="settings-section-controls">
            <span className="settings-count">{expeditions.length} nama</span>
            <Icon name="chevronDown" size={18} />
          </div>
        </summary>
        <div className="settings-section-content">

        {expeditionActionError && <p className="form-error" role="alert">{expeditionActionError}</p>}

        <form className="settings-add-form settings-vendor-add-form" onSubmit={addExpedition}>
          <div>
            <label htmlFor="new-expedition-name">Nama ekspedisi baru</label>
            <input
              id="new-expedition-name"
              className="input"
              value={expeditionName}
              maxLength={120}
              onChange={(event) => setExpeditionName(event.target.value)}
              placeholder="Masukkan nama ekspedisi"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving || !expeditionName.trim()}>
            <Icon name="plus" size={16} /> {saving ? 'Menyimpan...' : 'Tambah nama'}
          </button>
        </form>

        {expeditions.length === 0 ? (
          <div className="settings-empty">
            <span>Daftar ekspedisi masih kosong.</span>
            <span>Tambahkan nama di atas agar bisa dipilih saat checkout.</span>
          </div>
        ) : (
          <ul className="customer-list">
            {expeditions.map((expedition) => (
              <li key={expedition.id}>
                {editingExpedition?.id === expedition.id ? (
                  <form className="customer-edit-form settings-vendor-edit-form" onSubmit={saveExpedition}>
                    <div>
                      <label htmlFor={'edit-expedition-name-' + expedition.id}>Nama ekspedisi</label>
                      <input
                        id={'edit-expedition-name-' + expedition.id}
                        className="input"
                        value={editExpeditionName}
                        maxLength={120}
                        onChange={(event) => setEditExpeditionName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="customer-actions">
                      <button className="btn btn-sm" type="button" onClick={cancelEditingExpedition} disabled={saving}>Batal</button>
                      <button className="btn btn-sm btn-primary" type="submit" disabled={saving || !editExpeditionName.trim()}>
                        {saving ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="customer-info"><strong>{expedition.name}</strong></div>
                    <div className="customer-actions">
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={() => startEditingExpedition(expedition)}
                        disabled={saving}
                        aria-label={'Edit ' + expedition.name}>
                        <Icon name="edit" size={14} />
                        <span className="settings-action-label">Edit</span>
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        type="button"
                        aria-label={'Hapus ' + expedition.name}
                        onClick={() => deleteExpedition(expedition)}
                        disabled={saving}>
                        <Icon name="trash" size={14} />
                        <span className="settings-action-label">Hapus</span>
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </details>

      <details className="card settings-section backup-section">
        <summary className="settings-section-heading">
          <div>
            <h3>Backup data</h3>
            <p className="muted small">Simpan seluruh data toko dan foto produk sebagai file ZIP privat di Supabase Storage.</p>
          </div>
          <Icon name="chevronDown" size={18} />
        </summary>
        <div className="settings-section-content">
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
        </div>
      </details>

      <details className="card settings-section reset-section">
        <summary className="settings-section-heading">
          <div>
            <h3>Reset data toko</h3>
            <p className="muted small">Hapus data operasional agar toko dapat dimulai kembali dari awal.</p>
          </div>
          <Icon name="chevronDown" size={18} />
        </summary>
        <div className="settings-section-content">
        <p className="reset-description">
          Produk dan stok, transaksi, data keuangan dan hutang, daftar pelanggan, kategori, serta satuan akan dihapus.
          Akun login, file backup, dan foto produk di penyimpanan tetap dipertahankan.
        </p>
        {resetError && !showResetDialog && <p className="form-error" role="alert">{resetError}</p>}
        {resetStatus && <p className="backup-success" role="status">{resetStatus}</p>}
        <button
          className="btn btn-danger"
          type="button"
          disabled={saving || backupSaving || restoreSaving || resetSaving}
          onClick={() => {
            setResetError('')
            setResetConfirmation('')
            setShowResetDialog(true)
          }}>
          <Icon name="trash" size={15} /> Reset semua data toko
        </button>
        </div>
      </details>

      {showResetDialog && (
        <div className="overlay" onClick={() => !resetSaving && setShowResetDialog(false)}>
          <section
            className="modal reset-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
            aria-describedby="reset-dialog-description"
            onClick={(event) => event.stopPropagation()}>
            <h3 id="reset-dialog-title">Hapus semua data toko?</h3>
            <p id="reset-dialog-description" className="muted">
              Tindakan ini permanen untuk data operasional akun ini. Akun login, backup, dan foto produk tidak akan dihapus.
              Buat backup terlebih dahulu jika data ini mungkin diperlukan lagi.
            </p>
            <label htmlFor="reset-confirmation">Ketik <strong>HAPUS DATA</strong> untuk melanjutkan</label>
            <input
              id="reset-confirmation"
              className="input"
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck="false"
              disabled={resetSaving}
            />
            {resetError && <p className="form-error" role="alert">{resetError}</p>}
            <div className="modal-actions">
              <button
                className="btn"
                type="button"
                onClick={() => setShowResetDialog(false)}
                disabled={resetSaving}>
                Batal
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={resetStore}
                disabled={resetSaving || resetConfirmation !== 'HAPUS DATA'}>
                {resetSaving ? 'Menghapus data...' : 'Hapus semua data'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
