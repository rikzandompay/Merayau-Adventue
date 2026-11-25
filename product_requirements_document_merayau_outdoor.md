# Product Requirements Document (PRD)
## Portal Admin Penyewaan Alat Outdoor & Open Trip — Merayau Outdoor

| Atribut | Detail |
| :--- | :--- |
| **Nama Proyek** | Portal Admin Penyewaan Alat Outdoor & Open Trip (Merayau Outdoor) |
| **Versi Dokumen** | 1.1 (Fokus MVP Portal Admin) |
| **Tanggal** | 23 November 2026 |
| **Tech Stack Utama** | Nuxt 4 (Vue 3 + TypeScript + Nitro Server) & MySQL 8.x (Drizzle ORM) |
| **Status** | Siap Implementasi Portal Admin (Fase 1); Web Publik Ditunda ke Fase 2 |

---

## 1. Ringkasan Eksekutif & Prioritas Fase

**Merayau Outdoor** memprioritaskan pembangunan **Portal Admin (Fase 1)** terlebih dahulu untuk mendukung operasional harian basecamp secara penuh. **Website Publik / Web Content** (Beranda, Katalog Publik, Info Trip Publik, Gallery, Footer Maps) **ditunda ke Fase 2** setelah Portal Admin stabil digunakan.

### Pengguna Fase 1
* **Admin Basecamp:** Mengelola inventori alat, menyusun paket sewa alat, mencatat transaksi sewa & pengembalian beserta denda, memantau unit yang sedang keluar, mengelola data penyewa, serta mengatur jadwal & peserta open trip.

---

## 2. Arsitektur & Tech Stack

| Lapisan | Teknologi | Fungsi / Catatan |
| :--- | :--- | :--- |
| **Frontend & Meta-Framework** | **Nuxt 4 (Vue 3 + TypeScript)** | SPA/Hybrid untuk Portal Admin responsif. |
| **Backend API** | **Nuxt Nitro (`server/api/`)** | REST API internal dalam satu repositori. |
| **Database** | **MySQL 8.x** | Penyimpanan data relasional dengan transaksi ACID. |
| **ORM & Driver** | **Drizzle ORM** + `mysql2` | Query builder *type-safe* dan transaksi SQL native. |
| **Autentikasi** | `nuxt-auth-utils` + `bcrypt`/`scrypt` | Sesi admin berbasis *encrypted HttpOnly cookie*. |
| **Validasi Data** | **Zod** | Validasi request body, query param, dan upload file. |
| **Styling & Tipografi** | **Tailwind CSS**, `Vollkorn` + `Public Sans` | Sistem desain **Editorial Warm Paper** (mode Siang/Malam, `tabular-nums`). |
| **Media Upload** | Storage lokal (`public/uploads/`) / object storage | Upload foto alat, foto paket alat, dan foto trip (`JPG/PNG/WEBP`, maks 2 MB). |

---

## 3. Ruang Lingkup Produk (Scope of Work)

### A. Fase 1 — Portal Admin (Fokus Saat Ini, Wajib Login)

Struktur navigasi menggunakan **Left Sidebar** (8 menu dalam 2 grup):
* **OPERASIONAL:** `Dashboard`, `Sewa Alat`, `Alat Disewa`
* **INVENTORI & KONTEN:** `Master Alat`, `Paket Alat`, `Penyewa`, `Data Trip`, `Peserta Trip`

Rincian modul:
1. **Dashboard Admin:**
   * KPI utama: Pendapatan Sewa, Unit Sedang Disewa, Stok Tersedia, Transaksi Terlambat.
   * Filter periode (`7 Hari`, `30 Hari`, `90 Hari`, `Musim Ramai`, `1 Tahun`), grafik tren & sumber pendapatan, **Panel Stok Alat Basecamp** (ketersediaan real-time per item), dan tabel transaksi terbaru.
   * Filter kategori alat tidak ditampilkan di Dashboard; tombol ganti tema (**Siang / Malam**) ditempatkan di kanan header Dashboard.
2. **Sewa Alat (Transaksi & Pengembalian):**
   * Pencatatan sewa baru (multi-item satuan maupun dari **Paket Alat**), kalkulasi biaya otomatis sesuai durasi & diskon, serta validasi stok real-time.
   * Input **Jaminan Fisik** menggunakan **dropdown 3 pilihan tetap**: `KTP`, `SIM`, atau `Kartu Pelajar`.
   * Proses pengembalian barang beserta perhitungan denda keterlambatan otomatis dan penyesuaian denda kerusakan fisik.
3. **Alat Disewa (Monitoring):**
   * Daftar seluruh unit yang sedang berada di penyewa, dengan kolom **`Nama Penyewa`** dan **`Kontak (WA)` dipisah**, tenggat kembali, estimasi denda, status (`Disewa` / `Jatuh Tempo` / `Terlambat`), dan tombol pintas `Hubungi WA`.
4. **Master Alat & Kategori (CRUD):**
   * Kelola kode unik alat, nama, kategori, tarif per 24 jam, stok total, soft toggle `status_aktif`, **upload foto alat** (`JPG/PNG/WEBP`, maks 2 MB) dengan preview & tombol hapus, serta ringkasan aturan sewa (`pengaturan_sewa`).
5. **Paket Alat (Panel Terpisah — CRUD):**
   * Panel khusus untuk mengelola bundel alat lintas kategori beserta foto, daftar isi item, tarif otomatis, kuota paket tersedia real-time, dan inspektor detail.
   * **Alur Tambah / Edit Paket Alat:**
     1. Upload gambar paket (`JPG/PNG/WEBP`, maks 2 MB) dan isi nama paket.
     2. **Pilih kategori alat** yang masuk ke paket (multi-pilih, misal Tenda, Carrier, Sleeping Bag, Alat Masak).
     3. Untuk **setiap kategori yang dipilih**, sistem menampilkan **dropdown pilihan alat khusus dari kategori tersebut** beserta input jumlah unit (`qty`) dan info stok siap.
     4. **Tarif paket dihitung otomatis**: total harga sewa harian seluruh item isi paket **didiskon 30%**.
6. **Data Penyewa (CRUD):**
   * Database pelanggan (`nama`, `no_identitas`, `no_wa`, `alamat`, `catatan`), status standing, dan riwayat penyewaan per penyewa.
7. **Data Trip (CRUD Open Trip):**
   * Pengelolaan jadwal open trip mencakup **upload foto trip** (`JPG/PNG/WEBP`, maks 2 MB), judul, gunung/lokasi, tanggal & durasi, kuota, **multi-opsi Meeting Point Lokasi** (misal `Jakarta - Halim`, `Terminal Mendolo Wonosobo`, `Basecamp Wates / Patak Banteng / Dieng`, serta opsi `Lainnya (atur lokasi sendiri)`), **multi-harga Paket Trip** (`Paket A`, `Paket B`, `Paket C` beserta deskripsi fasilitas), `Itinerary Kegiatan` terpisah, dan status (`Published` / `Draft` / `Penuh`).
8. **Peserta Trip (Monitoring & Pencatatan):**
   * Filter per jadwal trip & status bayar, dilengkapi **4 kartu KPI**: `Peserta Terdaftar`, `Pembayaran Lunas`, `Baru Bayar DP (50%)`, dan `Sewa Alat Tambahan`.
   * Tabel peserta mencatat identitas, kontak WA & kontak darurat, paket trip (`A/B/C`), titik kumpul terpilih (termasuk input lokasi kustom jika memilih `Lainnya`), nominal bayar, status (`Lunas` / `DP 50%` / `Belum Bayar`), dan kebutuhan sewa alat tambahan.

### B. Fase 2 — Website Publik / Web Content (Ditunda)
* Halaman publik tanpa login: **Beranda**, **Rental Alat (Katalog + tab Paket Hemat)**, **Info Trip (pilihan Paket A/B/C & radio Meeting Point)**, **Gallery**, **Profil Toko & Embed Maps**, serta konversi pesan via `wa.me`.
* Manajemen konten `gallery` dan `profil_toko` akan ikut diaktifkan pada Fase 2.

### C. Di Luar Ruang Lingkup (*Out of Scope*)
* Registrasi akun pelanggan (*self-service*) dan *online checkout* mandiri.
* Integrasi *Payment Gateway* otomatis dan WhatsApp API berbayar (cukup tautan `wa.me`).

---

## 4. User Stories & Acceptance Criteria (Fase 1 — Portal Admin)

* **US-01 (Login Admin):** Rute `/admin/**` wajib autentikasi; sesi disimpan pada *HttpOnly cookie*.
* **US-02 (Dashboard & Panel Stok):** Mendukung filter periode, menampilkan KPI, grafik pendapatan, **Panel Stok Alat Basecamp**, transaksi terbaru, serta toggle tema Siang/Malam di kanan header.
* **US-03 (CRUD Master Alat + Foto):** `kode_alat` unik; mendukung upload/ganti/hapus foto (maks 2 MB); alat dengan transaksi aktif tidak boleh dihapus permanen (soft toggle `status_aktif = 0`).
* **US-04 (Panel Paket Alat + Diskon 30% Otomatis):** Admin memilih satu atau lebih kategori, memilih alat dari dropdown per kategori beserta jumlahnya, dan mengunggah foto paket. Sistem otomatis menghitung tarif paket sebesar **total harga sewa harian seluruh alat dikurangi diskon 30%** dan menghitung kuota paket dari stok alat terkecil.
* **US-05 (Catat Transaksi Sewa):** Validasi stok tersedia secara atomik (*MySQL Transaction*), pilihan `jenis_jaminan` dibatasi dropdown (`KTP`, `SIM`, `Kartu Pelajar`), dan mendukung input item satuan maupun ekspansi item dari Paket Alat.
* **US-06 (Pengembalian & Denda):** Menghitung estimasi denda otomatis saat `tanggal_kembali_aktual > tanggal_kembali_rencana + toleransi_telat_jam`, dengan kolom penyesuaian denda kerusakan fisik.
* **US-07 (Monitoring Alat Disewa):** Menampilkan daftar unit keluar dengan kolom `Nama Penyewa` dan `Kontak (WA)` terpisah serta tombol pintas `wa.me`.
* **US-08 (CRUD Data Trip — Foto, Paket A/B/C & Multi-Mepo):** Admin dapat mengunggah foto trip, menentukan daftar pilihan Meeting Point (termasuk opsi `Lainnya`), serta mengatur variasi harga `Paket A`, `Paket B`, `Paket C`.
* **US-09 (Manajemen Peserta Trip):** Admin dapat memantau 4 KPI (`Terdaftar`, `Lunas`, `DP 50%`, `Sewa Alat Tambahan`) dan mencatat/memperbarui pembayaran serta pilihan paket & meeting point tiap peserta.

---

## 5. Aturan Bisnis Penting (Business Logic)

1. **Stok Alat Tersedia Real-Time:**
   Kolom `master_alat.stok_total` tidak dikurangi saat sewa berlangsung:
   $$\text{Stok Tersedia} = \text{stok\_total} - \sum (\text{detail\_sewa.jumlah} \mid \text{status\_sewa} \in \{\text{'Disewa'}, \text{'Terlambat'}\})$$
2. **Stok & Harga Paket Alat:**
   * Paket alat tidak menyimpan kolom stok terpisah; kuota paket dihitung otomatis dari item paling sedikit:
     $$\text{Kuota Paket} = \min_{i \in \text{paket}} \left\lfloor \frac{\text{Stok Tersedia}_i}{\text{jumlah}_i} \right\rfloor$$
   * Tarif harian paket dihitung otomatis dari total tarif harian item di dalamnya dengan diskon 30%:
     $$\text{Tarif Paket / 24j} = \left(\sum_{i \in \text{paket}} \text{harga\_harian}_i \times \text{jumlah}_i\right) \times 0{,}70$$
   * Saat paket disewa pada `Sewa Alat`, seluruh item isi paket dipecah masuk ke `detail_sewa` (dengan referensi opsional `id_paket`) agar pengurangan stok dan pengecekan kondisi saat pengembalian tetap per unit barang.
3. **Biaya Sewa & Keterlambatan:**
   * Durasi sewa dihitung kelipatan `durasi_dasar_jam` (default 24 jam, dibulatkan ke atas); harga satuan di-snapshot di `detail_sewa.harga_satuan`.
   * Status otomatis `Terlambat` jika melewati `tanggal_kembali_rencana + toleransi_telat_jam` saat `tanggal_kembali_aktual` masih `NULL`.

---

## 6. Arsitektur Database (MySQL — Drizzle ORM)

### Tabel Aktif Fase 1 (Portal Admin — 13 Tabel)

| No | Nama Tabel | Keterangan & Kolom Kunci |
| :--- | :--- | :--- |
| 1 | `admins` | Akun admin untuk autentikasi & profil. |
| 2 | `kategori_alat` | Master kategori (`Tenda`, `Carrier`, `Sleeping Bag`, `Alat Masak`, dll.). |
| 3 | `master_alat` | Inventori alat (`kode_alat` unik, `id_kategori`, `harga_harian`, `stok_total`, `foto`, `status_aktif`). |
| 4 | `paket_alat` | Header paket bundel (`nama_paket`, `foto`, `diskon_persen` default `30`, `tarif_paket`, `status_aktif`). |
| 5 | `paket_alat_item` | Isi alat per paket (`FK: id_paket, id_alat`, `jumlah`). |
| 6 | `pengaturan_sewa` | Aturan durasi dasar, diskon promo durasi, toleransi jam, dan tarif denda harian. |
| 7 | `penyewa` | Data pelanggan (`nama`, `no_identitas` unik, `no_wa`, `alamat`, `catatan`). |
| 8 | `transaksi_sewa` | Header transaksi (`FK: id_penyewa, id_admin, id_pengaturan`, `jenis_jaminan ENUM('KTP','SIM','Kartu Pelajar')`, total & denda). |
| 9 | `detail_sewa` | Rincian unit disewa (`FK: id_sewa, id_alat`, `id_paket` nullable, `jumlah`, `harga_satuan`). |
| 10 | `info_trip` | Master jadwal open trip (`judul`, `lokasi`, `tanggal`, `durasi`, `kuota`, `foto`, `itinerary`, `status_publish`). |
| 11 | `trip_paket` | Variasi harga per trip (`FK: id_trip`, `kode_paket` A/B/C, `deskripsi_fasilitas`, `harga`). |
| 12 | `trip_meeting_point` | Daftar pilihan titik kumpul per trip (`FK: id_trip`, `nama_lokasi`, `is_custom` untuk opsi *Lainnya*). |
| 13 | `peserta_trip` | Peserta terdaftar (`FK: id_trip, id_trip_paket, id_meeting_point`, `mepo_custom`, `nama`, `no_identitas`, `no_wa`, `kontak_darurat`, `status_bayar`, `nominal_bayar`, `catatan_alat`). |

### Tabel Ditunda ke Fase 2 (Web Publik)
* `profil_toko` dan `gallery`.

---

## 7. Rancangan API Endpoints (`server/api/`)

### Auth & Portal Admin Endpoints (Fase 1)
| Method | Endpoint | Fungsi |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` & `/api/auth/logout` | Autentikasi admin & manajemen cookie sesi. |
| `POST` | `/api/admin/upload` | Upload gambar alat, paket alat, dan trip (`JPG/PNG/WEBP`, maks 2 MB). |
| `GET` | `/api/admin/dashboard` | KPI, grafik tren, sumber pendapatan, **Panel Stok Alat**, & transaksi terbaru. |
| `GET/POST/PUT/DELETE` | `/api/admin/kategori` | CRUD `kategori_alat`. |
| `GET/POST/PUT/DELETE` | `/api/admin/alat` & `/alat/[id]` | CRUD `master_alat` (termasuk foto & soft toggle). |
| `GET/POST/PUT/DELETE` | `/api/admin/paket-alat` & `/paket-alat/[id]` | CRUD `paket_alat` + `paket_alat_item` (hitung tarif diskon 30% & kuota otomatis). |
| `GET/POST/PUT/DELETE` | `/api/admin/penyewa` & `/penyewa/[id]` | CRUD `penyewa` + riwayat sewa. |
| `GET/POST/PUT` | `/api/admin/pengaturan-sewa` | Kelola aturan durasi, diskon promo, & denda. |
| `GET/POST` | `/api/admin/transaksi` | List & catat transaksi sewa baru (satuan / paket, atomic MySQL transaction). |
| `PATCH` | `/api/admin/transaksi/[id]/kembali` | Proses pengembalian barang & finalisasi denda. |
| `GET` | `/api/admin/alat-disewa` | Monitoring unit keluar (nama penyewa & WA terpisah). |
| `GET/POST/PUT/DELETE` | `/api/admin/trips` & `/trips/[id]` | CRUD `info_trip` beserta `trip_paket` (A/B/C) & `trip_meeting_point`. |
| `GET/POST/PUT/DELETE` | `/api/admin/peserta-trip` & `/peserta-trip/[id]` | CRUD `peserta_trip` + agregasi 4 KPI peserta (termasuk DP 50%). |

### Public Endpoints (Fase 2 — Ditunda)
* `/api/public/home`, `/api/public/alat`, `/api/public/trips`, `/api/public/gallery`, `/api/admin/gallery`, `/api/admin/profil-toko`.

---

## 8. Panduan UI/UX & Sistem Desain (Acuan Figma)

Desain Portal Admin mengacu pada halaman `Admin Panel (Editorial)` di Figma (`bjhc0GxPPAetWbmtZdotSc`):
* **Gaya & Palet (Editorial Warm Paper):**
  * *Mode Siang (Default):* Latar kertas hangat (`#f3f1eb`), permukaan kartu (`#fcfbf8`), tinta gelap (`#1f1c17`), aksen Cobalt (`#2b4e9b`), Forest Green (`#1f5e3b`), Crimson (`#9e2a2b`).
  * *Mode Malam:* Latar gelap hangat (`#1c1a16`) dengan toggle **Siang / Malam** di kanan header Dashboard.
* **Tipografi:** `Vollkorn` (judul & KPI) dan `Public Sans` (UI, form, tabel dengan `tabular-nums`).
* **Identitas Brand:** Menggunakan logo resmi `Asset.Gambar/Logo.jpeg` pada wadah putih di kiri atas sidebar.
* **Navigasi:** Left Sidebar permanen (berubah jadi drawer pada layar sempit/mobile) berisi 8 menu utama: `Dashboard`, `Sewa Alat`, `Alat Disewa`, `Master Alat`, `Paket Alat`, `Penyewa`, `Data Trip`, dan `Peserta Trip`.

---

## 9. Non-Functional Requirements (NFR)

* **Keamanan:** Semua query MySQL wajib terparameterisasi via Drizzle ORM; password admin di-hash; validasi input dengan Zod; unggahan file gambar dibatasi ekstensi (`jpg/png/webp`), MIME check, dan ukuran maksimal 2 MB.
* **Integritas Data:** Transaksi sewa, pengembalian, serta penyimpanan paket/trip multi-relasi wajib menggunakan *MySQL Transaction*.
* **Responsivitas:** Portal Admin nyaman digunakan di layar desktop (`1280px–1440px+`) hingga tablet/mobile dengan drawer sidebar.

---

## 10. Roadmap Pengerjaan (Fokus Portal Admin)

| Tahap | Fokus & Deliverables |
| :--- | :--- |
| **Sprint 1: Foundation, Auth & Schema** | Setup tema Tailwind Editorial Warm Paper (`Vollkorn` + `Public Sans`), Left Sidebar (8 menu) + Logo, skema Drizzle 13 tabel Fase 1 + migrasi MySQL, autentikasi Admin (`nuxt-auth-utils`), dan helper upload gambar (`/api/admin/upload`). |
| **Sprint 2: Master Alat, Paket Alat & Penyewa** | CRUD `kategori_alat`, `master_alat` (+ upload foto), `pengaturan_sewa`, panel khusus `Paket Alat` (multi-kategori -> dropdown alat per kategori + foto + tarif otomatis diskon 30%), dan CRUD `penyewa`. |
| **Sprint 3: Transaksi Sewa, Monitoring & Open Trip** | Modul `Sewa Alat` (dropdown jaminan `KTP/SIM/Kartu Pelajar`, sewa satuan & paket, pengembalian & denda), `Alat Disewa` (kolom nama & WA terpisah), `Dashboard` (+ Panel Stok Alat & toggle Siang/Malam), `Data Trip` (+ foto, Paket A/B/C, multi-mepo), dan `Peserta Trip` (4 KPI termasuk DP 50%). |
| **Fase 2 (Ditunda): Website Publik** | Slicing halaman publik (`Beranda`, `Rental Alat`, `Info Trip`, `Gallery`, `Maps`) serta CRUD `gallery` & `profil_toko`. |
