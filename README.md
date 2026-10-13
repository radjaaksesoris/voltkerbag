# ⚡ VOLTKER — Aplikasi Toko Tas (Offline-First)

Aplikasi kasir toko tas dengan React + Vite. **Semua data tersimpan offline di IndexedDB**,
dengan opsi sinkronisasi dan backup ke Supabase menggunakan login.

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

## Setup Supabase (sinkronisasi dan backup)
1. Buat project gratis di https://supabase.com
2. Di **Authentication → Users**, buat akun email dan kata sandi untuk perangkat ini.
3. Buka **SQL Editor** → paste isi file `supabase/schema.sql` → **Run**
4. Buka **Settings → API**, salin **Project URL** dan **anon public key**. Jangan gunakan `service_role` key di aplikasi browser.
5. Di aplikasi VOLTKER, klik ikon **⚙** → masukkan URL dan anon key → **Simpan konfigurasi**.
6. Masukkan email dan kata sandi akun Supabase tadi → **Masuk**, lalu klik **SINKRON SEKARANG**.

Tabel mengaktifkan Row Level Security: akun hanya dapat mengakses baris miliknya. Jika database lama sudah berisi data sebelum kolom `owner_id` ditambahkan, isi kolom tersebut dengan UUID akun toko sebelum sinkronisasi.

## Cara Kerja Sinkronisasi
- **Push**: semua data lokal di-upsert ke Supabase (tambah jika baru, update jika ada)
- **Delete**: produk/catatan yang dihapus ikut terhapus di Supabase
- **Pull**: data terbaru dari Supabase ditarik ke device ini (data dengan `updatedAt` terbaru menang)
- Indikator terakhir sinkron muncul saat kursor diarahkan ke tombol sinkron

## Catatan
- Tanpa konfigurasi Supabase pun aplikasi berjalan 100% offline.
- Angka `id` dari IndexedDB dipakai sebagai primary key di Supabase; data cloud dibatasi ke akun yang sedang masuk.
