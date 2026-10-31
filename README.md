# VOLTKER — Aplikasi Toko Tas Online

VOLTKER adalah aplikasi kasir React + Vite dengan Supabase sebagai sumber data utama. **Koneksi internet dan login akun toko wajib digunakan.** Aplikasi tidak membaca, menulis, atau mengimpor data dari IndexedDB/perangkat.

## Fitur
- Dashboard penjualan, stok, riwayat transaksi, filter tanggal, urutan transaksi berdasarkan nama pelanggan atau status pembayaran, dan detail barang.
- Daftar nama pelanggan di tab Setting, dengan pilihan pelanggan wajib saat checkout.
- Master ekspedisi di tab Setting, dengan pilihan opsional saat checkout dan penyimpanan pada riwayat transaksi/faktur.
- Biaya ekspedisi yang ditanggung toko otomatis membuat catatan pengeluaran tertunda di Buku Kas; admin wajib melengkapi nominal aktual dari bukti pembayaran.
- Foto produk yang diunggah dari form Tambah/Edit Produk dan disimpan di Supabase Storage.
- Backup manual seluruh data toko, termasuk saldo hutang lama, dan foto produk ke file ZIP privat di Supabase Storage.
- Kasir tunai/kredit dengan nama pelanggan wajib; checkout dan pengurangan stok diproses atomik di database.
- Tab Pembelian untuk mencatat nama pembelian, vendor, nominal, dan tanggal sebagai pengeluaran di buku kas. Catatan pembelian tidak mengubah stok produk dan vendor dibayar lunas.
- Saldo hutang lama sebelum aplikasi digunakan dapat ditambahkan manual dari bagian Pelanggan dengan hutang; saldo ini bukan penjualan dan pelunasannya dicatat sebagai pemasukan.
- Penambahan stok dikunci dan dicatat atomik di database, termasuk harga modal per batch. Nilai aset stok menghitung setiap batch; penjualan mengurangi nilai modal berdasarkan rata-rata tertimbang, bukan FIFO.
- Pelunasan hutang pelanggan secara penuh atau sebagian dari tab Keuangan; pembayaran dialokasikan ke saldo hutang lama terlebih dahulu, lalu ke transaksi kredit tertua, dan dicatat di buku kas.
- Cetak ulang dan pratinjau struk continuous form 24 × 14 cm.
- Unduh faktur penjualan JPEG berwarna dengan logo VOLTKER setelah transaksi berhasil atau dari detail transaksi.
- CRUD stok produk dan pencatatan pengeluaran/modal di buku kas online.
- Catatan buku kas yang berasal dari penjualan atau cicilan ditandai otomatis dan tidak dapat dihapus sebagai catatan manual.

## VOLTKER Chat
Setelah login, pilih **APLIKASI TABEL** untuk membuka dashboard standar atau **APLIKASI CHAT** untuk bekerja melalui percakapan. Pilihan yang sama tersedia di desktop dan mobile, dan pengguna dapat berpindah aplikasi melalui tautan di header. Untuk membuka halaman chat secara langsung, gunakan `/chat/?mode=chat` pada deployment GitHub Pages atau `http://localhost:5173/chat/?mode=chat` saat menjalankan Vite. VOLTKER Chat adalah aplikasi terpisah yang menggunakan akun, tabel, dan aturan keamanan Supabase yang sama dengan aplikasi utama.

Chat dapat mencari stok/produk, pelanggan dan hutangnya, transaksi, pembelian, penjualan, performa produk, serta ringkasan buku kas; menjalankan penjualan tunai/kredit, penambahan stok per batch, pembayaran hutang, pencatatan hutang lama, pengeluaran/modal, pembelian, pengelolaan produk dan master data; membuat/memulihkan backup; dan mereset data toko. Saat diminta membuat produk baru dengan detail belum lengkap, Chat akan meminta satu daftar informasi yang kurang: satuan, stok awal, modal, dan harga jual; kategori dan foto bersifat opsional. Harga jual PCS dan lusin dapat disebutkan langsung. Hasil transaksi dapat dicetak atau diunduh sebagai faktur JPEG. Aksi perubahan ditampilkan sebagai pratinjau dan harus dikonfirmasi; reset juga meminta konfirmasi dengan mengetik `HAPUS DATA`. Foto produk dan file backup dapat dilampirkan lewat tombol lampiran chat.

Chat memakai alur hybrid: pertanyaan data yang jelas langsung dijawab dari database; pertanyaan yang lebih bebas, ambigu, memakai lampiran, atau meminta analisis dipahami Groq terlebih dahulu. Jika Groq membalas bahwa ia belum memahami pertanyaan data yang didukung, aplikasi mencoba query lokal yang aman sebagai fallback. Cakupan pertanyaan mengikuti tiap tab aplikasi:
- **Rekap Harian:** omzet, laba kotor/bersih, jumlah transaksi, saldo kas periode, transaksi terbaru, serta tanggal dan rincian transaksi.
- **Transaksi:** daftar/cek jumlah transaksi, transaksi tunai atau kredit, kredit yang belum lunas, transaksi pelanggan, nomor invoice, rincian barang/DP/cicilan/ekspedisi pada transaksi, serta transaksi terakhir dan tanggalnya.
- **Pembelian:** jumlah/keberadaan pembelian, riwayat pembelian bahan, vendor, dan periode.
- **Stok Barang:** daftar/cari produk, stok tersedia, daftar produk rendah (maksimal 5 satuan utama) atau ranking stok terendah/tertinggi, harga jual, HPP per satuan, jumlah produk, dan nilai modal persediaan.
- **Keuangan:** pemasukan, pengeluaran, modal, saldo kas, laba setelah pengeluaran, hutang pelanggan berjalan, cicilan terakhir dari Buku Kas, rincian catatan, dan biaya ekspedisi tertunda.
- **Setting:** daftar dan jumlah pelanggan/vendor/ekspedisi/kategori/satuan; Chat juga dapat menampilkan telepon atau alamat pelanggan bila diminta.

Untuk transaksi dan pembelian, admin dapat menanyakan apakah/berapa catatan pada periode tertentu, melihat daftar pelanggan/vendor, atau meminta catatan terakhir. Chat juga mendukung performa produk berdasarkan jumlah terjual/nilai penjualan/laba serta aksi yang tersedia pada tab terkait. Asisten dibekali panduan fitur dan alur aplikasi standar yang bersumber dari implementasi dashboard, kasir, stok, keuangan, pembelian, dan Setting. Jawaban angka berasal dari data aplikasi, bukan perkiraan AI. Chat hanya dapat menjawab data yang memang disimpan aplikasi; contohnya, aplikasi belum mencatat hutang vendor.

Penambahan stok lewat chat tetap memerlukan jumlah dan harga modal batch, lalu memanggil RPC `add_product_stock` yang sama dengan aplikasi utama. Penjualan dan pembayaran juga memakai RPC yang sudah ada. AI tidak diberi akses SQL atau service-role key; rencana aksi hanya menerima daftar intent yang diizinkan dan semua akses data tetap menggunakan sesi Supabase pengguna. Pesan yang perlu dipahami AI dan riwayat percakapan yang relevan dikirim ke Groq melalui Supabase Edge Function untuk menentukan query atau aksi. Pertanyaan data sederhana yang langsung dikenali diproses oleh aplikasi tanpa dikirim ke Groq. Hasil query data toko diambil langsung dari Supabase dan diringkas di perangkat; hasil tersebut tidak dikirim ke Groq. Riwayat percakapan tidak disimpan di database dan akan hilang saat halaman ditutup atau dimuat ulang.

### Menyiapkan Groq untuk VOLTKER Chat
1. Pastikan skema `supabase/schema.sql` yang sama sudah diterapkan dan `VITE_SUPABASE_ANON_KEY` sudah dikonfigurasi untuk build aplikasi.
2. Buat API key di [Groq Console](https://console.groq.com/keys). Simpan key sebagai secret Supabase Function, bukan di source code.
3. Deploy function dari root repository menggunakan Supabase CLI yang terhubung ke project toko:
   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase secrets set GROQ_API_KEY=<Groq-API-key>
   npx supabase functions deploy chat-assistant
   ```
4. Build/deploy aplikasi seperti biasa. GitHub Pages menerbitkan aplikasi utama di root dan chat di `/voltkerbag/chat/`.

Function menggunakan model `openai/gpt-oss-120b` secara default melalui Groq Chat Completions API. Jika menggunakan secret `GROQ_MODEL`, pastikan nilainya adalah ID model yang aktif di Groq. Hapus secret lama `GEMINI_API_KEY` dan `GEMINI_MODEL` dari Supabase jika sudah tidak digunakan.

Simpan `GROQ_API_KEY` hanya sebagai Supabase Function secret; jangan menaruhnya di `.env`, source code, GitHub Pages build variable, atau browser. Jangan gunakan `service_role` key. Jika function atau Groq belum dikonfigurasi, chat menampilkan kesalahan dan tidak menjalankan aksi.

Pembelian vendor masih dicatat sebagai pengeluaran lunas, sama seperti aplikasi utama; fitur hutang/tagihan vendor tidak tersedia. Semua operasi toko selain percakapan—termasuk unggah foto dan restore file backup—dilakukan melalui chat atau kartu tindakan di dalam percakapan, bukan melalui tab aplikasi utama.

## Setup Supabase
1. Pastikan project Supabase yang dipakai adalah project VOLTKER yang benar.
2. Di **Authentication → Users**, buat satu akun toko. Jangan aktifkan pendaftaran publik; hanya akun ini yang boleh digunakan.
3. Jalankan seluruh `supabase/schema.sql` di **SQL Editor**. Skema ini menyiapkan tabel pelanggan, vendor, dan ekspedisi, kebijakan Row Level Security, bucket `product-images` dan `store-backups`, serta tabel dan pilihan kategori/satuan produk. Skema juga memasang fungsi laporan berhalaman untuk dashboard/buku kas, checkout atomik, pencatatan biaya ekspedisi yang wajib dilengkapi, pencatatan penambahan stok atomik, penambahan saldo hutang lama, pembayaran hutang pelanggan yang melunasi saldo lama terlebih dahulu dan mencatat pemasukan ke buku kas, penghapusan catatan buku kas manual, serta reset data operasional per akun. Jalankan ulang skema sebelum deploy perubahan terkait; skema dapat dijalankan ulang dan migrasi mempertahankan data.
4. Jangan jalankan `supabase/clear-data.sql` untuk migrasi atau deploy. Skrip tersebut melakukan truncate global pada tabel tertentu dan bukan reset per akun. Untuk memulai ulang data satu toko, gunakan **Setting → Reset data toko** di aplikasi.
5. Salin Supabase anon/publishable key (bukan `service_role` atau secret key).
6. Untuk GitHub Pages, simpan key sebagai repository Actions secret `VITE_SUPABASE_ANON_KEY` dan alamat email akun toko sebagai repository Actions variable `VITE_LOGIN_EMAIL`, lalu jalankan workflow deploy. Untuk lokal, isi `VITE_SUPABASE_ANON_KEY` dan `VITE_LOGIN_EMAIL` dalam `.env.local`.

`schema.sql` menyiapkan tabel, Row Level Security, dan fungsi database untuk checkout, pembayaran, dan reset data. Jalankan reset melalui aplikasi hanya jika ingin menghapus data operasional toko tersebut.

Nama, nomor telepon, dan alamat pelanggan dikelola di tab Setting; data pelanggan dapat diedit dan nomor telepon serta alamat bersifat opsional. Jalankan ulang `supabase/schema.sql` agar kolom dan kebijakan pembaruan pelanggan tersedia di database. Checkout hanya menerima nama yang dipilih dari daftar tersebut; nama lama di riwayat transaksi tidak terhapus jika nama pelanggan dihapus dari pilihan. Foto produk dapat diunggah saat menambah atau mengedit produk; JPG, PNG, dan WebP hingga 5 MB didukung. Gambar disajikan dari bucket publik `product-images`, sedangkan unggah dan penghapusan dibatasi ke akun toko.

Nama vendor dikelola di **Setting → Nama vendor** dan dipilih dari daftar tersebut saat mencatat pembelian. Nama ekspedisi dikelola di **Setting → Nama ekspedisi** dan dapat dipilih di samping identitas pelanggan saat checkout. Jika dipilih, transaksi membuat catatan biaya tertunda di Buku Kas dengan kategori yang menyebut nama kurir dan pelanggan, misalnya **Biaya Ekspedisi JNT (Andri)**. Biaya tidak memengaruhi saldo/laba sampai admin mengisi jumlah aktual yang dibayar; catatan tertunda akan tetap ditampilkan di semua periode dan tidak dapat dihapus sebelum dilengkapi. Jalankan ulang `supabase/schema.sql` untuk menyiapkan tabel master ekspedisi, kolom transaksi, serta alur biaya tertunda. Master vendor dan ekspedisi dapat ditambah, diganti, atau dihapus tanpa mengubah nama yang sudah tersimpan dalam riwayat. Backup menyertakan master ekspedisi; restore tetap menerima backup versi lama yang belum memiliki daftar ini.

Backup manual tersedia di **Setting → Backup data**. Tombol tersebut membuat arsip ZIP yang berisi data tabel toko, riwayat penyesuaian stok, dan salinan foto produk, lalu mengunggahnya ke bucket privat `store-backups` di folder khusus akun. Untuk memulihkan, unduh ZIP dari Supabase Storage, pilih **Pulihkan dari file ZIP**, lalu konfirmasi penggantian seluruh data saat ini. Restore hanya menerima backup dari akun toko yang sama; foto dipulihkan ke bucket `product-images`. Jalankan ulang `supabase/schema.sql` sebelum menggunakan fitur backup/restore agar bucket, kebijakan akses, dan RPC tersedia. Backup tidak dijadwalkan otomatis.

Reset data toko tersedia di **Setting → Reset data toko**. Reset menghapus produk/stok, transaksi, data keuangan dan hutang, pelanggan, vendor, ekspedisi, kategori, serta satuan hanya untuk akun yang sedang login. Akun login, file backup, dan foto produk di Storage tetap dipertahankan. Tindakan memerlukan konfirmasi dengan mengetik `HAPUS DATA`; buat backup terlebih dahulu jika ingin menyimpan salinan data. Jalankan ulang `supabase/schema.sql` sebelum deploy versi aplikasi yang menyediakan reset.

Kategori dan satuan produk dikelola di database. Kategori/satuan yang masih dipakai produk tidak dapat dihapus; ubah data produk terkait terlebih dahulu. Satuan standar adalah pcs dan lusin; 1 lusin = 12 pcs. Menjalankan ulang `supabase/schema.sql` mengubah satuan utama produk lama yang menggunakan kodi menjadi pcs dengan stok dalam pcs dan menghapus pilihan satuan kodi, tanpa mengubah riwayat transaksi. Satuan khusus tetap dapat digunakan sebagai satuan tunggal. Harga jual produk PCS/LUSIN dihitung dari modal berjalan ditambah persentase markup yang diatur masing-masing untuk PCS dan LUSIN. Hasil harga dibulatkan ke Rupiah terdekat; perubahan modal rata-rata setelah penambahan stok otomatis memperbarui hasil harga jual. Jumlah penjualan LUSIN tetap dikonversi menjadi 12 PCS untuk mengurangi stok. Harga modal awal dan stok awal untuk produk standar dimasukkan per lusin; aplikasi otomatis mengonversi stok ke pcs dan membagi harga modal menjadi modal per pcs untuk perhitungan stok dan transaksi. Modal setiap batch untuk produk standar juga dimasukkan per lusin. Satuan khusus tetap dihitung per satuan produk dengan harga manual. Nilai aset menyimpan total modal stok: stok yang sudah ada dimigrasikan memakai modal saat ini, sedangkan setiap penambahan stok meminta modal batch baru. Penjualan mengurangi nilai aset secara proporsional pada modal rata-rata berjalan. Harga modal rata-rata tidak dapat diedit langsung; ubah melalui **Tambah Stok**. Satuan, harga per kemasan, dan subtotal transaksi dicatat di item transaksi, detail transaksi, dan struk.

Perubahan struktur stok/modal dan harga memerlukan versi terbaru aplikasi dan `supabase/schema.sql`. Jalankan ulang skema sebelum deploy versi aplikasi ini; migrasi mempertahankan data, mengubah stok lama ke hitungan pcs, mengonversi nilai harga LUSIN tersimpan ke harga penuh per LUSIN satu kali, memindahkan margin harga lama ke persentase markup PCS/LUSIN bila modal tersedia, dan menetapkan nilai modal stok awal dari jumlah stok dikalikan modal saat ini. Harga jual PCS dan LUSIN berikutnya dihitung dari modal rata-rata dan persentase masing-masing. Harga jual satuan khusus tetap dimasukkan manual; modal produksi berikutnya dimasukkan melalui **Tambah Stok** agar total nilai stok dan modal rata-rata diperbarui. Jangan jalankan `clear-data.sql`.

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
