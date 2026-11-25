CREATE TABLE `admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nama` varchar(120) NOT NULL,
	`email` varchar(160) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` varchar(30) NOT NULL DEFAULT 'admin',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_admins_email` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `detail_sewa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_sewa` int NOT NULL,
	`id_alat` int NOT NULL,
	`id_paket` int,
	`jumlah` int unsigned NOT NULL,
	`harga_satuan` int unsigned NOT NULL,
	`subtotal_item` int unsigned NOT NULL,
	`kondisi_kembali` varchar(120),
	CONSTRAINT `detail_sewa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `info_trip` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kode_trip` varchar(40) NOT NULL,
	`judul` varchar(180) NOT NULL,
	`lokasi` varchar(120) NOT NULL,
	`tanggal_berangkat` varchar(80) NOT NULL,
	`durasi` varchar(60) NOT NULL,
	`kuota` int unsigned NOT NULL,
	`foto` varchar(255),
	`itinerary` text NOT NULL,
	`status_publish` enum('Published','Draft','Penuh') NOT NULL DEFAULT 'Draft',
	`id_admin` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `info_trip_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_info_trip_kode` UNIQUE(`kode_trip`)
);
--> statement-breakpoint
CREATE TABLE `kategori_alat` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nama_kategori` varchar(80) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `kategori_alat_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_kategori_nama` UNIQUE(`nama_kategori`)
);
--> statement-breakpoint
CREATE TABLE `master_alat` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kode_alat` varchar(40) NOT NULL,
	`id_kategori` int NOT NULL,
	`nama_alat` varchar(150) NOT NULL,
	`spesifikasi` text NOT NULL,
	`harga_harian` int unsigned NOT NULL,
	`stok_total` int unsigned NOT NULL,
	`kondisi` varchar(60) NOT NULL DEFAULT 'Baik',
	`foto` varchar(255),
	`status_aktif` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `master_alat_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_master_alat_kode` UNIQUE(`kode_alat`)
);
--> statement-breakpoint
CREATE TABLE `paket_alat` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kode_paket` varchar(40) NOT NULL,
	`nama_paket` varchar(150) NOT NULL,
	`foto` varchar(255),
	`diskon_persen` int unsigned NOT NULL DEFAULT 30,
	`tarif_paket` int unsigned NOT NULL,
	`status_aktif` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paket_alat_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_paket_alat_kode` UNIQUE(`kode_paket`)
);
--> statement-breakpoint
CREATE TABLE `paket_alat_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_paket` int NOT NULL,
	`id_alat` int NOT NULL,
	`jumlah` int unsigned NOT NULL,
	CONSTRAINT `paket_alat_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_paket_item` UNIQUE(`id_paket`,`id_alat`)
);
--> statement-breakpoint
CREATE TABLE `pengaturan_sewa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nama_aturan` varchar(100) NOT NULL,
	`durasi_dasar_jam` int unsigned NOT NULL DEFAULT 24,
	`min_hari_promo` int unsigned NOT NULL DEFAULT 3,
	`diskon_persen` int unsigned NOT NULL DEFAULT 15,
	`toleransi_telat_jam` int unsigned NOT NULL DEFAULT 2,
	`denda_persen_harian` int unsigned NOT NULL DEFAULT 50,
	`is_default` boolean NOT NULL DEFAULT false,
	CONSTRAINT `pengaturan_sewa_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `penyewa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nama` varchar(120) NOT NULL,
	`no_identitas` varchar(60) NOT NULL,
	`no_wa` varchar(30) NOT NULL,
	`alamat` text NOT NULL,
	`catatan` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `penyewa_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_penyewa_nik` UNIQUE(`no_identitas`)
);
--> statement-breakpoint
CREATE TABLE `peserta_trip` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_trip` int NOT NULL,
	`id_trip_paket` int,
	`id_meeting_point` int,
	`mepo_custom` varchar(180),
	`nama` varchar(120) NOT NULL,
	`no_identitas` varchar(60) NOT NULL,
	`no_wa` varchar(30) NOT NULL,
	`kontak_darurat` varchar(160) NOT NULL,
	`status_bayar` enum('Lunas','DP 50%','Belum Bayar') NOT NULL DEFAULT 'Belum Bayar',
	`nominal_bayar` int unsigned NOT NULL DEFAULT 0,
	`sewa_alat_tambahan` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `peserta_trip_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaksi_sewa` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kode_sewa` varchar(40) NOT NULL,
	`id_penyewa` int NOT NULL,
	`id_admin` int NOT NULL,
	`id_pengaturan` int NOT NULL,
	`jenis_jaminan` enum('KTP','SIM','Kartu Pelajar') NOT NULL,
	`tanggal_pinjam` datetime NOT NULL,
	`tanggal_kembali_rencana` datetime NOT NULL,
	`tanggal_kembali_aktual` datetime,
	`durasi_hari` int unsigned NOT NULL,
	`subtotal` int unsigned NOT NULL,
	`diskon_nominal` int unsigned NOT NULL DEFAULT 0,
	`total_biaya_sewa` int unsigned NOT NULL,
	`denda_telat` int unsigned NOT NULL DEFAULT 0,
	`denda_rusak` int unsigned NOT NULL DEFAULT 0,
	`status_sewa` enum('Disewa','Terlambat','Selesai') NOT NULL DEFAULT 'Disewa',
	`catatan` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transaksi_sewa_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_transaksi_kode` UNIQUE(`kode_sewa`)
);
--> statement-breakpoint
CREATE TABLE `trip_meeting_point` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_trip` int NOT NULL,
	`nama_lokasi` varchar(180) NOT NULL,
	`is_custom` boolean NOT NULL DEFAULT false,
	`urutan` int unsigned NOT NULL DEFAULT 0,
	CONSTRAINT `trip_meeting_point_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trip_paket` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_trip` int NOT NULL,
	`kode_paket` varchar(30) NOT NULL,
	`deskripsi_fasilitas` varchar(160) NOT NULL,
	`harga` int unsigned NOT NULL,
	CONSTRAINT `trip_paket_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_trip_paket` UNIQUE(`id_trip`,`kode_paket`)
);
--> statement-breakpoint
ALTER TABLE `detail_sewa` ADD CONSTRAINT `detail_sewa_id_sewa_transaksi_sewa_id_fk` FOREIGN KEY (`id_sewa`) REFERENCES `transaksi_sewa`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `detail_sewa` ADD CONSTRAINT `detail_sewa_id_alat_master_alat_id_fk` FOREIGN KEY (`id_alat`) REFERENCES `master_alat`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `detail_sewa` ADD CONSTRAINT `detail_sewa_id_paket_paket_alat_id_fk` FOREIGN KEY (`id_paket`) REFERENCES `paket_alat`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `info_trip` ADD CONSTRAINT `info_trip_id_admin_admins_id_fk` FOREIGN KEY (`id_admin`) REFERENCES `admins`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `master_alat` ADD CONSTRAINT `master_alat_id_kategori_kategori_alat_id_fk` FOREIGN KEY (`id_kategori`) REFERENCES `kategori_alat`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paket_alat_item` ADD CONSTRAINT `paket_alat_item_id_paket_paket_alat_id_fk` FOREIGN KEY (`id_paket`) REFERENCES `paket_alat`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paket_alat_item` ADD CONSTRAINT `paket_alat_item_id_alat_master_alat_id_fk` FOREIGN KEY (`id_alat`) REFERENCES `master_alat`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peserta_trip` ADD CONSTRAINT `peserta_trip_id_trip_info_trip_id_fk` FOREIGN KEY (`id_trip`) REFERENCES `info_trip`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peserta_trip` ADD CONSTRAINT `peserta_trip_id_trip_paket_trip_paket_id_fk` FOREIGN KEY (`id_trip_paket`) REFERENCES `trip_paket`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `peserta_trip` ADD CONSTRAINT `peserta_trip_id_meeting_point_trip_meeting_point_id_fk` FOREIGN KEY (`id_meeting_point`) REFERENCES `trip_meeting_point`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaksi_sewa` ADD CONSTRAINT `transaksi_sewa_id_penyewa_penyewa_id_fk` FOREIGN KEY (`id_penyewa`) REFERENCES `penyewa`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaksi_sewa` ADD CONSTRAINT `transaksi_sewa_id_admin_admins_id_fk` FOREIGN KEY (`id_admin`) REFERENCES `admins`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaksi_sewa` ADD CONSTRAINT `transaksi_sewa_id_pengaturan_pengaturan_sewa_id_fk` FOREIGN KEY (`id_pengaturan`) REFERENCES `pengaturan_sewa`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_meeting_point` ADD CONSTRAINT `trip_meeting_point_id_trip_info_trip_id_fk` FOREIGN KEY (`id_trip`) REFERENCES `info_trip`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trip_paket` ADD CONSTRAINT `trip_paket_id_trip_info_trip_id_fk` FOREIGN KEY (`id_trip`) REFERENCES `info_trip`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_detail_alat_sewa` ON `detail_sewa` (`id_alat`,`id_sewa`);--> statement-breakpoint
CREATE INDEX `idx_master_alat_cat_active` ON `master_alat` (`id_kategori`,`status_aktif`);--> statement-breakpoint
CREATE INDEX `idx_peserta_trip_status` ON `peserta_trip` (`id_trip`,`status_bayar`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_status_due` ON `transaksi_sewa` (`status_sewa`,`tanggal_kembali_rencana`);--> statement-breakpoint
CREATE INDEX `idx_trip_mepo` ON `trip_meeting_point` (`id_trip`,`urutan`);