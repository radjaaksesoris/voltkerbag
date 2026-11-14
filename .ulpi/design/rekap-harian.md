# Redesain Rekap Harian

## Design Read

Laporan toko terasa seperti buku besar yang dirapikan untuk layar sentuh: ringkasan dagang tetap menjadi fokus, sedangkan riwayat lengkap dibuka hanya saat diperlukan.

## Ikatan identitas

Semua nilai visual wajib berasal dari [DESIGN.md](./DESIGN.md). **Every screen must read as the same product if placed side by side.** Gunakan arah industrial / signage, satu aksen merah VOLTKER, Avenir Next, skala radius dan jarak yang terkunci. Jangan mengubah transisi panel navigasi 1.250ms yang sudah ada.

## Tujuan dan pengguna

- **Pengguna:** admin toko yang memantau penjualan lewat ponsel, dalam sesi kerja singkat.
- **Tujuan produk:** mempertahankan ringkasan omzet, laba kotor, dan nilai stok yang mudah dipindai; memindahkan daftar Transaksi Terakhir menjadi satu tombol yang membuka seluruh riwayat dalam dialog layar penuh.
- **Konteks perangkat:** ponsel sempit dan tinggi maupun standar; tablet dan desktop tetap didukung.
- **Acuan:** tangkapan layar dan identitas warna VOLTKER yang sudah digunakan. Tidak ada URL inspirasi.

## Arah visual dan komposisi

Tampilan mengacu pada buku besar toko dan signage, bukan deretan kartu seragam:

1. Filter tanggal tetap menjadi kontrol awal.
2. Susun ringkasan sebagai grid asimetris: omzet menjadi bidang utama; laba kotor dan nilai stok menjadi dua nilai sekunder yang disejajarkan dengan pemisah/garis, bukan tiga kartu setara.
3. Gunakan satu garis tinta merah sebagai penanda fokus pada ringkasan dan tombol riwayat.
4. Ganti tabel inline dengan tombol/bidang tindakan “Lihat riwayat transaksi”. Tampilkan jumlah transaksi dalam periode aktif dan periode tanggal yang sama dengan filter; gunakan data aktual saja. Bila jumlah nol, jelaskan bahwa belum ada transaksi dan tombol tetap membuka tampilan kosong dengan petunjuk mengubah tanggal.
5. Area tombol menjadi bagian fungsional laporan, bukan ruang kosong yang diregangkan. Gunakan lebar dan jarak responsif; jangan memberi tinggi minimum berdasarkan viewport yang menciptakan celah kosong di ponsel tinggi.
6. Dialog riwayat mengisi viewport pada semua ukuran. Header dialog tetap terlihat, konten tabel yang panjang menggulir sendiri, dan kontrol halaman berada setelah daftar.

### Perilaku responsif

| Ukuran | Susunan |
|--------|---------|
| Ponsel 320–640px | Filter dua kolom; omzet menempati satu baris penuh; laba dan nilai stok berdampingan dengan label/nilai yang dapat membungkus; tombol riwayat satu bidang penuh. Dialog memenuhi `100dvh` dan `100vw`, memakai safe area, tanpa gulir horizontal halaman. |
| Tablet 641–1024px | Ringkasan asimetris dua kolom; CTA riwayat selebar bidang laporan; dialog tetap viewport penuh. |
| Desktop >1024px | Batasi lebar laporan agar angka mudah dibaca; omzet utama dan dua nilai sekunder berkomposisi tidak simetris; dialog viewport penuh dengan lebar tabel terkelola dan area konten bergulir. |
| Tinggi viewport | Tidak menggunakan `min-height` untuk mendorong CTA ke bawah. Pertahankan ritme intrinsik dengan `clamp()`; ruang vertikal tidak diisi dengan angka atau dekorasi rekaan. |

## Flow: Membuka riwayat transaksi

### Overview

**Goal:** admin melihat seluruh transaksi dalam rentang tanggal aktif dan membuka detail transaksi tertentu.

**User Story:** Sebagai admin toko, saya ingin membuka riwayat penuh saat diperlukan agar ringkasan harian tetap ringkas tanpa kehilangan akses ke transaksi.

**Trigger:** tombol “Lihat riwayat transaksi” pada Rekap Harian.

### Prasyarat

- Pengguna sudah masuk ke aplikasi.
- Ringkasan Rekap Harian selesai dimuat.
- Gunakan filter tanggal dan jumlah transaksi yang sudah diterapkan oleh data dashboard.

### Flow

```text
Rekap Harian
    → Lihat riwayat transaksi
        → Dialog layar penuh, daftar halaman aktif
            → Urutkan / halaman berikutnya / Detail
                → Dialog detail transaksi
            → Tutup atau Escape
        → Kembali ke Rekap Harian pada posisi sebelumnya
```

### Perilaku

1. Tombol menampilkan jumlah transaksi dan rentang aktif. Fokus keyboard masuk ke judul dialog atau tombol tutup.
2. Dialog menampilkan header “Riwayat transaksi”, rentang tanggal, tombol tutup, tabel dengan kontrol urut nama/pembayaran yang sudah ada, serta 15 transaksi per halaman seperti perilaku sekarang.
3. Navigasi halaman mempertahankan filter dan urutan. Perubahan data/refresh memuat ulang daftar dan batas halaman dengan pola dashboard yang sama.
4. “Detail” membuka komponen detail transaksi yang sudah ada di atas riwayat. Menutup detail mengembalikan admin ke halaman dan posisi riwayat sebelumnya.
5. Tutup melalui tombol, Escape, atau klik backdrop. Kembalikan fokus ke tombol pemanggil. Kunci gulir halaman saat dialog terbuka.
6. Tidak ada perubahan pada filter tanggal, sorting, data pembayaran, detail invoice, atau query backend di luar kebutuhan membuka daftar yang sama dalam dialog.

## State dan penanganan tepi

| State / skenario | Tampilan dan perilaku |
|------------------|-----------------------|
| Loading dashboard | Pertahankan indikator `LoadingNumber` yang ada; jangan menampilkan tombol jumlah seolah data sudah tersedia. |
| Riwayat siap, ada data | Tombol menampilkan jumlah yang sesuai `total_count`; dialog menampilkan tabel dan pagination yang ada. |
| Tidak ada transaksi | CTA menampilkan jumlah nol. Dialog berisi empty state dengan saran memilih rentang tanggal lain. Sort dan pagination tidak ditampilkan bila tidak relevan. |
| Error dashboard | Gunakan pesan error dan aksi “Coba lagi” yang sudah ada; jangan tampilkan tombol dengan nilai fallback. |
| Error daftar/detail | Pertahankan penanganan error dari alur data saat ini, beri pesan `role=alert`, dan sediakan retry bila operasi yang gagal mendukungnya. Jangan menyamarkan error sebagai daftar kosong. |
| Data berubah atau refresh saat dialog terbuka | Muat ulang data, jaga dialog dan rentang tanggal. Jika halaman aktif tidak lagi valid, pindah ke halaman terakhir yang valid sebagaimana perilaku dashboard sekarang. |
| Escape / tombol tutup / backdrop | Dialog tertutup dan fokus kembali ke pemanggil. Klik konten dialog tidak menutupnya. |
| Detail transaksi | Dialog detail existing tetap di atas riwayat; ketika ditutup, posisi daftar dan urutan tetap sama. |
| Viewport 320px / keyboard layar | Kolom tabel tidak memaksa seluruh halaman melebar; dialog sendiri yang menggulir horizontal bila tabel memerlukan lebar minimum. Header dan tombol tutup dapat dijangkau. |
| Offline / sesi berakhir | Tampilkan error autentikasi/network yang dikembalikan aplikasi; jangan mengarang snapshot lokal atau sukses palsu. |
| `prefers-reduced-motion` | Buka/tutup tanpa transisi transform/scale; perubahan state tetap jelas. |

## Spesifikasi komponen

### Komponen: AksiRiwayatTransaksi

- **Purpose:** mengganti tabel inline dengan satu aksi yang menunjukkan skala riwayat aktif.
- **Data:** `total_count`, rentang tanggal terpilih, dan state loading/error dari dashboard. Tidak menurunkan jumlah dari daftar 15 baris.
- **Default:** satu tombol penuh/row dengan label, jumlah aktual, periode, ikon riwayat dari keluarga ikon yang sudah dipakai. Jalur tinta merah menjadi aksen tunggal.
- **Zero:** tetap dapat membuka dialog; label bantu menyatakan belum ada transaksi pada periode.
- **Hover/active:** perubahan warna/batas yang ringan; tanpa lompatan atau bounce.
- **Focus:** outline 2px kontras, offset 2px.
- **Disabled:** hanya saat dashboard belum siap atau data sedang dimuat. Error menggunakan tombol retry yang sudah ada, bukan status sukses-shaped.
- **Responsive:** target sentuh minimum 48dp; label dan angka boleh membungkus tanpa clipping.
- **Aksesibilitas:** elemen native `<button>`; accessible name mencakup “Lihat riwayat transaksi” dan jumlah bila tersedia; status loading menggunakan `role=status`.

### Komponen: DialogRiwayatTransaksi

- **Purpose:** menampilkan semua hasil transaksi terfilter melalui pagination di dialog layar penuh.
- **System:** gunakan Radix UI Dialog untuk focus trap, Escape, aria-modal, dan pemulihan fokus. Tema hanya menggunakan token VOLTKER; jangan memasang atau meniru sistem komponen kedua.
- **Header:** judul terhubung via `aria-labelledby`, rentang tanggal sebagai konteks, tombol tutup berlabel. Safe area atas dihormati.
- **Body:** tabel yang sudah ada, sorting nama/pembayaran, tombol Detail, empty state, dan pagination yang sudah ada. Pertahankan 15 hasil per halaman dan sumber data saat ini.
- **Loading/error/empty:** indikator loading saat memuat; error eksplisit dengan retry yang valid; empty state berbeda dari loading/error.
- **Desktop/mobile:** dialog menempel pada viewport di semua ukuran, `100dvh` dengan fallback `100vh`, area tabel internal scroll-y, tabel boleh scroll-x lokal. Header tetap terlihat.
- **Dismiss:** tombol tutup, Escape, dan backdrop. Jangan tutup saat klik konten. Kunci scroll dokumen selama terbuka.
- **Fokus dan SR:** fokus masuk ke dialog, tab tidak keluar dari dialog, fokus kembali ke pemanggil saat ditutup; perubahan halaman diumumkan singkat via `aria-live=polite`; tabel punya caption yang terbaca screen reader.
- **Detail bertumpuk:** buka `TransactionDetails` existing sebagai dialog di atas riwayat. Setelah ditutup fokus dan posisi kembali ke baris pemanggil.
- **Motion:** opacity/posisi kecil 150ms untuk masuk/keluar; tanpa animasi ukuran atau daftar baris; hormati reduced motion.

### Komponen: RingkasanAsimetris

- Pertahankan tiga sumber nilai yang ada: `revenue`, `gross_profit`, `inventory.total_asset`. Nilai lain hanya boleh ditampilkan jika berasal langsung dari data yang tersedia, dengan label yang jelas.
- Omzet adalah fokus tunggal; laba dan nilai stok adalah nilai sekunder yang dipisah garis/ruang, bukan tiga kartu setara.
- Label periode mengikuti tanggal yang sama dengan dashboard. Jangan memperkenalkan perbandingan, persentase, atau tren yang belum diberikan backend.
- Nilai rupiah tabular, dapat membungkus secara aman, tidak dipotong menjadi angka ambigu.

## Aksesibilitas dan interaksi

- Urutan keyboard: kontrol tanggal → tombol riwayat → kontrol dialog dari header → filter/sort tabel → detail/pagination → tutup.
- `Tab` dan `Shift+Tab` tetap berada di dialog; `Enter`/`Space` mengaktifkan tombol; `Escape` menutup lapisan paling atas.
- Gunakan indikator fokus yang terlihat, kontras AA, target sentuh sekurangnya 48dp, label nyata untuk input tanggal dan tombol ikon.
- Jangan mengandalkan warna saja untuk status tunai/kredit/lunas.
- Pengumuman SR untuk error, loading, empty, jumlah hasil, dan pergantian halaman.

## Acceptance criteria

- [ ] Tabel Transaksi Terakhir tidak tampil inline pada dashboard; tombol ringkas membuka dialog layar penuh.
- [ ] Dialog menampilkan semua transaksi secara paginasi, memakai 15 baris per halaman, dengan filter tanggal dan urutan existing tetap berfungsi.
- [ ] Detail transaksi tetap bisa dibuka dari riwayat; menutupnya kembali ke daftar/halaman yang sama.
- [ ] Jumlah CTA berasal dari `total_count`, bukan banyaknya baris halaman.
- [ ] Loading, error, empty, refresh, viewport sempit, Escape, backdrop, dan reduced-motion memiliki perilaku yang ditentukan.
- [ ] Ringkasan omzet/laba/nilai stok tetap akurat; komposisi bukan tiga kartu setara dan tidak menambah angka rekaan.
- [ ] Layout tampak penuh guna tanpa min-height yang meregangkan konten pada ponsel tinggi; tidak ada scroll horizontal halaman.
- [ ] Semua warna, font, spasi, radius, dan motion mematuhi [DESIGN.md](./DESIGN.md); fokus dan kontras memenuhi WCAG AA.
- [ ] `npm run build`, `npm test`, dan `git diff --check` berhasil.

## Design Pre-Flight

- [x] Identitas terkunci; satu aksen, satu jenis huruf, skala radius, keluarga ikon, dan register copy.
- [x] Arah industrial / signage dipilih dari konteks toko dan identitas merah VOLTKER; bukan default untuk dashboard generik.
- [x] Tidak menggunakan font/palet terlarang, gradien teks, pola tiga kartu seragam, nested cards, fake numbers, atau copy buzzword.
- [x] Signature jalur tinta merah hadir dengan fungsi hierarki dan pengenalan merek.
- [x] Loading, empty, error, refresh, sesi/offline, Escape, detail bertumpuk, viewport rendah/sempit, dan reduced-motion dicakup.
- [x] Rasio kontras teks dicatat di atas; fokus keyboard, dialog, target sentuh, dan pengumuman SR ditentukan.
- [x] Tiga keluarga layout berbeda: filter kontrol, ringkasan laporan asimetris, dan aksi ledger; satu focal point per area.
- [x] Aksi utama dashboard tunggal: buka riwayat. Aksi dialog menjadi kontrol sekunder untuk menjelajah dan menutup.
- [x] Counterfactual test: jalur merah, bahasa buku besar, serta komposisi laporan asimetris merujuk VOLTKER/toko; bukan template dashboard yang sama untuk kategori lain.
- **Scored self-critique (0–4):** distinctiveness 3, hierarchy/focus 4, consistency 4, accessibility 4, state/edge coverage 4, copy 4, restraint 4, motion motivation 3. **Total 30/32; tidak ada sumbu ≤2.**
- **Revise-and-justify:** ruang kosong tidak diisi dekorasi atau metrik fiktif; diganti CTA jumlah transaksi dan ringkasan asimetris agar tindakan dan data nyata memenuhi layar dengan lebih baik.

## Build handoff

- **Target agent:** `react-vite-tailwind-engineer` capability, implementasi untuk proyek React + Vite dengan CSS yang sudah ada.
- **Framework:** React 18 + Vite; pertahankan CSS project (`src/styles.css`), jangan migrasi ke Tailwind.
- **Design system:** Radix UI Dialog primitive untuk aksesibilitas modal; bila belum terpasang, tambahkan hanya paket dialog yang diperlukan. Tema primitive dengan token terkunci. Jangan membuat ulang fokus trap/dialog dari awal.
- **Lokasi utama:** `src/pages/Dashboard.jsx`, `src/styles.css`; hindari perubahan pada navigasi global dan query backend tanpa kebutuhan.
- **Instruksi:** Implementasikan tepat spesifikasi ini. Theme primitive dengan token terkunci; jangan mendesain ulang atau mengimplementasikan ulang komponen Dialog Radix. Pertahankan perilaku data yang ada, jangan commit.
- **Verifikasi:** jalankan `npm run build`, `npm test`, `git diff --check`; laporkan hasil dan file yang berubah.
