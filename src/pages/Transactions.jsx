import { useEffect, useMemo, useState } from 'react'
import { getAll, put, onRefresh } from '../db'
import { rupiah, dateTime, isToday } from '../format'

export default function Transactions() {
  const [products, setProducts] = useState([])
  const [history, setHistory] = useState([])
  const [cart, setCart] = useState([])
  const [q, setQ] = useState('')
  const [pay, setPay] = useState('')
  const [done, setDone] = useState(null)

  async function load() {
    setProducts(await getAll('products'))
    const txs = await getAll('transactions')
    setHistory(txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }
  useEffect(() => {
    load()
    return onRefresh(load)
  }, [])

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) && Number(p.stock) > 0
  )
  const total = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])
  const change = Number(pay || 0) - total

  function addToCart(p) {
    setCart((prev) => {
      const found = prev.find((c) => c.productId === p.id)
      if (found) {
        if (found.qty + 1 > p.stock) { alert('Stok "' + p.name + '" tidak cukup!'); return prev }
        return prev.map((c) => (c.productId === p.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { productId: p.id, name: p.name, price: p.price, cost: p.cost || 0, qty: 1, stock: p.stock }]
    })
  }
  function setQty(productId, qty) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((c) => c.productId !== productId)
        : prev.map((c) => (c.productId === productId ? { ...c, qty: Math.min(qty, c.stock) } : c))
    )
  }

  async function checkout() {
    if (cart.length === 0) return alert('Keranjang masih kosong')
    if (change < 0) return alert('Uang pembayaran kurang')
    const now = new Date().toISOString()
    // 1) simpan transaksi
    const txId = await put('transactions', {
      items: cart.map((c) => ({ productId: c.productId, name: c.name, price: c.price, cost: c.cost, qty: c.qty })),
      total, payment: Number(pay || 0), change
    })
    // 2) kurangi stok
    for (const c of cart) {
      const p = products.find((x) => x.id === c.productId)
      if (p) await put('products', { ...p, stock: Number(p.stock) - c.qty })
    }
    // 3) catat pemasukan otomatis ke finance
    await put('finance', {
      type: 'income', category: 'Penjualan',
      amount: total, note: 'Transaksi #' + txId + ' (' + cart.reduce((s, c) => s + c.qty, 0) + ' item)',
      refId: txId, date: now
    })
    setDone({ id: txId, total, payment: Number(pay || 0), change })
    setCart([]); setPay('')
  }

  const todayCount = history.filter((t) => isToday(t.createdAt)).length
  const todayOmzet = history.filter((t) => isToday(t.createdAt)).reduce((s, t) => s + t.total, 0)

  return (
    <div className="page">
      <div className="page-toolbar">
        <p className="muted">Hari ini <strong>{todayCount} transaksi</strong> · {rupiah(todayOmzet)}</p>
      </div>

      <div className="pos-grid">
        <div>
          <input className="input search" placeholder="Cari tas... (stok 0 disembunyikan)"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="product-grid">
            {filtered.length === 0 && <p className="muted">Tidak ada produk. Tambahkan di menu Stok Barang.</p>}
            {filtered.map((p) => (
              <button key={p.id} className="product-card" onClick={() => addToCart(p)}>
                <div className="product-emoji">👜</div>
                <strong>{p.name}</strong>
                <span className="muted small">{p.category || 'Umum'} · stok {p.stock}</span>
                <span className="accent">{rupiah(p.price)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card cart">
          <h3>Keranjang</h3>
          {cart.length === 0 && <p className="muted">Klik produk untuk menambahkan.</p>}
          {cart.map((c) => (
            <div key={c.productId} className="cart-row">
              <div className="cart-info">
                <strong>{c.name}</strong>
                <span className="muted small">{rupiah(c.price)}</span>
              </div>
              <div className="qty-ctrl">
                <button onClick={() => setQty(c.productId, c.qty - 1)}>−</button>
                <span>{c.qty}</span>
                <button onClick={() => setQty(c.productId, c.qty + 1)}>+</button>
              </div>
              <span className="cart-sub">{rupiah(c.price * c.qty)}</span>
            </div>
          ))}

          <div className="cart-total">
            <span>Total</span>
            <strong className="accent">{rupiah(total)}</strong>
          </div>
          <label className="muted small">Uang Tunai (Rp)</label>
          <input className="input" type="number" min="0" value={pay} onChange={(e) => setPay(e.target.value)} placeholder={total || 0} />
          <div className={'change ' + (change < 0 ? 'negative' : '')}>
            Kembalian: <strong>{rupiah(change < 0 ? 0 : change)}</strong>
          </div>
          <button className="btn btn-primary btn-block btn-lg" onClick={checkout} disabled={cart.length === 0}>
            ⚡ Bayar & Simpan
          </button>
        </div>
      </div>

      <div className="card table-card">
        <h3>Riwayat Transaksi</h3>
        <table>
          <thead><tr><th>ID</th><th>Waktu</th><th>Item</th><th>Total</th><th>Bayar</th><th>Kembalian</th></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan="6" className="muted center">Belum ada transaksi.</td></tr>}
            {history.slice(0, 50).map((t) => (
              <tr key={t.id}>
                <td>#{t.id}</td>
                <td>{dateTime(t.createdAt)}</td>
                <td>{t.items.map((i) => i.name + ' ×' + i.qty).join(', ')}</td>
                <td className="accent"><strong>{rupiah(t.total)}</strong></td>
                <td>{rupiah(t.payment)}</td>
                <td>{rupiah(t.change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {done && (
        <div className="overlay" onClick={() => setDone(null)}>
          <div className="modal center-text" onClick={(e) => e.stopPropagation()}>
            <div className="success-icon">✓</div>
            <h3>Transaksi #{done.id} Berhasil</h3>
            <p className="muted">Total {rupiah(done.total)} · Bayar {rupiah(done.payment)} · Kembali {rupiah(done.change)}</p>
            <button className="btn btn-primary" onClick={() => setDone(null)}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  )
}
