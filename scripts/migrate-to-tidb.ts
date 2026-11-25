import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import mysql from 'mysql2/promise'
import { put } from '@vercel/blob'

try {
  process.loadEnvFile?.()
} catch {
  // Ignore when .env is absent
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const CREATE_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nama VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admins_email (email)
  )`,
  `CREATE TABLE IF NOT EXISTS kategori_alat (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nama_kategori VARCHAR(80) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_kategori_nama (nama_kategori)
  )`,
  `CREATE TABLE IF NOT EXISTS master_alat (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    kode_alat VARCHAR(40) NOT NULL,
    id_kategori INT NOT NULL,
    nama_alat VARCHAR(150) NOT NULL,
    spesifikasi TEXT NOT NULL,
    harga_harian INT UNSIGNED NOT NULL,
    stok_total INT UNSIGNED NOT NULL,
    kondisi VARCHAR(60) NOT NULL DEFAULT 'Baik',
    foto VARCHAR(255) NULL,
    status_aktif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_master_alat_kode (kode_alat),
    INDEX idx_master_alat_cat_active (id_kategori, status_aktif),
    CONSTRAINT fk_master_alat_cat FOREIGN KEY (id_kategori) REFERENCES kategori_alat(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS paket_alat (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    kode_paket VARCHAR(40) NOT NULL,
    nama_paket VARCHAR(150) NOT NULL,
    tipe_paket ENUM('paket', 'bundle') NOT NULL DEFAULT 'paket',
    deskripsi TEXT NULL,
    label_promo VARCHAR(60) NULL,
    foto VARCHAR(255) NULL,
    diskon_persen INT UNSIGNED NOT NULL DEFAULT 0,
    tarif_paket INT UNSIGNED NOT NULL,
    status_aktif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_paket_alat_kode (kode_paket)
  )`,
  `CREATE TABLE IF NOT EXISTS paket_alat_item (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_paket INT NOT NULL,
    id_alat INT NOT NULL,
    jumlah INT UNSIGNED NOT NULL,
    UNIQUE KEY uq_paket_item (id_paket, id_alat),
    CONSTRAINT fk_paket_item_paket FOREIGN KEY (id_paket) REFERENCES paket_alat(id) ON DELETE CASCADE,
    CONSTRAINT fk_paket_item_alat FOREIGN KEY (id_alat) REFERENCES master_alat(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS promo_diskon (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nama_promo VARCHAR(120) NOT NULL,
    label_badge VARCHAR(60) NULL,
    target_tipe ENUM('semua_alat', 'kategori', 'alat', 'paket') NOT NULL,
    target_id INT UNSIGNED NULL,
    tipe_potongan ENUM('persen', 'nominal') NOT NULL DEFAULT 'persen',
    nilai_potongan INT UNSIGNED NOT NULL,
    tanggal_mulai DATETIME NULL,
    tanggal_selesai DATETIME NULL,
    status_aktif BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_promo_diskon_active_target (status_aktif, target_tipe, target_id)
  )`,
  `CREATE TABLE IF NOT EXISTS pengaturan_sewa (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nama_aturan VARCHAR(100) NOT NULL,
    durasi_dasar_jam INT UNSIGNED NOT NULL DEFAULT 24,
    min_hari_promo INT UNSIGNED NOT NULL DEFAULT 3,
    diskon_persen INT UNSIGNED NOT NULL DEFAULT 15,
    toleransi_telat_jam INT UNSIGNED NOT NULL DEFAULT 2,
    denda_persen_harian INT UNSIGNED NOT NULL DEFAULT 50,
    is_default BOOLEAN NOT NULL DEFAULT FALSE
  )`,
  `CREATE TABLE IF NOT EXISTS penyewa (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    nama VARCHAR(120) NOT NULL,
    no_identitas VARCHAR(60) NOT NULL,
    no_wa VARCHAR(30) NOT NULL,
    alamat TEXT NOT NULL,
    catatan TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_penyewa_nik (no_identitas)
  )`,
  `CREATE TABLE IF NOT EXISTS transaksi_sewa (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    kode_sewa VARCHAR(40) NOT NULL,
    id_penyewa INT NOT NULL,
    id_admin INT NOT NULL,
    id_pengaturan INT NOT NULL,
    jenis_jaminan ENUM('KTP', 'SIM', 'Kartu Pelajar') NOT NULL,
    tanggal_pinjam DATETIME NOT NULL,
    tanggal_kembali_rencana DATETIME NOT NULL,
    tanggal_kembali_aktual DATETIME NULL,
    durasi_hari INT UNSIGNED NOT NULL,
    subtotal INT UNSIGNED NOT NULL,
    diskon_nominal INT UNSIGNED NOT NULL DEFAULT 0,
    total_biaya_sewa INT UNSIGNED NOT NULL,
    denda_telat INT UNSIGNED NOT NULL DEFAULT 0,
    denda_rusak INT UNSIGNED NOT NULL DEFAULT 0,
    status_sewa ENUM('Disewa', 'Terlambat', 'Selesai') NOT NULL DEFAULT 'Disewa',
    catatan TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_transaksi_kode (kode_sewa),
    INDEX idx_transaksi_status_due (status_sewa, tanggal_kembali_rencana),
    CONSTRAINT fk_transaksi_penyewa FOREIGN KEY (id_penyewa) REFERENCES penyewa(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transaksi_admin FOREIGN KEY (id_admin) REFERENCES admins(id) ON DELETE RESTRICT,
    CONSTRAINT fk_transaksi_pengaturan FOREIGN KEY (id_pengaturan) REFERENCES pengaturan_sewa(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS detail_sewa (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_sewa INT NOT NULL,
    id_alat INT NOT NULL,
    id_paket INT NULL,
    jumlah INT UNSIGNED NOT NULL,
    harga_satuan INT UNSIGNED NOT NULL,
    subtotal_item INT UNSIGNED NOT NULL,
    kondisi_kembali VARCHAR(120) NULL,
    INDEX idx_detail_alat_sewa (id_alat, id_sewa),
    CONSTRAINT fk_detail_sewa FOREIGN KEY (id_sewa) REFERENCES transaksi_sewa(id) ON DELETE CASCADE,
    CONSTRAINT fk_detail_alat FOREIGN KEY (id_alat) REFERENCES master_alat(id) ON DELETE RESTRICT,
    CONSTRAINT fk_detail_paket FOREIGN KEY (id_paket) REFERENCES paket_alat(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS info_trip (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    kode_trip VARCHAR(40) NOT NULL,
    judul VARCHAR(180) NOT NULL,
    lokasi VARCHAR(120) NOT NULL,
    tanggal_berangkat VARCHAR(80) NOT NULL,
    durasi VARCHAR(60) NOT NULL,
    kuota INT UNSIGNED NOT NULL,
    foto VARCHAR(255) NULL,
    itinerary TEXT NOT NULL,
    detail_json MEDIUMTEXT NULL,
    status_publish ENUM('Published', 'Draft', 'Penuh') NOT NULL DEFAULT 'Draft',
    id_admin INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_info_trip_kode (kode_trip),
    CONSTRAINT fk_info_trip_admin FOREIGN KEY (id_admin) REFERENCES admins(id) ON DELETE RESTRICT
  )`,
  `CREATE TABLE IF NOT EXISTS trip_paket (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_trip INT NOT NULL,
    kode_paket VARCHAR(30) NOT NULL,
    deskripsi_fasilitas VARCHAR(160) NOT NULL,
    harga INT UNSIGNED NOT NULL,
    UNIQUE KEY uq_trip_paket (id_trip, kode_paket),
    CONSTRAINT fk_trip_paket_trip FOREIGN KEY (id_trip) REFERENCES info_trip(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS trip_meeting_point (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_trip INT NOT NULL,
    nama_lokasi VARCHAR(180) NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    urutan INT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_trip_mepo (id_trip, urutan),
    CONSTRAINT fk_trip_mepo_trip FOREIGN KEY (id_trip) REFERENCES info_trip(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS peserta_trip (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_trip INT NOT NULL,
    id_trip_paket INT NULL,
    id_meeting_point INT NULL,
    mepo_custom VARCHAR(180) NULL,
    nama VARCHAR(120) NOT NULL,
    no_identitas VARCHAR(60) NOT NULL,
    no_wa VARCHAR(30) NOT NULL,
    kontak_darurat VARCHAR(160) NOT NULL,
    status_bayar ENUM('Lunas', 'DP 50%', 'Belum Bayar') NOT NULL DEFAULT 'Belum Bayar',
    nominal_bayar INT UNSIGNED NOT NULL DEFAULT 0,
    sewa_alat_tambahan VARCHAR(200) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_peserta_trip_status (id_trip, status_bayar),
    CONSTRAINT fk_peserta_trip FOREIGN KEY (id_trip) REFERENCES info_trip(id) ON DELETE RESTRICT,
    CONSTRAINT fk_peserta_paket FOREIGN KEY (id_trip_paket) REFERENCES trip_paket(id) ON DELETE SET NULL,
    CONSTRAINT fk_peserta_mepo FOREIGN KEY (id_meeting_point) REFERENCES trip_meeting_point(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS riwayat_penyewa (
    id INT AUTO_INCREMENT NOT NULL PRIMARY KEY,
    id_sewa INT NULL,
    id_penyewa INT NULL,
    kode_sewa VARCHAR(40) NOT NULL,
    nama_penyewa VARCHAR(120) NOT NULL,
    no_identitas VARCHAR(60) NOT NULL,
    no_wa VARCHAR(30) NOT NULL,
    jenis_jaminan VARCHAR(30) NOT NULL,
    tanggal_pinjam DATETIME NOT NULL,
    tanggal_kembali_rencana DATETIME NOT NULL,
    tanggal_kembali_aktual DATETIME NOT NULL,
    durasi_hari INT UNSIGNED NOT NULL,
    ringkasan_alat TEXT NOT NULL,
    total_unit INT UNSIGNED NOT NULL DEFAULT 0,
    total_biaya_sewa INT UNSIGNED NOT NULL,
    denda_telat INT UNSIGNED NOT NULL DEFAULT 0,
    denda_rusak INT UNSIGNED NOT NULL DEFAULT 0,
    total_akhir INT UNSIGNED NOT NULL,
    kondisi_kembali VARCHAR(120) NOT NULL DEFAULT 'Baik & Lengkap',
    status_ketepatan ENUM('Tepat Waktu', 'Terlambat') NOT NULL DEFAULT 'Tepat Waktu',
    catatan TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_riwayat_penyewa_sewa (id_sewa),
    INDEX idx_riwayat_penyewa_penyewa (id_penyewa, tanggal_kembali_aktual),
    INDEX idx_riwayat_penyewa_kembali (tanggal_kembali_aktual)
  )`,
]

const TABLE_ORDER = [
  'admins',
  'kategori_alat',
  'master_alat',
  'paket_alat',
  'paket_alat_item',
  'promo_diskon',
  'pengaturan_sewa',
  'penyewa',
  'transaksi_sewa',
  'detail_sewa',
  'info_trip',
  'trip_paket',
  'trip_meeting_point',
  'peserta_trip',
  'riwayat_penyewa',
] as const

const PHOTO_TABLES = new Set(['master_alat', 'paket_alat', 'info_trip'])

async function uploadLocalMediaIfNeeded(
  localRelUrl: string,
  blobToken: string,
  cache: Map<string, string>,
): Promise<string> {
  if (!blobToken || !localRelUrl.startsWith('/uploads/')) return localRelUrl
  const cached = cache.get(localRelUrl)
  if (cached) return cached

  const diskPath = resolve(process.cwd(), 'public', localRelUrl.replace(/^\//, ''))
  try {
    const buf = await readFile(diskPath)
    const ext = extname(diskPath).toLowerCase()
    const contentType = MIME_BY_EXT[ext] || 'application/octet-stream'
    const blob = await put(localRelUrl.replace(/^\//, ''), buf, {
      access: 'public',
      contentType,
      token: blobToken,
    })
    cache.set(localRelUrl, blob.url)
    console.log(`  Uploaded media: ${localRelUrl} -> ${blob.url}`)
    return blob.url
  } catch (err) {
    console.warn(`  Warning: failed to upload ${localRelUrl}:`, (err as Error).message)
    return localRelUrl
  }
}

async function main() {
  const targetUrl = String(process.env.TARGET_DATABASE_URL || '').trim()
  if (!targetUrl) {
    throw new Error('TARGET_DATABASE_URL is required (TiDB Cloud MySQL connection URL).')
  }

  const blobToken = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()

  const sourcePool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),
    user: process.env.DB_USER || 'merayau',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'merayau_outdoor',
  })

  const u = new URL(targetUrl)
  const rawDb = u.pathname.replace(/^\//, '')
  const targetDb = !rawDb || rawDb === 'sys' ? 'merayau_outdoor' : rawDb
  const targetSsl = { minVersion: 'TLSv1.2' as const, rejectUnauthorized: true }

  const bootstrapConn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl: targetSsl,
  })
  await bootstrapConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${targetDb.replace(/`/g, '``')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await bootstrapConn.end()

  const targetPool = mysql.createPool({
    host: u.hostname,
    port: Number(u.port || 4000),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: targetDb,
    ssl: targetSsl,
  })

  const blobCache = new Map<string, string>()

  try {
    console.log('Ensuring schema on target TiDB Cloud...')
    for (const ddl of CREATE_TABLE_STATEMENTS) {
      await targetPool.query(ddl)
    }

    await targetPool.query('SET FOREIGN_KEY_CHECKS = 0')

    for (const table of TABLE_ORDER) {
      const [rows] = await sourcePool.query<mysql.RowDataPacket[]>(`SELECT * FROM \`${table}\``)
      await targetPool.query(`DELETE FROM \`${table}\``)

      if (rows.length > 0) {
        if (PHOTO_TABLES.has(table) && blobToken) {
          for (const row of rows) {
            if (typeof row.foto === 'string' && row.foto.startsWith('/uploads/')) {
              row.foto = await uploadLocalMediaIfNeeded(row.foto, blobToken, blobCache)
            }
          }
        }

        const cols = Object.keys(rows[0]!)
        const colSql = cols.map((c) => `\`${c}\``).join(', ')
        const rowPlaceholder = `(${cols.map(() => '?').join(', ')})`
        const batchSize = 50

        for (let i = 0; i < rows.length; i += batchSize) {
          const slice = rows.slice(i, i + batchSize)
          const placeholders = slice.map(() => rowPlaceholder).join(', ')
          const values: unknown[] = []
          for (const r of slice) {
            for (const c of cols) {
              values.push(r[c])
            }
          }
          await targetPool.query(
            `INSERT INTO \`${table}\` (${colSql}) VALUES ${placeholders}`,
            values,
          )
        }
      }

      const [targetCountRows] = await targetPool.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM \`${table}\``,
      )
      const targetCnt = Number(targetCountRows[0]?.cnt ?? 0)
      console.log(`  ${table}: local=${rows.length} -> tidb=${targetCnt}`)
    }

    await targetPool.query('SET FOREIGN_KEY_CHECKS = 1')
    console.log('Migration to TiDB Cloud completed successfully!')
  } finally {
    await targetPool.end()
    await sourcePool.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
