# VOLTKER — Aplikasi Toko Tas Online

VOLTKER adalah aplikasi kasir React + Vite dengan Supabase sebagai sumber data utama. **Koneksi internet dan login akun toko wajib digunakan.** Aplikasi tidak membaca, menulis, atau mengimpor data dari IndexedDB/perangkat.

## Fitur
- Dashboard penjualan, stok, riwayat transaksi, filter tanggal, dan detail barang.
- Kasir tunai/kredit dengan nama pelanggan wajib; checkout dan pengurangan stok diproses atomik di database.
- Pembayaran cicilan kredit tanpa bunga, dengan validasi saldo dan pencatatan buku kas di server.
- Cetak ulang dan pratinjau struk continuous form 24 × 14 cm.
- CRUD stok produk dan buku kas online.

## Setup Supabase
1. Pastikan project Supabase yang dipakai adalah project VOLTKER yang benar.
2. Di **Authentication → Users**, buat satu akun toko. Jangan aktifkan pendaftaran publik; hanya akun ini yang boleh digunakan.
3. Jalankan seluruh `supabase/schema.sql` di **SQL Editor**. Jika skema pernah dijalankan sebelumnya, jalankan ulang file terbaru ini untuk menyiapkan tabel kategori/satuan produk dan memasukkan kategori serta satuan awal ke daftar pilihan.
4. Setelah memastikan pengosongan memang diinginkan, jalankan `supabase/clear-data.sql` satu kali. **Perintah ini menghapus permanen semua produk, transaksi, dan catatan keuangan di project tersebut serta memulai ulang ID.**
5. Salin Supabase anon/publishable key (bukan `service_role` atau secret key).
6. Untuk GitHub Pages, simpan key sebagai repository Actions secret `VITE_SUPABASE_ANON_KEY`, lalu jalankan workflow deploy. Untuk lokal, isi `VITE_SUPABASE_ANON_KEY` dalam `.env.local`.

`schema.sql` menyiapkan tabel, Row Level Security, dan fungsi database untuk checkout serta pembayaran cicilan. Database kosong setelah `clear-data.sql`; data di browser lama tidak akan dipindahkan. Jangan jalankan `clear-data.sql` lagi setelah mulai memasukkan data toko.

Kategori dan satuan produk dikelola di database. Kategori/satuan yang masih dipakai produk tidak dapat dihapus; ubah data produk terkait terlebih dahulu. Satuan awal yang tersedia: pcs, lusin, dan kodi. Satuan produk ikut dicatat di item transaksi, detail transaksi, dan struk.

## Menjalankan lokal
```bash
npm install
npm run dev
```

Buka URL yang dicetak Vite. Untuk build lokal:
```bash
npm run build
```

## Deploy ke GitHub Pages
Workflow `.github/workflows/deploy.yml` membangun dan menerbitkan folder `dist` dari branch `main`. Pastikan secret `VITE_SUPABASE_ANON_KEY` sudah tersedia sebelum deploy; tanpa key, aplikasi menampilkan instruksi konfigurasi dan tidak membuka fitur toko.

## Online-only dan akses akun
- Login divalidasi ke server sebelum aplikasi ditampilkan; status jaringan dipantau dan login ulang dibutuhkan jika koneksi server gagal.
- Seluruh baca/tulis data dilakukan langsung ke Supabase. Data yang sempat terlihat tidak disimpan sebagai cache aplikasi untuk penggunaan offline.
- RLS membatasi setiap akun ke baris dengan `owner_id` akun tersebut. Buat hanya satu akun toko melalui Supabase Auth dan nonaktifkan sign-up publik.
- Anon/publishable key memang dikirim ke browser. Keamanan data bergantung pada Supabase Auth, RLS, dan fungsi database; jangan pernah menaruh service-role key pada aplikasi frontend.
- Jika secret diubah, jalankan ulang build/deploy karena Vite memasukkan nilainya ke bundle pada waktu build.
- Jika server tidak dapat dijangkau, aplikasi menampilkan kegagalan secara eksplisit dan operasi tidak disimpan secara lokal.

## Printer struk
Pilih ukuran kertas khusus **240 × 140 mm**, continuous form/tractor feed, orientasi landscape, skala 100%, dan matikan header/footer browser. Simpan ukuran tersebut di driver printer.
