import { useEffect, useMemo, useState } from 'react'
import { getAll, put, remove, onRefresh } from '../db'
import { rupiah, dateTime } from '../format'

const TYPES = {
  income: { label: 'Pemasukan', cls: 'badge-ok' },
  expense: { label: 'Pengeluaran', cls: 'badge-danger' },
  capital: { label: 'Modal', cls: 'badge-neutral' }
}

export default function Finance() {
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ type: 'expense', amount: '', note: '', category: '' })

  async function load() { setEntries(await getAll('finance')) }
  useEffect(() => {
    load()
    return onRefresh(load)
  }, [])

  const sorted = useMemo(
    () => [...entries].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
    [entries]
  )
  const sum = (t) => entries.filter((e) => e.type === t).reduce((s, e) => s + Number(e.amount), 0)
  const income = sum('income'), expense = sum('expense'), capital = sum('capital')
  const balance = income + capital - expense

  // laba kotor dari transaksi: (harga jual - harga beli) × qty
  const [txs, setTxs] = useState([])
  useEffect(() => {
    getAll('transactions').then(setTxs)
    return onRefresh(async () => setTxs(await getAll('transactions')))
  }, [])
  const grossProfit = txs.reduce(
    (s, t) => s + t.items.reduce((a, i) => a + (i.price - (i.cost || 0)) * i.qty, 0), 0
  )
  const netProfit = grossProfit - expense

  async function addEntry(e) {
    e.preventDefault()
    if (!form.amount) return alert('Nominal wajib diisi')
    await put('finance', {
      type: form.type, amount: Number(form.amount),
      note: form.note.trim(), category: form.category.trim(),
      date: new Date().toISOString()
    })
    setForm({ type: 'expense', amount: '', note: '', category: '' })
  }

  return (
    <div className="page">
      <div className="stats-grid">
        <div className="stat-card"><span>Pemasukan Penjualan</span><strong className="ok">+{rupiah(income)}</strong></div>
        <div className="stat-card"><span>Pengeluaran</span><strong className="danger">−{rupiah(expense)}</strong></div>
        <div className="stat-card"><span>Modal Masuk</span><strong>{rupiah(capital)}</strong></div>
        <div className="stat-card highlight"><span>Saldo Kas</span><strong>{rupiah(balance)}</strong></div>
        <div className="stat-card"><span>Laba Kotor</span><strong className="ok">{rupiah(grossProfit)}</strong></div>
        <div className="stat-card"><span>Laba Bersih</span><strong className={netProfit >= 0 ? 'ok' : 'danger'}>{rupiah(netProfit)}</strong></div>
      </div>

      <div className="finance-grid">
        <form className="card" onSubmit={addEntry}>
          <h3>Catat Manual</h3>
          <label>Jenis</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="expense">Pengeluaran (operasional, gaji, dll)</option>
            <option value="capital">Modal (setoran pemilik)</option>
            <option value="income">Pemasukan lain</option>
          </select>
          <label>Nominal (Rp)</label>
          <input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <label>Kategori</label>
          <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="cth: Listrik, Sewa, Gaji" />
          <label>Catatan</label>
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="cth: Bayar listrik Oktober" />
          <button type="submit" className="btn btn-primary btn-block">Simpan Catatan</button>
        </form>

        <div className="card table-card">
          <h3>Buku Kas</h3>
          <table>
            <thead><tr><th>Waktu</th><th>Jenis</th><th>Kategori</th><th>Catatan</th><th className="right">Nominal</th><th></th></tr></thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan="6" className="muted center">Belum ada catatan.</td></tr>}
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td>{dateTime(e.date || e.createdAt)}</td>
                  <td><span className={'badge ' + TYPES[e.type].cls}>{TYPES[e.type].label}</span></td>
                  <td>{e.category || '-'}</td>
                  <td>{e.note || '-'}</td>
                  <td className={'right ' + (e.type === 'expense' ? 'danger' : 'ok')}>
                    {e.type === 'expense' ? '−' : '+'}{rupiah(e.amount)}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={async () => {
                      if (confirm('Hapus catatan ini?')) await remove('finance', e.id)
                    }}>Hapus</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
