---
project: VOLTKER
register: product
aesthetic_direction: industrial / signage
color_strategy: restrained
design_system: Radix UI Dialog primitive, themed with VOLTKER tokens
design_variance: 6
motion_intensity: 3
visual_density: 6
---

## Design Read

Laporan toko terasa seperti buku besar yang dirapikan untuk layar sentuh: angka cepat dipindai, garis merah menandai tindakan penting, dan dekorasi tidak bersaing dengan data.

## Signature

Jalur tinta merah menjadi satu penanda visual untuk performa dan pintu masuk riwayat. Ia mengambil warna merek VOLTKER dan bahasa signage toko, bukan ornamen generik dashboard.

## Color (locked)

Warna netral mempertahankan bias hangat VOLTKER; distribusi visual kira-kira 60% latar netral, 30% permukaan, dan maksimal 10% aksen merah.

| role | OKLCH | hex | use |
|------|-------|-----|-----|
| background | `oklch(0.950 0.013 86.8)` | `#f2eee5` | Latar halaman |
| surface | `oklch(0.994 0.007 88.6)` | `#fffdf8` | Bidang data utama |
| elevated | `oklch(1.000 0.000 89.9)` | `#ffffff` | Dialog dan kontrol |
| text | `oklch(0.234 0.008 59.2)` | `#211d1a` | Teks utama |
| muted | `oklch(0.505 0.020 55.9)` | `#6e625a` | Teks sekunder |
| subtle | `oklch(0.600 0.019 76.0)` | `#877f74` | Ikon/ornamen non-teks saja |
| border | `oklch(0.906 0.021 81.8)` | `#e7dfd1` | Garis pemisah |
| accent | `oklch(0.508 0.177 24.3)` | `#b5282e` | Aksi utama dan jalur tinta merah |
| success | `oklch(0.519 0.073 165.1)` | `#3b765e` | Status lunas / berhasil |
| warning | `oklch(0.505 0.096 73.9)` | `#855b18` | Peringatan |
| danger | `oklch(0.474 0.166 23.6)` | `#a5222a` | Status belum lunas / error |
| info | `oklch(0.471 0.051 219.8)` | `#38626f` | Informasi |

WCAG AA contrast, pasangan yang dipakai untuk teks ukuran normal:

| Foreground / background | Rasio |
|-------------------------|-------|
| Text / background | 14.45:1 |
| Muted / background | 5.90:1 |
| Accent / surface | 6.25:1 |
| White / accent | 6.35:1 |
| Success / surface | 5.24:1 |
| Warning / surface | 5.89:1 |
| Danger / surface | 7.22:1 |
| Info / surface | 6.57:1 |

Semua pasangan teks di atas melewati 4.5:1. Ikon atau batas kontrol non-teks memakai minimal 3:1 terhadap permukaan terkait. `subtle` hanya untuk detail dekoratif dan tidak boleh dipakai untuk teks bermakna.

## Type (locked)

| role | family | use | notes |
|------|--------|-----|-------|
| display | Avenir Next, sans-serif | Judul laporan dan angka utama | Bobot 700; hindari huruf serif dekoratif |
| body | Avenir Next, sans-serif | Label, instruksi, isi | Bobot 400–600; panjang baca maksimal 70ch |
| utility | Avenir Next, sans-serif | Nilai rupiah, tanggal, nomor faktur | Aktifkan angka tabular dan jangan memotong angka penting |

Satu keluarga huruf dengan perbedaan bobot menjaga hubungan visual dengan shell aplikasi. Fallback harus sans-serif dan metric shift dijaga agar tidak mengubah susunan.

## Scales (locked)

- `spacing`: 4px base, gunakan `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- `radius`: `sm 6px`, `md 10px`, `lg 14px`, `xl 20px`, `full 9999px`. Jangan mencampur skala lain.
- `elevation`: bayangan lembut beropacity rendah; gunakan hanya untuk membedakan permukaan dari latar.
- `breakpoints`: mobile `<=640px`, tablet `641–1024px`, desktop `>1024px`.
- `motion`: `fast 150ms`, `base 300ms`, `emphasis 500ms`, easing `cubic-bezier(0.16, 1, 0.3, 1)`. Hindari bounce/elastic; transisi gerak antarmuka biasa dimatikan untuk `prefers-reduced-motion`.
- Pengecualian kompatibilitas: transisi panel navigasi aplikasi yang sudah ada tetap 1.250ms; redesain Rekap Harian tidak mengubahnya.

## Voice

- `register`: lugas, hangat, operasional.
- `action vocabulary`: gunakan nama tindakan konsisten, misalnya “Lihat riwayat”, “Detail”, “Tutup”, dan “Coba lagi”.
- Hindari jargon promosi, data perkiraan, dan angka yang tidak berasal dari data aplikasi.

## Consistency lock

Every screen must read as the same product if placed side by side.
