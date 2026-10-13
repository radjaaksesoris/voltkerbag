# ⚡ VOLTKER — Aplikasi Toko Tas (Offline-First)

Aplikasi kasir toko tas dengan React + Vite. **Semua data tersimpan offline di IndexedDB**,
dengan opsi sinkronisasi dan backup ke Supabase menggunakan login.

## Fitur
- 📊 **Dashboard** — ringkasan omzet, laba, dan kondisi stok
- 🛒 **Kasir / Transaksi** — nama pelanggan wajib; pembayaran tunai atau kredit tanpa bunga, termasuk DP opsional dan pencatatan cicilan
- 🧾 **Struk transaksi** — format cetak hitam-putih untuk printer dot matrix dan kertas continuous form 24 × 14 cm; struk bisa dicetak sesudah transaksi atau dicetak ulang dari riwayat
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
4. Buka **Settings → API Keys**, salin **anon/public key**. Jangan gunakan `service_role`/secret key di aplikasi browser.
5. Untuk GitHub Pages, tambahkan repository Actions secret bernama `VITE_SUPABASE_ANON_KEY`, lalu jalankan workflow deploy kembali. URL project sudah dikonfigurasi di aplikasi.
6. Untuk lokal, isi `VITE_SUPABASE_ANON_KEY=...` di `.env.local`, lalu jalankan ulang `npm run dev`.
7. Di aplikasi VOLTKER, klik ikon **⚙**, masuk dengan email dan kata sandi akun Supabase, lalu klik **SINKRON SEKARANG**.

Public key akan disertakan dalam bundle browser dan bukan rahasia. Tabel mengaktifkan Row Level Security agar hanya akun yang masuk dapat mengakses baris miliknya. Jika database lama sudah berisi data sebelum kolom `owner_id` ditambahkan, isi kolom tersebut dengan UUID akun toko sebelum sinkronisasi.

## Cara Kerja Sinkronisasi
- **Push**: semua data lokal di-upsert ke Supabase (tambah jika baru, update jika ada)
- **Delete**: produk/catatan yang dihapus ikut terhapus di Supabase
- **Pull**: data terbaru dari Supabase ditarik ke device ini (data dengan `updatedAt` terbaru menang)
- Indikator terakhir sinkron muncul saat kursor diarahkan ke tombol sinkron

## Catatan
- Tanpa konfigurasi Supabase pun aplikasi berjalan 100% offline.
- Angka `id` dari IndexedDB dipakai sebagai primary key di Supabase; data cloud dibatasi ke akun yang sedang masuk.
- Pembayaran kredit dicatat di buku kas hanya saat uang diterima (DP dan cicilan). Skema Supabase menambahkan kolom pelanggan, metode pembayaran, jumlah terbayar, sisa tagihan, dan riwayat pembayaran transaksi.
- Jika skema Supabase sudah pernah dibuat, jalankan kembali isi `supabase/schema.sql` agar kolom transaksi kredit ditambahkan sebelum sinkronisasi.
- Saat mencetak struk, pilih ukuran kertas khusus **240 × 140 mm** di pengaturan printer, gunakan sumber kertas tractor feed/continuous form, orientasi landscape, skala 100%, dan matikan header/footer browser. Konfigurasi ukuran kertas juga perlu disimpan pada driver printer.
