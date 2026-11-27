import {
  boolean,
  datetime,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core'

export const admins = mysqlTable(
  'admins',
  {
    id: int('id').autoincrement().primaryKey(),
    nama: varchar('nama', { length: 120 }).notNull(),
    email: varchar('email', { length: 160 }).notNull(),
    noTelepon: varchar('no_telepon', { length: 30 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 30 }).notNull().default('admin'),
    tokenVersion: int('token_version', { unsigned: true }).notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_admins_email').on(t.email)],
)

export const kategoriAlat = mysqlTable(
  'kategori_alat',
  {
    id: int('id').autoincrement().primaryKey(),
    namaKategori: varchar('nama_kategori', { length: 80 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_kategori_nama').on(t.namaKategori)],
)

export const masterAlat = mysqlTable(
  'master_alat',
  {
    id: int('id').autoincrement().primaryKey(),
    kodeAlat: varchar('kode_alat', { length: 40 }).notNull(),
    idKategori: int('id_kategori')
      .notNull()
      .references(() => kategoriAlat.id, { onDelete: 'restrict' }),
    namaAlat: varchar('nama_alat', { length: 150 }).notNull(),
    spesifikasi: text('spesifikasi').notNull(),
    hargaHarian: int('harga_harian', { unsigned: true }).notNull(),
    stokTotal: int('stok_total', { unsigned: true }).notNull(),
    kondisi: varchar('kondisi', { length: 60 }).notNull().default('Baik'),
    foto: varchar('foto', { length: 255 }),
    statusAktif: boolean('status_aktif').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_master_alat_kode').on(t.kodeAlat),
    index('idx_master_alat_cat_active').on(t.idKategori, t.statusAktif),
  ],
)

export const paketAlat = mysqlTable(
  'paket_alat',
  {
    id: int('id').autoincrement().primaryKey(),
    kodePaket: varchar('kode_paket', { length: 40 }).notNull(),
    namaPaket: varchar('nama_paket', { length: 150 }).notNull(),
    tipePaket: mysqlEnum('tipe_paket', ['paket', 'bundle']).notNull().default('paket'),
    deskripsi: text('deskripsi'),
    labelPromo: varchar('label_promo', { length: 60 }),
    foto: varchar('foto', { length: 255 }),
    diskonPersen: int('diskon_persen', { unsigned: true }).notNull().default(0),
    tarifPaket: int('tarif_paket', { unsigned: true }).notNull(),
    statusAktif: boolean('status_aktif').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [uniqueIndex('uq_paket_alat_kode').on(t.kodePaket)],
)

export const promoDiskon = mysqlTable(
  'promo_diskon',
  {
    id: int('id').autoincrement().primaryKey(),
    namaPromo: varchar('nama_promo', { length: 120 }).notNull(),
    labelBadge: varchar('label_badge', { length: 60 }),
    targetTipe: mysqlEnum('target_tipe', ['semua_alat', 'kategori', 'alat', 'paket']).notNull(),
    targetId: int('target_id', { unsigned: true }),
    tipePotongan: mysqlEnum('tipe_potongan', ['persen', 'nominal']).notNull().default('persen'),
    nilaiPotongan: int('nilai_potongan', { unsigned: true }).notNull(),
    tanggalMulai: datetime('tanggal_mulai'),
    tanggalSelesai: datetime('tanggal_selesai'),
    statusAktif: boolean('status_aktif').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index('idx_promo_diskon_active_target').on(t.statusAktif, t.targetTipe, t.targetId)],
)

export const paketAlatItem = mysqlTable(
  'paket_alat_item',
  {
    id: int('id').autoincrement().primaryKey(),
    idPaket: int('id_paket')
      .notNull()
      .references(() => paketAlat.id, { onDelete: 'cascade' }),
    idAlat: int('id_alat')
      .notNull()
      .references(() => masterAlat.id, { onDelete: 'restrict' }),
    jumlah: int('jumlah', { unsigned: true }).notNull(),
  },
  (t) => [uniqueIndex('uq_paket_item').on(t.idPaket, t.idAlat)],
)

export const pengaturanSewa = mysqlTable('pengaturan_sewa', {
  id: int('id').autoincrement().primaryKey(),
  namaAturan: varchar('nama_aturan', { length: 100 }).notNull(),
  durasiDasarJam: int('durasi_dasar_jam', { unsigned: true }).notNull().default(24),
  minHariPromo: int('min_hari_promo', { unsigned: true }).notNull().default(3),
  diskonPersen: int('diskon_persen', { unsigned: true }).notNull().default(15),
  toleransiTelatJam: int('toleransi_telat_jam', { unsigned: true }).notNull().default(2),
  dendaPersenHarian: int('denda_persen_harian', { unsigned: true }).notNull().default(50),
  isDefault: boolean('is_default').notNull().default(false),
})

export const penyewa = mysqlTable(
  'penyewa',
  {
    id: int('id').autoincrement().primaryKey(),
    nama: varchar('nama', { length: 120 }).notNull(),
    noIdentitas: varchar('no_identitas', { length: 60 }).notNull(),
    noWa: varchar('no_wa', { length: 30 }).notNull(),
    alamat: text('alamat').notNull(),
    catatan: text('catatan'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_penyewa_nik').on(t.noIdentitas)],
)

export const transaksiSewa = mysqlTable(
  'transaksi_sewa',
  {
    id: int('id').autoincrement().primaryKey(),
    kodeSewa: varchar('kode_sewa', { length: 40 }).notNull(),
    idPenyewa: int('id_penyewa')
      .notNull()
      .references(() => penyewa.id, { onDelete: 'restrict' }),
    idAdmin: int('id_admin')
      .notNull()
      .references(() => admins.id, { onDelete: 'restrict' }),
    idPengaturan: int('id_pengaturan')
      .notNull()
      .references(() => pengaturanSewa.id, { onDelete: 'restrict' }),
    jenisJaminan: mysqlEnum('jenis_jaminan', ['KTP', 'SIM', 'Kartu Pelajar']).notNull(),
    tanggalPinjam: datetime('tanggal_pinjam').notNull(),
    tanggalKembaliRencana: datetime('tanggal_kembali_rencana').notNull(),
    tanggalKembaliAktual: datetime('tanggal_kembali_aktual'),
    durasiHari: int('durasi_hari', { unsigned: true }).notNull(),
    subtotal: int('subtotal', { unsigned: true }).notNull(),
    diskonNominal: int('diskon_nominal', { unsigned: true }).notNull().default(0),
    totalBiayaSewa: int('total_biaya_sewa', { unsigned: true }).notNull(),
    dendaTelat: int('denda_telat', { unsigned: true }).notNull().default(0),
    dendaRusak: int('denda_rusak', { unsigned: true }).notNull().default(0),
    statusSewa: mysqlEnum('status_sewa', ['Disewa', 'Terlambat', 'Selesai'])
      .notNull()
      .default('Disewa'),
    catatan: text('catatan'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_transaksi_kode').on(t.kodeSewa),
    index('idx_transaksi_status_due').on(t.statusSewa, t.tanggalKembaliRencana),
  ],
)

export const detailSewa = mysqlTable(
  'detail_sewa',
  {
    id: int('id').autoincrement().primaryKey(),
    idSewa: int('id_sewa')
      .notNull()
      .references(() => transaksiSewa.id, { onDelete: 'cascade' }),
    idAlat: int('id_alat')
      .notNull()
      .references(() => masterAlat.id, { onDelete: 'restrict' }),
    idPaket: int('id_paket').references(() => paketAlat.id, { onDelete: 'set null' }),
    jumlah: int('jumlah', { unsigned: true }).notNull(),
    hargaSatuan: int('harga_satuan', { unsigned: true }).notNull(),
    subtotalItem: int('subtotal_item', { unsigned: true }).notNull(),
    kondisiKembali: varchar('kondisi_kembali', { length: 120 }),
  },
  (t) => [index('idx_detail_alat_sewa').on(t.idAlat, t.idSewa)],
)

export const infoTrip = mysqlTable(
  'info_trip',
  {
    id: int('id').autoincrement().primaryKey(),
    kodeTrip: varchar('kode_trip', { length: 40 }).notNull(),
    judul: varchar('judul', { length: 180 }).notNull(),
    lokasi: varchar('lokasi', { length: 120 }).notNull(),
    tanggalBerangkat: varchar('tanggal_berangkat', { length: 80 }).notNull(),
    durasi: varchar('durasi', { length: 60 }).notNull(),
    kuota: int('kuota', { unsigned: true }).notNull(),
    foto: varchar('foto', { length: 255 }),
    itinerary: text('itinerary').notNull(),
    detailJson: mediumtext('detail_json'),
    statusPublish: mysqlEnum('status_publish', ['Published', 'Draft', 'Penuh'])
      .notNull()
      .default('Draft'),
    idAdmin: int('id_admin')
      .notNull()
      .references(() => admins.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
  },
  (t) => [uniqueIndex('uq_info_trip_kode').on(t.kodeTrip)],
)

export const tripPaket = mysqlTable(
  'trip_paket',
  {
    id: int('id').autoincrement().primaryKey(),
    idTrip: int('id_trip')
      .notNull()
      .references(() => infoTrip.id, { onDelete: 'cascade' }),
    kodePaket: varchar('kode_paket', { length: 30 }).notNull(),
    deskripsiFasilitas: varchar('deskripsi_fasilitas', { length: 160 }).notNull(),
    harga: int('harga', { unsigned: true }).notNull(),
  },
  (t) => [uniqueIndex('uq_trip_paket').on(t.idTrip, t.kodePaket)],
)

export const tripMeetingPoint = mysqlTable(
  'trip_meeting_point',
  {
    id: int('id').autoincrement().primaryKey(),
    idTrip: int('id_trip')
      .notNull()
      .references(() => infoTrip.id, { onDelete: 'cascade' }),
    namaLokasi: varchar('nama_lokasi', { length: 180 }).notNull(),
    isCustom: boolean('is_custom').notNull().default(false),
    urutan: int('urutan', { unsigned: true }).notNull().default(0),
  },
  (t) => [index('idx_trip_mepo').on(t.idTrip, t.urutan)],
)

export const pesertaTrip = mysqlTable(
  'peserta_trip',
  {
    id: int('id').autoincrement().primaryKey(),
    idTrip: int('id_trip')
      .notNull()
      .references(() => infoTrip.id, { onDelete: 'restrict' }),
    idTripPaket: int('id_trip_paket').references(() => tripPaket.id, { onDelete: 'set null' }),
    idMeetingPoint: int('id_meeting_point').references(() => tripMeetingPoint.id, {
      onDelete: 'set null',
    }),
    mepoCustom: varchar('mepo_custom', { length: 180 }),
    nama: varchar('nama', { length: 120 }).notNull(),
    noIdentitas: varchar('no_identitas', { length: 60 }).notNull(),
    noWa: varchar('no_wa', { length: 30 }).notNull(),
    kontakDarurat: varchar('kontak_darurat', { length: 160 }).notNull(),
    statusBayar: mysqlEnum('status_bayar', ['Lunas', 'DP 50%', 'Belum Bayar'])
      .notNull()
      .default('Belum Bayar'),
    nominalBayar: int('nominal_bayar', { unsigned: true }).notNull().default(0),
    sewaAlatTambahan: varchar('sewa_alat_tambahan', { length: 200 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('idx_peserta_trip_status').on(t.idTrip, t.statusBayar)],
)

export const riwayatPenyewa = mysqlTable(
  'riwayat_penyewa',
  {
    id: int('id').autoincrement().primaryKey(),
    idSewa: int('id_sewa').references(() => transaksiSewa.id, { onDelete: 'set null' }),
    idPenyewa: int('id_penyewa').references(() => penyewa.id, { onDelete: 'set null' }),
    kodeSewa: varchar('kode_sewa', { length: 40 }).notNull(),
    namaPenyewa: varchar('nama_penyewa', { length: 120 }).notNull(),
    noIdentitas: varchar('no_identitas', { length: 60 }).notNull(),
    noWa: varchar('no_wa', { length: 30 }).notNull(),
    jenisJaminan: varchar('jenis_jaminan', { length: 30 }).notNull(),
    tanggalPinjam: datetime('tanggal_pinjam').notNull(),
    tanggalKembaliRencana: datetime('tanggal_kembali_rencana').notNull(),
    tanggalKembaliAktual: datetime('tanggal_kembali_aktual').notNull(),
    durasiHari: int('durasi_hari', { unsigned: true }).notNull(),
    ringkasanAlat: text('ringkasan_alat').notNull(),
    totalUnit: int('total_unit', { unsigned: true }).notNull().default(0),
    totalBiayaSewa: int('total_biaya_sewa', { unsigned: true }).notNull(),
    dendaTelat: int('denda_telat', { unsigned: true }).notNull().default(0),
    dendaRusak: int('denda_rusak', { unsigned: true }).notNull().default(0),
    totalAkhir: int('total_akhir', { unsigned: true }).notNull(),
    kondisiKembali: varchar('kondisi_kembali', { length: 120 }).notNull().default('Baik & Lengkap'),
    statusKetepatan: mysqlEnum('status_ketepatan', ['Tepat Waktu', 'Terlambat'])
      .notNull()
      .default('Tepat Waktu'),
    catatan: text('catatan'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_riwayat_penyewa_sewa').on(t.idSewa),
    index('idx_riwayat_penyewa_penyewa').on(t.idPenyewa, t.tanggalKembaliAktual),
    index('idx_riwayat_penyewa_kembali').on(t.tanggalKembaliAktual),
  ],
)

export const securityAuditLogs = mysqlTable(
  'security_audit_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    severity: mysqlEnum('severity', ['info', 'warn', 'critical']).notNull().default('info'),
    adminId: int('admin_id').references(() => admins.id, { onDelete: 'set null' }),
    actorEmail: varchar('actor_email', { length: 160 }),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 255 }),
    targetType: varchar('target_type', { length: 60 }),
    targetId: varchar('target_id', { length: 64 }),
    metadataJson: text('metadata_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('idx_security_audit_created').on(t.createdAt),
    index('idx_security_audit_event_created').on(t.eventType, t.createdAt),
    index('idx_security_audit_severity_created').on(t.severity, t.createdAt),
  ],
)
