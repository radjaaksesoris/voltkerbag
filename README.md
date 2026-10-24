# VOLTKER — Aplikasi Toko Tas Online

VOLTKER adalah aplikasi kasir React + Vite dengan Supabase sebagai sumber data utama. **Koneksi internet dan login akun toko wajib digunakan.** Aplikasi tidak membaca, menulis, atau mengimpor data dari IndexedDB/perangkat.

## Fitur
- Dashboard penjualan, stok, riwayat transaksi, filter tanggal, dan detail barang.
- Daftar nama pelanggan di tab Setting, dengan pilihan pelanggan wajib saat checkout.
- Foto produk yang diunggah dari form Tambah/Edit Produk dan disimpan di Supabase Storage.
- Kasir tunai/kredit dengan nama pelanggan wajib; checkout dan pengurangan stok diproses atomik di database.
- Penambahan stok dikunci dan dicatat atomik di database; pengeditan detail produk tidak menimpa perubahan stok yang terjadi dari perangkat lain.
- Pembayaran cicilan atau pelunasan kredit dari detail transaksi, dengan validasi saldo dan pencatatan buku kas di server.
- Cetak ulang dan pratinjau struk continuous form 24 × 14 cm.
- CRUD stok produk dan pencatatan pengeluaran/modal di buku kas online.
- Catatan buku kas yang berasal dari penjualan atau cicilan ditandai otomatis dan tidak dapat dihapus sebagai catatan manual.

## Setup Supabase
1. Pastikan project Supabase yang dipakai adalah project VOLTKER yang benar.
2. Di **Authentication → Users**, buat satu akun toko. Jangan aktifkan pendaftaran publik; hanya akun ini yang boleh digunakan.
3. Jalankan seluruh `supabase/schema.sql` di **SQL Editor**. Skema ini menyiapkan tabel pelanggan, kebijakan Row Level Security, bucket `product-images`, serta tabel dan pilihan kategori/satuan produk. Skema juga memasang fungsi laporan berhalaman untuk dashboard/buku kas, pencatatan penambahan stok atomik, dan fungsi untuk menghapus catatan buku kas manual tanpa mengizinkan penghapusan catatan yang terhubung ke transaksi. Jalankan ulang skema sebelum deploy perubahan terkait; skema dapat dijalankan ulang dan migrasi mempertahankan data.
4. Jangan jalankan `supabase/clear-data.sql` untuk migrasi atau deploy. Jalankan hanya jika memang ingin menghapus permanen semua produk, transaksi, dan catatan keuangan di project tersebut serta memulai ulang ID.
5. Salin Supabase anon/publishable key (bukan `service_role` atau secret key).
6. Untuk GitHub Pages, simpan key sebagai repository Actions secret `VITE_SUPABASE_ANON_KEY` dan alamat email akun toko sebagai repository Actions variable `VITE_LOGIN_EMAIL`, lalu jalankan workflow deploy. Untuk lokal, isi `VITE_SUPABASE_ANON_KEY` dan `VITE_LOGIN_EMAIL` dalam `.env.local`.

`schema.sql` menyiapkan tabel, Row Level Security, dan fungsi database untuk checkout serta pembayaran cicilan. Database kosong setelah `clear-data.sql`; data di browser lama tidak akan dipindahkan. Jangan jalankan `clear-data.sql` lagi setelah mulai memasukkan data toko.

Nama pelanggan dikelola di tab Setting. Checkout hanya menerima nama yang dipilih dari daftar tersebut; nama lama di riwayat transaksi tidak terhapus jika nama pelanggan dihapus dari pilihan. Foto produk dapat diunggah saat menambah atau mengedit produk; JPG, PNG, dan WebP hingga 5 MB didukung. Gambar disajikan dari bucket publik `product-images`, sedangkan unggah dan penghapusan dibatasi ke akun toko.

Kategori dan satuan produk dikelola di database. Kategori/satuan yang masih dipakai produk tidak dapat dihapus; ubah data produk terkait terlebih dahulu. Satuan awal yang tersedia: pcs, lusin, dan kodi. Produk dengan satuan utama pcs/lusin/kodi dapat dijual dalam ketiga satuan tersebut; konversi stok mengikuti 1 lusin = 12 pcs dan 1 kodi = 20 pcs. Harga beli dan nilai modal stok untuk produk bersatuan standar dihitung per pcs; produk dengan satuan khusus dihitung per satuan produk. Harga jual pada form produk adalah tarif per pcs yang dipilih berdasarkan satuan penjualan: contoh tarif kodi Rp45.000/pcs menghasilkan Rp900.000 per kodi. Satuan, harga per kemasan, dan subtotal transaksi dicatat di item transaksi, detail transaksi, dan struk.

Perubahan konversi, harga beli, dan harga jual memerlukan versi terbaru aplikasi dan `supabase/schema.sql`. Jalankan ulang skema sebelum deploy versi aplikasi ini; migrasi mempertahankan data dan mengubah stok lama ke hitungan pcs. Nilai harga pada kolom pcs/lusin/kodi ditafsirkan sebagai tarif per pcs untuk tingkat harga yang dipilih. Periksa dan sesuaikan nilai harga beli per pcs serta harga jual di menu Stok Barang sebelum berjualan. Jangan jalankan `clear-data.sql`.

## Menjalankan lokal
```bash
npm install
npm run dev
```

Buka URL yang dicetak Vite. Untuk build lokal:
```bash
npm run build
npm test
```

## Deploy ke GitHub Pages
Workflow `.github/workflows/deploy.yml` membangun dan menerbitkan folder `dist` dari branch `main`. Pastikan secret `VITE_SUPABASE_ANON_KEY` sudah tersedia sebelum deploy; tanpa key, aplikasi menampilkan instruksi konfigurasi dan tidak membuka fitur toko.
- Service worker menunggu persetujuan sebelum mengaktifkan pembaruan. Aplikasi menampilkan tombol **Perbarui sekarang**; tab lain diberi tahu dan dapat dimuat ulang sendiri. Cache lama tidak dihapus saat aktivasi agar tab yang belum diperbarui tetap dapat menggunakan asetnya.
- Workflow menjalankan `npm test` dan build sebelum deploy; deploy hanya berlanjut jika keduanya berhasil.

## Online-only dan akses akun
- Sesi login yang tersimpan dipertahankan saat koneksi sementara terputus; aplikasi menampilkan status koneksi dan menyediakan tombol untuk mencoba kembali. Saat online, sesi diverifikasi ke server; semua baca/tulis data tetap memerlukan koneksi Supabase.
- Pada layar hingga 1024px, email login disembunyikan dan menggunakan alamat `VITE_LOGIN_EMAIL`; kolom kata sandi difokuskan otomatis dan input dibatasi ke angka untuk memunculkan keyboard numerik. Atur kata sandi akun toko menjadi angka saja agar login mobile dapat digunakan; di desktop email tetap dimasukkan manual dan kata sandi tidak dibatasi ke angka.
- Seluruh baca/tulis data dilakukan langsung ke Supabase. Data yang sempat terlihat tidak disimpan sebagai cache aplikasi untuk penggunaan offline.
- RLS membatasi setiap akun ke baris dengan `owner_id` akun tersebut. Buat hanya satu akun toko melalui Supabase Auth dan nonaktifkan sign-up publik.
- Anon/publishable key memang dikirim ke browser. Keamanan data bergantung pada Supabase Auth, RLS, dan fungsi database; jangan pernah menaruh service-role key pada aplikasi frontend.
- Jika secret diubah, jalankan ulang build/deploy karena Vite memasukkan nilainya ke bundle pada waktu build.
- Jika server tidak dapat dijangkau, aplikasi menampilkan kegagalan secara eksplisit dan operasi tidak disimpan secara lokal.
- Dashboard dan buku kas mengambil maksimal 15/20 baris per halaman; ringkasan dan agregat laporan dihitung di database. Jalankan `supabase/schema.sql` sebelum deploy versi yang memakai RPC laporan ini.
- Jalankan ulang `supabase/schema.sql` untuk memasang RPC penambahan stok atomik dan ringkasan stok Dashboard. Saat mengedit produk yang sudah ada, stok ditampilkan sebagai informasi dan hanya dapat diubah lewat **Tambah Stok** atau transaksi kasir.

## Printer struk
Pilih ukuran kertas khusus **240 × 140 mm**, continuous form/tractor feed, orientasi landscape, skala 100%, dan matikan header/footer browser. Simpan ukuran tersebut di driver printer.
