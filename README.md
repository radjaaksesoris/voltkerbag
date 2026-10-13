# ⚡ VOLTKER — Aplikasi Toko Tas (Offline-First)

Aplikasi kasir toko tas dengan React + Vite. **Semua data tersimpan offline di IndexedDB**,
dan ada tombol **SINKRON SEKARANG** yang besar untuk mengirim data ke Supabase agar
device lain bisa memantau transaksi & keuangan.

## Fitur
- 📊 **Dashboard** — omzet, transaksi & laba hari ini, peringatan stok menipis, produk terlaris
- 🛒 **Kasir / Transaksi** — klik produk → keranjang → bayar (stok otomatis berkurang, pemasukan otomatis tercatat)
- 👜 **Stok Barang** — tambah/edit/hapus produk, harga beli & jual, badge stok menipis
- 💰 **Keuangan** — buku kas otomatis + catat pengeluaran/modal manual, laba kotor & bersih
- ⇅ **Sinkronisasi Supabase** — tombol besar di kanan atas; push + pull + hapus tersinkron

## Cara Menjalankan
```bash
npm install
npm run dev
```
Buka http://localhost:5173 — atau cukup double-click `start.bat` (Windows) / `start.sh` (Mac/Linux).

> Butuh Node.js 18, 20, atau 22+ yang terinstall.

## Deploy ke GitHub Pages
Workflow GitHub Actions membangun dan menerbitkan aplikasi setiap ada push ke branch `main`.
Atur **Settings → Pages → Build and deployment → Source** ke **GitHub Actions**.

## Setup Supabase (agar multi-device bisa sinkron)
1. Buat project gratis di https://supabase.com
2. Buka **SQL Editor** → paste isi file `supabase/schema.sql` → **Run**
3. Buka **Settings → API**, salin **Project URL** dan **anon public key**
4. Di aplikasi VOLTKER, klik ikon **⚙** di sebelah tombol kuning → paste keduanya → Simpan
5. Klik **SINKRON SEKARANG** — selesai. Ulangi di setiap device.

## Cara Kerja Sinkronisasi
- **Push**: semua data lokal di-upsert ke Supabase (tambah jika baru, update jika ada)
- **Delete**: produk/catatan yang dihapus ikut terhapus di Supabase
- **Pull**: data terbaru dari Supabase ditarik ke device ini (data dengan `updatedAt` terbaru menang)
- Indikator terakhir sinkron muncul saat kursor diarahkan ke tombol sinkron

## Catatan
- Tanpa konfigurasi Supabase pun aplikasi berjalan 100% offline.
- Angka `id` dari IndexedDB dipakai sebagai primary key di Supabase, sehingga data antar device tidak bertabrakan.
