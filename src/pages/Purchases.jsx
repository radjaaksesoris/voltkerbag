import { useEffect, useRef, useState } from 'react'
import { getAll, getPurchaseEntries, onRefresh, put } from '../db'
import { dateOnly, rupiah } from '../format'
import { dateRangeTimestamps, localDateValue } from '../dateFilter'
import MoneyInput from '../components/MoneyInput.jsx'
import VendorSelect from '../components/VendorSelect.jsx'
import { formatPurchaseNote, parsePurchaseNote } from '../purchaseNote.js'

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
  const [materialName, setMaterialName] = useState('')
  const [supplier, setSupplier] = useState('')
  const [vendors, setVendors] = useState([])
  const [amount, setAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => localDateValue(new Date()))
  const [saving, setSaving] = useState(false)
  const requestId = useRef(0)
  const vendorRequestId = useRef(0)
  const savingLock = useRef(false)

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

    async function loadVendors() {
      const request = ++vendorRequestId.current
      try {
        const rows = await getAll('vendors')
        if (!active || request !== vendorRequestId.current) return
        setVendors(rows)
        setVendorLoadError('')
      } catch (error) {
        if (active && request === vendorRequestId.current) {
          setVendorLoadError(error.message || 'Gagal memuat daftar vendor.')
        }
      }
    }

    load()
    loadVendors()
    const unsubscribe = onRefresh(() => {
      load()
      loadVendors()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [page])

  useEffect(() => {
    if (supplier && !vendors.some((vendor) => vendor.name === supplier)) setSupplier('')
  }, [supplier, vendors])

  async function savePurchase(event) {
    event.preventDefault()
    if (savingLock.current) return
    setActionError('')
    setStatus('')

    const cleanMaterialName = materialName.trim()
    const cleanSupplier = supplier.trim()
    const numericAmount = Number(amount)

    if (!cleanMaterialName) {
      setActionError('Nama pembelian wajib diisi.')
      return
    }
    if (vendorLoadError) {
      setActionError('Daftar vendor gagal dimuat. Muat ulang halaman sebelum menyimpan.')
      return
    }
    if (!vendors.some((vendor) => vendor.name === cleanSupplier)) {
      setActionError('Pilih vendor dari master vendor di tab Setting.')
      return
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setActionError('Total pembelian harus lebih dari Rp0.')
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
      await put('finance', {
        type: 'expense',
        category: PURCHASE_CATEGORY,
        note: formatPurchaseNote(cleanMaterialName, cleanSupplier),
        amount: numericAmount,
        date: new Date(purchaseDate + 'T12:00:00').toISOString(),
        refId: null,
        requestId: null
      })
      setMaterialName('')
      setSupplier('')
      setAmount('')
      setPurchaseDate(localDateValue(new Date()))
      setPage(1)
      setStatus('Pembelian bahan berhasil dicatat sebagai pengeluaran.')
    } catch (error) {
      setActionError(error.message || 'Gagal mencatat pembelian bahan.')
    } finally {
      savingLock.current = false
      setSaving(false)
    }
  }

  if (!loaded) return <div className="page"><p className="muted">Memuat riwayat pembelian...</p></div>
  if (loadError) {
    return (
      <div className="page">
        <p className="form-error" role="alert">{loadError}</p>
        <button className="btn" type="button" onClick={() => window.dispatchEvent(new CustomEvent('voltker:refresh'))}>
          Coba lagi
        </button>
      </div>
    )
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / PURCHASE_PAGE_SIZE))
  const pageStart = (page - 1) * PURCHASE_PAGE_SIZE

  return (
    <div className="page purchase-page">
      <section className="card purchase-form-card">
        <div className="purchase-heading">
          <div>
            <h2>Pembelian</h2>
            <p className="muted">Catat pembelian bahan produksi sebagai pengeluaran keuangan.</p>
          </div>
        </div>
        <p className="purchase-stock-notice">
          Catatan pembelian ini tidak menambah stok produk. Perubahan stok barang jadi dicatat di tab Stok Barang.
        </p>
        <form className="purchase-form" onSubmit={savePurchase}>
          <div className="purchase-form-grid">
            <div className="purchase-field">
              <label htmlFor="purchase-material">Pembelian *</label>
              <input
                id="purchase-material"
                className="input"
                value={materialName}
                onChange={(event) => setMaterialName(event.target.value)}
                maxLength={200}
                placeholder="Nama barang atau bahan yang dibeli"
                required
              />
            </div>
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
              <label htmlFor="purchase-amount">Nominal *</label>
              <MoneyInput
                id="purchase-amount"
                value={amount}
                onChange={setAmount}
                placeholder="Masukkan nominal pembelian"
                required
              />
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
          {status && <p className="backup-success" role="status">{status}</p>}
          <button className="btn btn-primary purchase-submit" type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan pembelian'}
          </button>
        </form>
      </section>

      <section className="card table-card purchase-history-card">
        <div className="purchase-history-heading">
          <div>
            <h3>Riwayat pembelian</h3>
            <p className="muted small">Daftar pembelian bahan yang sudah dicatat.</p>
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
              return (
                <tr key={entry.id}>
                  <td className="purchase-row-number">{pageStart + index + 1}</td>
                  <td className="purchase-details">{purchase.purchase}</td>
                  <td>{dateOnly(entry.date || entry.createdAt)}</td>
                  <td className="danger">{rupiah(entry.amount)}</td>
                  <td className="purchase-details">{purchase.vendor}</td>
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
