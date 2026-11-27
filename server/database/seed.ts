import { randomBytes } from 'node:crypto'
import { count, eq } from 'drizzle-orm'
import {
  admins,
  detailSewa,
  infoTrip,
  kategoriAlat,
  masterAlat,
  paketAlat,
  paketAlatItem,
  pengaturanSewa,
  penyewa,
  pesertaTrip,
  transaksiSewa,
  tripMeetingPoint,
  tripPaket,
} from './schema'
import { hashPassword } from '../utils/auth'
import { closeDb, useDb } from '../utils/db'

try {
  process.loadEnvFile?.()
} catch {
  // Use environment variables already present in the shell.
}

async function main() {
  const db = useDb()

  if (process.argv.includes('--reset-catalog')) {
    await db.transaction(async (tx) => {
      await tx.delete(detailSewa)
      await tx.delete(transaksiSewa)
      await tx.delete(paketAlatItem)
      await tx.delete(paketAlat)
      await tx.delete(masterAlat)
      await tx.delete(kategoriAlat)
    })
  }

  const adminEmail = (process.env.ADMIN_SEED_EMAIL || 'admin@merayau.id').trim().toLowerCase()
  const rawSeedPassword = (process.env.ADMIN_SEED_PASSWORD || '').trim()
  const WEAK_SEED_PASSWORDS = new Set(['change-me', 'merayau123', 'password', 'admin123', '12345678'])

  let [admin] = await db.select().from(admins).where(eq(admins.email, adminEmail)).limit(1)
  if (!admin) {
    if (
      process.env.NODE_ENV === 'production' &&
      (rawSeedPassword.length < 12 || WEAK_SEED_PASSWORDS.has(rawSeedPassword.toLowerCase()))
    ) {
      throw new Error(
        'ADMIN_SEED_PASSWORD wajib diset minimal 12 karakter non-default pada environment production.',
      )
    }
    const generated = !rawSeedPassword
    const adminPassword = rawSeedPassword || randomBytes(12).toString('base64url')
    const [ins] = await db.insert(admins).values({
      nama: 'Admin Basecamp Sleman',
      email: adminEmail,
      noTelepon: '6285156549003',
      passwordHash: await hashPassword(adminPassword),
      role: 'admin',
    })
    if (generated) {
      console.log(`[seed] Akun admin awal dibuat (${adminEmail}). Segera ganti kata sandi setelah login pertama.`)
    }
    const [created] = await db.select().from(admins).where(eq(admins.id, Number(ins.insertId))).limit(1)
    admin = created!
  }

  let [rule] = await db.select().from(pengaturanSewa).limit(1)
  if (!rule) {
    const [ins] = await db.insert(pengaturanSewa).values({
      namaAturan: 'Reguler Basecamp Sleman',
      durasiDasarJam: 24,
      minHariPromo: 3,
      diskonPersen: 15,
      toleransiTelatJam: 2,
      dendaPersenHarian: 50,
      isDefault: true,
    })
    const [created] = await db
      .select()
      .from(pengaturanSewa)
      .where(eq(pengaturanSewa.id, Number(ins.insertId)))
      .limit(1)
    rule = created!
  }

  const categoryNames = [
    'Tenda / Dome',
    'Carrier / Tas',
    'Trekking Gear',
    'Camping Gear',
    'Cooking Set',
    'Lampu & Acc',
  ]
  const catMap = new Map<string, number>()
  for (const name of categoryNames) {
    const [existing] = await db
      .select()
      .from(kategoriAlat)
      .where(eq(kategoriAlat.namaKategori, name))
      .limit(1)
    if (existing) {
      catMap.set(name, existing.id)
    } else {
      const [ins] = await db.insert(kategoriAlat).values({ namaKategori: name })
      catMap.set(name, Number(ins.insertId))
    }
  }

  const alatSeed = [
    // Tenda / Dome (10)
    {
      kodeAlat: 'TND-01',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Wildshell Mandala Kap. 6-8 Org',
      spesifikasi: 'Double Layer · Kapasitas 6-8 orang · Tarif katalog: 1H 70K / 2H 110K / 3H 150K (+30K/hari)',
      hargaHarian: 70000,
      stokTotal: 6,
      kondisi: 'Baik',
      foto: '/images/produk/TND-01.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-02',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Venturis Antares Kap. 4 Org',
      spesifikasi: 'Double Layer, Frame Alloy · Kapasitas 4 orang · Tarif katalog: 1H 50K / 2H 75K / 3H 100K (+20K/hari)',
      hargaHarian: 50000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/TND-02.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-03',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Wildshell Raya Kap. 4-5 Org',
      spesifikasi: 'Double Layer · Kapasitas 4-5 orang · Tarif katalog: 1H 50K / 2H 70K / 3H 90K (+15K/hari)',
      hargaHarian: 50000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/TND-03.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-04',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Wildshell Jayadipa Kap. 4 Org',
      spesifikasi: 'Double Layer · Kapasitas 4 orang · Tarif katalog: 1H 45K / 2H 65K / 3H 80K (+15K/hari)',
      hargaHarian: 45000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TND-04.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-05',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tendaki Borneo Kap. 4-5 Org',
      spesifikasi: 'Double Layer · Kapasitas 4-5 orang · Tarif katalog: 1H 45K / 2H 65K / 3H 80K (+15K/hari)',
      hargaHarian: 45000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TND-05.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-06',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Single Dome Kap. 4 Org',
      spesifikasi: 'Single Layer · Kapasitas 4 orang · Tarif katalog: 1H 30K / 2H 50K / 3H 60K (+10K/hari)',
      hargaHarian: 30000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TND-06.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-07',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Venturis Pollux Kap. 2-3 Org',
      spesifikasi: 'Double Layer, Frame Alloy · Kapasitas 2-3 orang · Tarif katalog: 1H 35K / 2H 50K / 3H 65K (+10K/hari)',
      hargaHarian: 35000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TND-07.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-08',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Malcone Kap. 2 Org',
      spesifikasi: 'Double Layer · Kapasitas 2 orang · Tarif katalog: 1H 20K / 2H 35K / 3H 45K (+10K/hari)',
      hargaHarian: 20000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TND-08.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-09',
      kategori: 'Tenda / Dome',
      namaAlat: 'Tenda Single Dome Kap. 2-3 Org',
      spesifikasi: 'Single Layer · Kapasitas 2-3 orang · Tarif katalog: 1H 15K / 2H 25K / 3H 30K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/TND-09.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TND-10',
      kategori: 'Tenda / Dome',
      namaAlat: 'Footprint / Alas Tenda',
      spesifikasi: 'Ukuran 150 x 210 cm · Alas pelindung tenda · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+3K/hari)',
      hargaHarian: 8000,
      stokTotal: 15,
      kondisi: 'Baik',
      foto: '/images/produk/TND-10.jpg',
      statusAktif: true,
    },
    // Carrier / Tas (10)
    {
      kodeAlat: 'CRR-01',
      kategori: 'Carrier / Tas',
      namaAlat: 'Consina Everest 60L & Via Ferrata 50+5L',
      spesifikasi: 'Carrier ekspedisi Consina Everest 60L / Via Ferrata 50+5L · Tarif katalog: 1H 45K / 2H 75K / 3H 100K (+20K/hari)',
      hargaHarian: 45000,
      stokTotal: 6,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-01.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-02',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Naturehike 70 L',
      spesifikasi: 'Kapasitas 70L, rangka ultralight · Tarif katalog: 1H 40K / 2H 60K / 3H 75K (+10K/hari)',
      hargaHarian: 40000,
      stokTotal: 6,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-02.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-03',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Eiger 60 L',
      spesifikasi: 'Kapasitas 60L, backsystem ergonomis · Tarif katalog: 1H 30K / 2H 50K / 3H 60K (+10K/hari)',
      hargaHarian: 30000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-03.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-04',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Reptil Kobra 60 L',
      spesifikasi: 'Kapasitas 60L, seri Reptil Kobra · Tarif katalog: 1H 30K / 2H 50K / 3H 60K (+10K/hari)',
      hargaHarian: 30000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-04.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-05',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Arei 60 L',
      spesifikasi: 'Kapasitas 60L, rangka aluminium · Tarif katalog: 1H 25K / 2H 35K / 3H 45K (+10K/hari)',
      hargaHarian: 25000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-05.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-06',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Zarventure 60+5 L',
      spesifikasi: 'Kapasitas 60+5L · Tarif katalog: 1H 20K / 2H 30K / 3H 40K (+10K/hari)',
      hargaHarian: 20000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-06.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-07',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Arei 45 L',
      spesifikasi: 'Kapasitas 45L · Tarif katalog: 1H 20K / 2H 30K / 3H 40K (+10K/hari)',
      hargaHarian: 20000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-07.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-08',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Eiger 45 L',
      spesifikasi: 'Kapasitas 45L, seri Eiger · Tarif katalog: 1H 30K / 2H 40K / 3H 50K (+10K/hari)',
      hargaHarian: 30000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-08.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-09',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Eiger 35 L & Arei 35+5 L',
      spesifikasi: 'Kapasitas 35L / 35+5L untuk 2D1N · Tarif katalog: 1H 20K / 2H 30K / 3H 40K (+10K/hari)',
      hargaHarian: 20000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-09.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CRR-10',
      kategori: 'Carrier / Tas',
      namaAlat: 'Carrier Zarventure 45 L & 40 L',
      spesifikasi: 'Kapasitas 40L / 45L · Tarif katalog: 1H 15K / 2H 25K / 3H 30K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CRR-10.jpg',
      statusAktif: true,
    },
    // Trekking Gear (10)
    {
      kodeAlat: 'TRK-01',
      kategori: 'Trekking Gear',
      namaAlat: 'Sepatu Gunung Uk. 36-45',
      spesifikasi: 'Ukuran 36-45, sol grip pendakian · Tarif katalog: 1H 25K / 2H 35K / 3H 45K (+10K/hari)',
      hargaHarian: 25000,
      stokTotal: 14,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-01.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-02',
      kategori: 'Trekking Gear',
      namaAlat: 'Jaket Gunung / Gorpcore Uk. S-XL',
      spesifikasi: 'Ukuran S-XL, windproof & water-repellent · Tarif katalog: 1H 15K / 2H 25K / 3H 30K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 14,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-02.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-03',
      kategori: 'Trekking Gear',
      namaAlat: 'Gorpcore Carumby Uk. S-XL',
      spesifikasi: 'Jaket Gorpcore Carumby ukuran S-XL · Tarif katalog: 1H 20K / 2H 30K / 3H 35K (+5K/hari)',
      hargaHarian: 20000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-03.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-04',
      kategori: 'Trekking Gear',
      namaAlat: 'Celana Hiking Uk. S-XL',
      spesifikasi: 'Ukuran S-XL, bahan quick-dry fleksibel · Tarif katalog: 1H 15K / 2H 20K / 3H 25K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-04.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-05',
      kategori: 'Trekking Gear',
      namaAlat: 'Jaket UV Wanita Uk. S-L',
      spesifikasi: 'Ukuran S-L, proteksi UV ringan · Tarif katalog: 1H 15K / 2H 20K / 3H 25K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-05.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-06',
      kategori: 'Trekking Gear',
      namaAlat: 'Trekking Pole',
      spesifikasi: 'Tongkat pendakian telescopic anti-shock · Tarif katalog: 1H 10K / 2H 15K / 3H 18K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 16,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-06.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-07',
      kategori: 'Trekking Gear',
      namaAlat: 'Hydropack',
      spesifikasi: 'Tas lari / trail running vest ringan · Tarif katalog: 1H 15K / 2H 20K / 3H 23K (+3K/hari)',
      hargaHarian: 15000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-07.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-08',
      kategori: 'Trekking Gear',
      namaAlat: 'Day Pack Eiger 20 L & Arei 25 L',
      spesifikasi: 'Kapasitas 20L (Eiger) / 25L (Arei), cocok summit attack · Tarif katalog: 1H 10K / 2H 15K / 3H 20K (+5K/hari)',
      hargaHarian: 10000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-08.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-09',
      kategori: 'Trekking Gear',
      namaAlat: 'Day Pack Eiger 12 L',
      spesifikasi: 'Kapasitas 12L compact ringan · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+2K/hari)',
      hargaHarian: 8000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-09.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'TRK-10',
      kategori: 'Trekking Gear',
      namaAlat: 'Topi Rimba & Topi Biasa',
      spesifikasi: 'Topi rimba bertali / topi lapangan · Tarif katalog: 1H 5K / 2H 8K / 3H 10K (+2K/hari)',
      hargaHarian: 5000,
      stokTotal: 15,
      kondisi: 'Baik',
      foto: '/images/produk/TRK-10.jpg',
      statusAktif: true,
    },
    // Camping Gear (10)
    {
      kodeAlat: 'CMP-01',
      kategori: 'Camping Gear',
      namaAlat: 'Matras Camping',
      spesifikasi: 'Matras gulung spons / insulasi · Tarif katalog: 1H 5K / 2H 7K / 3H 8K (+1K/hari)',
      hargaHarian: 5000,
      stokTotal: 20,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-01.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-02',
      kategori: 'Camping Gear',
      namaAlat: 'Sleeping Bag',
      spesifikasi: 'Sleeping bag hangat + kantong kompresi · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+3K/hari)',
      hargaHarian: 8000,
      stokTotal: 20,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-02.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-03',
      kategori: 'Camping Gear',
      namaAlat: 'Kursi Lipat Speed',
      spesifikasi: 'Kursi lipat camping portable + sarung · Tarif katalog: 1H 10K / 2H 15K / 3H 18K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-03.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-04',
      kategori: 'Camping Gear',
      namaAlat: 'Meja Lipat Besar',
      spesifikasi: 'Meja camping lipat ukuran besar rangka kokoh · Tarif katalog: 1H 20K / 2H 30K / 3H 40K (+10K/hari)',
      hargaHarian: 20000,
      stokTotal: 6,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-04.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-05',
      kategori: 'Camping Gear',
      namaAlat: 'Meja Lipat Uk. XL',
      spesifikasi: 'Meja lipat aluminium ukuran XL · Tarif katalog: 1H 15K / 2H 20K / 3H 25K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-05.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-06',
      kategori: 'Camping Gear',
      namaAlat: 'Meja Lipat Standar',
      spesifikasi: 'Meja lipat camping ukuran standar ringkas · Tarif katalog: 1H 10K / 2H 15K / 3H 18K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-06.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-07',
      kategori: 'Camping Gear',
      namaAlat: 'Flysheet 4 x 6 Meter',
      spesifikasi: 'Flysheet waterproof ukuran 4 x 6 m · Tarif katalog: 1H 15K / 2H 20K / 3H 25K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-07.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-08',
      kategori: 'Camping Gear',
      namaAlat: 'Flysheet 3 x 4 Meter',
      spesifikasi: 'Flysheet waterproof ukuran 3 x 4 m · Tarif katalog: 1H 10K / 2H 15K / 3H 18K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-08.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-09',
      kategori: 'Camping Gear',
      namaAlat: 'Hammock Single Layer',
      spesifikasi: 'Hammock single layer + tali webbing · Tarif katalog: 1H 5K / 2H 8K / 3H 10K (+2K/hari)',
      hargaHarian: 5000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-09.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'CMP-10',
      kategori: 'Camping Gear',
      namaAlat: 'Hammock Double Layer',
      spesifikasi: 'Hammock double layer kuat + tali webbing · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+3K/hari)',
      hargaHarian: 8000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/CMP-10.jpg',
      statusAktif: true,
    },
    // Cooking Set (10)
    {
      kodeAlat: 'COK-01',
      kategori: 'Cooking Set',
      namaAlat: 'Kompor Koper Grill',
      spesifikasi: 'Kompor portable model koper untuk masak & grill · Tarif katalog: 1H 15K / 2H 20K / 3H 25K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/COK-01.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-02',
      kategori: 'Cooking Set',
      namaAlat: 'Kompor Bunga',
      spesifikasi: 'Kompor windproof kelopak pelindung angin · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+3K/hari)',
      hargaHarian: 8000,
      stokTotal: 14,
      kondisi: 'Baik',
      foto: '/images/produk/COK-02.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-03',
      kategori: 'Cooking Set',
      namaAlat: 'Kompor Kotak',
      spesifikasi: 'Kompor lipat mini ultralight · Tarif katalog: 1H 5K / 2H 8K / 3H 10K (+2K/hari)',
      hargaHarian: 5000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/COK-03.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-04',
      kategori: 'Cooking Set',
      namaAlat: 'Nesting Jumbo 5 in 1',
      spesifikasi: 'Set alat masak lengkap 5 in 1 untuk rombongan · Tarif katalog: 1H 15K / 2H 25K / 3H 30K (+5K/hari)',
      hargaHarian: 15000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/COK-04.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-05',
      kategori: 'Cooking Set',
      namaAlat: 'Nesting Standar 3 in 1',
      spesifikasi: 'Panci, wajan, teko aluminium 3 in 1 · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+3K/hari)',
      hargaHarian: 8000,
      stokTotal: 14,
      kondisi: 'Baik',
      foto: '/images/produk/COK-05.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-06',
      kategori: 'Cooking Set',
      namaAlat: 'Nesting Kecil 2 in 1',
      spesifikasi: 'Nesting ringkas 2 in 1 untuk 1-2 orang · Tarif katalog: 1H 5K / 2H 8K / 3H 10K (+2K/hari)',
      hargaHarian: 5000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/COK-06.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-07',
      kategori: 'Cooking Set',
      namaAlat: 'Grill Pan',
      spesifikasi: 'Wajan panggang anti-lengket untuk BBQ camp · Tarif katalog: 1H 10K / 2H 15K / 3H 20K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/COK-07.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-08',
      kategori: 'Cooking Set',
      namaAlat: 'Mug Camping Isi 4 Pcs',
      spesifikasi: 'Set 4 gelas stainless camping + tas jaring · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+3K/hari)',
      hargaHarian: 8000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/COK-08.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-09',
      kategori: 'Cooking Set',
      namaAlat: 'Gas Portabel Isi Ulang',
      spesifikasi: 'Tabung gas kaleng isi ulang (flat Rp 7.000/tabung) · Tarif katalog: 7K',
      hargaHarian: 7000,
      stokTotal: 20,
      kondisi: 'Baik',
      foto: '/images/produk/COK-09.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'COK-10',
      kategori: 'Cooking Set',
      namaAlat: 'Egg Holder / Tempat Telur',
      spesifikasi: 'Wadah pelindung telur anti pecah · Tarif katalog: 1H 3K / 2H 5K / 3H 7K (+2K/hari)',
      hargaHarian: 3000,
      stokTotal: 12,
      kondisi: 'Baik',
      foto: '/images/produk/COK-10.jpg',
      statusAktif: true,
    },
    // Lampu & Acc (8)
    {
      kodeAlat: 'LMP-01',
      kategori: 'Lampu & Acc',
      namaAlat: 'Headlamp / Senter Kepala',
      spesifikasi: 'Full Cas · Senter kepala LED terang · Tarif katalog: 1H 5K / 2H 7K / 3H 8K (+1K/hari)',
      hargaHarian: 5000,
      stokTotal: 20,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-01.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-02',
      kategori: 'Lampu & Acc',
      namaAlat: 'Lampu Tenda Bakpao',
      spesifikasi: 'Full Cas · Lampu gantung tenda model bakpao · Tarif katalog: 1H 5K / 2H 8K / 3H 10K (+2K/hari)',
      hargaHarian: 5000,
      stokTotal: 15,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-02.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-03',
      kategori: 'Lampu & Acc',
      namaAlat: 'Lampu Lentera',
      spesifikasi: 'Full Cas · Lampu lentera camping portable · Tarif katalog: 1H 8K / 2H 12K / 3H 15K (+2K/hari)',
      hargaHarian: 8000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-03.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-04',
      kategori: 'Lampu & Acc',
      namaAlat: 'Lampu String Light',
      spesifikasi: 'Full Cas · Lampu hias tenda gulung · Tarif katalog: 1H 10K / 2H 15K / 3H 18K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-04.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-05',
      kategori: 'Lampu & Acc',
      namaAlat: 'Powerbank 30.000 mAh',
      spesifikasi: 'Full Cas · Kapasitas 30.000 mAh · Tarif katalog: 1H 20K / 2H 25K / 3H 30K (+5K/hari)',
      hargaHarian: 20000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-05.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-06',
      kategori: 'Lampu & Acc',
      namaAlat: 'Powerbank 10.000 mAh',
      spesifikasi: 'Full Cas · Kapasitas 10.000 mAh · Tarif katalog: 1H 10K / 2H 10K / 3H 15K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-06.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-07',
      kategori: 'Lampu & Acc',
      namaAlat: 'Tripod HP Bluetooth',
      spesifikasi: 'Tripod tongsis lipat dengan remote Bluetooth · Tarif katalog: 1H 10K / 2H 15K / 3H 18K (+3K/hari)',
      hargaHarian: 10000,
      stokTotal: 8,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-07.jpg',
      statusAktif: true,
    },
    {
      kodeAlat: 'LMP-08',
      kategori: 'Lampu & Acc',
      namaAlat: 'Tiang Lampu',
      spesifikasi: 'Tiang gantung lampu lipat aluminium · Tarif katalog: 1H 5K / 2H 8K / 3H 10K (+2K/hari)',
      hargaHarian: 5000,
      stokTotal: 10,
      kondisi: 'Baik',
      foto: '/images/produk/LMP-08.jpg',
      statusAktif: true,
    },
  ]

  const alatByCode = new Map<string, { id: number; hargaHarian: number }>()
  for (const item of alatSeed) {
    const [existing] = await db
      .select()
      .from(masterAlat)
      .where(eq(masterAlat.kodeAlat, item.kodeAlat))
      .limit(1)
    if (existing) {
      alatByCode.set(item.kodeAlat, { id: existing.id, hargaHarian: existing.hargaHarian })
    } else {
      const [ins] = await db.insert(masterAlat).values({
        kodeAlat: item.kodeAlat,
        idKategori: catMap.get(item.kategori)!,
        namaAlat: item.namaAlat,
        spesifikasi: item.spesifikasi,
        hargaHarian: item.hargaHarian,
        stokTotal: item.stokTotal,
        kondisi: item.kondisi,
        foto: item.foto,
        statusAktif: item.statusAktif,
      })
      alatByCode.set(item.kodeAlat, { id: Number(ins.insertId), hargaHarian: item.hargaHarian })
    }
  }

  const paketSeed = [
    {
      kodePaket: 'PKT-01',
      namaPaket: 'Paket Pendakian Solo / 2P',
      items: [
        { kode: 'TND-07', jumlah: 1 },
        { kode: 'CRR-05', jumlah: 1 },
        { kode: 'CMP-02', jumlah: 2 },
        { kode: 'CMP-01', jumlah: 2 },
        { kode: 'LMP-01', jumlah: 2 },
      ],
    },
    {
      kodePaket: 'PKT-02',
      namaPaket: 'Paket Camp Rombongan 4P',
      items: [
        { kode: 'TND-04', jumlah: 1 },
        { kode: 'CMP-01', jumlah: 4 },
        { kode: 'COK-02', jumlah: 1 },
        { kode: 'COK-05', jumlah: 1 },
        { kode: 'LMP-02', jumlah: 1 },
      ],
    },
    {
      kodePaket: 'PKT-03',
      namaPaket: 'Paket Tektok Ultralight',
      items: [
        { kode: 'TRK-08', jumlah: 1 },
        { kode: 'TRK-06', jumlah: 2 },
        { kode: 'TRK-02', jumlah: 1 },
        { kode: 'LMP-01', jumlah: 1 },
      ],
    },
  ]

  for (const pkg of paketSeed) {
    const [existing] = await db
      .select()
      .from(paketAlat)
      .where(eq(paketAlat.kodePaket, pkg.kodePaket))
      .limit(1)
    if (!existing) {
      const dailySum = pkg.items.reduce(
        (acc, it) => acc + (alatByCode.get(it.kode)?.hargaHarian ?? 0) * it.jumlah,
        0,
      )
      const [ins] = await db.insert(paketAlat).values({
        kodePaket: pkg.kodePaket,
        namaPaket: pkg.namaPaket,
        diskonPersen: 0,
        tarifPaket: dailySum,
        statusAktif: true,
      })
      const idPaket = Number(ins.insertId)
      for (const it of pkg.items) {
        await db.insert(paketAlatItem).values({
          idPaket,
          idAlat: alatByCode.get(it.kode)!.id,
          jumlah: it.jumlah,
        })
      }
    }
  }

  const penyewaSeed = [
    {
      nama: 'Budi Santoso',
      noIdentitas: '3404071504960002',
      noWa: '081234567890',
      alamat: 'Jl. Kaliurang Km 8, Sinduharjo, Ngaglik, Sleman',
      catatan: 'Sering rombongan pendakian Merbabu',
    },
    {
      nama: 'Rina Aulia',
      noIdentitas: '3471024809980001',
      noWa: '081390221180',
      alamat: 'Kotabaru, Gondokusuman, Yogyakarta',
      catatan: 'Pelanggan rutin akhir pekan',
    },
    {
      nama: 'Dimas Pratama',
      noIdentitas: '3310151203990004',
      noWa: '082188403321',
      alamat: 'Klaten Tengah, Jawa Tengah',
      catatan: null,
    },
    {
      nama: 'Salsa Putri',
      noIdentitas: '3308045506000003',
      noWa: '085641209912',
      alamat: 'Mertoyudan, Magelang',
      catatan: null,
    },
    {
      nama: 'Fajar Nugroho',
      noIdentitas: '3372052101970002',
      noWa: '081977312004',
      alamat: 'Laweyan, Surakarta',
      catatan: null,
    },
  ]

  const penyewaMap = new Map<string, number>()
  for (const cust of penyewaSeed) {
    const [existing] = await db
      .select()
      .from(penyewa)
      .where(eq(penyewa.noIdentitas, cust.noIdentitas))
      .limit(1)
    if (existing) {
      penyewaMap.set(cust.nama, existing.id)
    } else {
      const [ins] = await db.insert(penyewa).values(cust)
      penyewaMap.set(cust.nama, Number(ins.insertId))
    }
  }

  const now = Date.now()
  const hourMs = 3_600_000
  const dayMs = 24 * hourMs

  const txSeed = [
    {
      kodeSewa: 'TRX-0241',
      penyewa: 'Budi Santoso',
      jenisJaminan: 'KTP' as const,
      tanggalPinjam: new Date(now - 5 * dayMs),
      tanggalKembaliRencana: new Date(now - 26 * hourMs),
      tanggalKembaliAktual: null,
      durasiHari: 3,
      statusSewa: 'Terlambat' as const,
      dendaTelat: 32500,
      dendaRusak: 0,
      catatan: 'Pasak lengkap (12 buah), frame alloy dicek di basecamp',
      items: [
        { kode: 'TND-04', jumlah: 1 },
        { kode: 'CMP-01', jumlah: 2 },
        { kode: 'LMP-01', jumlah: 2 },
      ],
    },
    {
      kodeSewa: 'TRX-0240',
      penyewa: 'Rina Aulia',
      jenisJaminan: 'SIM' as const,
      tanggalPinjam: new Date(now - 1 * dayMs),
      tanggalKembaliRencana: new Date(now + 2 * hourMs),
      tanggalKembaliAktual: null,
      durasiHari: 2,
      statusSewa: 'Disewa' as const,
      dendaTelat: 0,
      dendaRusak: 0,
      catatan: 'Rain cover dicek utuh',
      items: [
        { kode: 'CRR-03', jumlah: 2 },
        { kode: 'COK-02', jumlah: 1 },
        { kode: 'COK-05', jumlah: 1 },
      ],
    },
    {
      kodeSewa: 'TRX-0239',
      penyewa: 'Dimas Pratama',
      jenisJaminan: 'Kartu Pelajar' as const,
      tanggalPinjam: new Date(now - 2 * dayMs),
      tanggalKembaliRencana: new Date(now + 2 * dayMs),
      tanggalKembaliAktual: null,
      durasiHari: 4,
      statusSewa: 'Disewa' as const,
      dendaTelat: 0,
      dendaRusak: 0,
      catatan: 'Ambil promo paket 4 hari diskon 15%',
      items: [
        { kode: 'CMP-02', jumlah: 3 },
        { kode: 'TND-07', jumlah: 1 },
        { kode: 'TRK-06', jumlah: 2 },
      ],
    },
    {
      kodeSewa: 'TRX-0238',
      penyewa: 'Salsa Putri',
      jenisJaminan: 'KTP' as const,
      tanggalPinjam: new Date(now - 8 * dayMs),
      tanggalKembaliRencana: new Date(now - 6 * dayMs),
      tanggalKembaliAktual: new Date(now - 6 * dayMs),
      durasiHari: 2,
      statusSewa: 'Selesai' as const,
      dendaTelat: 0,
      dendaRusak: 0,
      catatan: 'Kembali tepat waktu, bersih dan kering',
      items: [
        { kode: 'TND-08', jumlah: 1 },
        { kode: 'TRK-01', jumlah: 1 },
        { kode: 'TRK-08', jumlah: 1 },
      ],
    },
    {
      kodeSewa: 'TRX-0237',
      penyewa: 'Fajar Nugroho',
      jenisJaminan: 'SIM' as const,
      tanggalPinjam: new Date(now - 14 * dayMs),
      tanggalKembaliRencana: new Date(now - 11 * dayMs),
      tanggalKembaliAktual: new Date(now - 11 * dayMs),
      durasiHari: 3,
      statusSewa: 'Selesai' as const,
      dendaTelat: 0,
      dendaRusak: 0,
      catatan: 'Paket 3 hari',
      items: [
        { kode: 'TND-02', jumlah: 1 },
        { kode: 'CRR-05', jumlah: 1 },
        { kode: 'CMP-02', jumlah: 2 },
      ],
    },
  ]

  for (const txData of txSeed) {
    const [existing] = await db
      .select()
      .from(transaksiSewa)
      .where(eq(transaksiSewa.kodeSewa, txData.kodeSewa))
      .limit(1)
    if (!existing) {
      let subtotal = 0
      const resolvedItems = txData.items.map((it) => {
        const ref = alatByCode.get(it.kode)!
        const sub = ref.hargaHarian * it.jumlah * txData.durasiHari
        subtotal += sub
        return { idAlat: ref.id, jumlah: it.jumlah, hargaSatuan: ref.hargaHarian, subtotalItem: sub }
      })
      const diskonNominal =
        txData.durasiHari >= rule.minHariPromo ? Math.round((subtotal * rule.diskonPersen) / 100) : 0
      const totalBiayaSewa = Math.max(0, subtotal - diskonNominal)

      const [ins] = await db.insert(transaksiSewa).values({
        kodeSewa: txData.kodeSewa,
        idPenyewa: penyewaMap.get(txData.penyewa)!,
        idAdmin: admin.id,
        idPengaturan: rule.id,
        jenisJaminan: txData.jenisJaminan,
        tanggalPinjam: txData.tanggalPinjam,
        tanggalKembaliRencana: txData.tanggalKembaliRencana,
        tanggalKembaliAktual: txData.tanggalKembaliAktual,
        durasiHari: txData.durasiHari,
        subtotal,
        diskonNominal,
        totalBiayaSewa,
        dendaTelat: txData.dendaTelat,
        dendaRusak: txData.dendaRusak,
        statusSewa: txData.statusSewa,
        catatan: txData.catatan,
      })
      const idSewa = Number(ins.insertId)
      for (const line of resolvedItems) {
        await db.insert(detailSewa).values({
          idSewa,
          idAlat: line.idAlat,
          jumlah: line.jumlah,
          hargaSatuan: line.hargaSatuan,
          subtotalItem: line.subtotalItem,
          kondisiKembali: txData.statusSewa === 'Selesai' ? 'Baik' : null,
        })
      }
    }
  }

  const tripSeed = [
    {
      kodeTrip: 'TRIP-001',
      judul: 'Gunung Prau via Patak Banteng',
      lokasi: 'Dieng, Jawa Tengah',
      tanggalBerangkat: '5-7 Des 2026',
      durasi: '2 Hari 1 Malam (2D1N)',
      kuota: 20,
      itinerary:
        '02:30 Registrasi basecamp & mulai pendakian Patak Banteng. 05:15 Sunrise Bukit Teletubbies dan sarapan hangat.',
      statusPublish: 'Published' as const,
      pakets: [
        { kodePaket: 'Paket A', deskripsiFasilitas: 'Reguler (Tanpa Alat)', harga: 350000 },
        { kodePaket: 'Paket B', deskripsiFasilitas: 'Standar (+ Tenda & Matras)', harga: 450000 },
        { kodePaket: 'Paket C', deskripsiFasilitas: 'VIP (Full Gear + Porter)', harga: 625000 },
      ],
      mepos: [
        { namaLokasi: 'Jakarta - Halim', isCustom: false },
        { namaLokasi: 'Terminal Mendolo Wonosobo', isCustom: false },
        { namaLokasi: 'Basecamp Wates / Patak Banteng / Dieng (Prau)', isCustom: false },
        { namaLokasi: 'Lainnya (atur lokasi sendiri)', isCustom: true },
      ],
    },
    {
      kodeTrip: 'TRIP-002',
      judul: 'Merbabu via Selo (2D1N)',
      lokasi: 'Boyolali, Jawa Tengah',
      tanggalBerangkat: '12-14 Des 2026',
      durasi: '2 Hari 1 Malam (2D1N)',
      kuota: 20,
      itinerary: '08:00 Briefing basecamp Selo. 15:00 Camp Sabana 1. 04:00 Summit Kenteng Songo.',
      statusPublish: 'Published' as const,
      pakets: [
        { kodePaket: 'Paket A', deskripsiFasilitas: 'Reguler (Tanpa Alat)', harga: 420000 },
        { kodePaket: 'Paket B', deskripsiFasilitas: 'Standar (+ Tenda & Matras)', harga: 525000 },
        { kodePaket: 'Paket C', deskripsiFasilitas: 'VIP (Full Gear + Dokumentasi)', harga: 690000 },
      ],
      mepos: [
        { namaLokasi: 'Basecamp Merayau Sleman', isCustom: false },
        { namaLokasi: 'Basecamp Selo Boyolali', isCustom: false },
        { namaLokasi: 'Lainnya (atur lokasi sendiri)', isCustom: true },
      ],
    },
    {
      kodeTrip: 'TRIP-003',
      judul: 'Gunung Lawu via Cetho',
      lokasi: 'Karanganyar, Jawa Tengah',
      tanggalBerangkat: '26-28 Des 2026',
      durasi: '2 Hari 1 Malam (2D1N)',
      kuota: 15,
      itinerary: '09:00 Registrasi Cetho. 16:00 Camp Gupak Menjangan. 04:30 Summit Hargo Dumilah.',
      statusPublish: 'Draft' as const,
      pakets: [
        { kodePaket: 'Paket A', deskripsiFasilitas: 'Reguler (Tanpa Alat)', harga: 440000 },
        { kodePaket: 'Paket B', deskripsiFasilitas: 'Standar (+ Tenda & Matras)', harga: 550000 },
      ],
      mepos: [
        { namaLokasi: 'Basecamp Merayau Sleman', isCustom: false },
        { namaLokasi: 'Candi Cetho Karanganyar', isCustom: false },
      ],
    },
  ]

  let prauTripId = 0
  for (const t of tripSeed) {
    const [existing] = await db.select().from(infoTrip).where(eq(infoTrip.kodeTrip, t.kodeTrip)).limit(1)
    let tripId = existing?.id
    if (!tripId) {
      const [ins] = await db.insert(infoTrip).values({
        kodeTrip: t.kodeTrip,
        judul: t.judul,
        lokasi: t.lokasi,
        tanggalBerangkat: t.tanggalBerangkat,
        durasi: t.durasi,
        kuota: t.kuota,
        itinerary: t.itinerary,
        statusPublish: t.statusPublish,
        idAdmin: admin.id,
      })
      tripId = Number(ins.insertId)
      for (const p of t.pakets) {
        await db.insert(tripPaket).values({ idTrip: tripId, ...p })
      }
      for (let i = 0; i < t.mepos.length; i++) {
        await db.insert(tripMeetingPoint).values({ idTrip: tripId, ...t.mepos[i]!, urutan: i })
      }
    }
    if (t.kodeTrip === 'TRIP-001') prauTripId = tripId
  }

  if (prauTripId) {
    const [pesertaCountRow] = await db
      .select({ total: count() })
      .from(pesertaTrip)
      .where(eq(pesertaTrip.idTrip, prauTripId))
    if (Number(pesertaCountRow?.total ?? 0) === 0) {
      const pakets = await db.select().from(tripPaket).where(eq(tripPaket.idTrip, prauTripId))
      const mepos = await db
        .select()
        .from(tripMeetingPoint)
        .where(eq(tripMeetingPoint.idTrip, prauTripId))
      const pktB = pakets.find((p) => p.kodePaket === 'Paket B') || pakets[0]
      const pktC = pakets.find((p) => p.kodePaket === 'Paket C') || pakets[0]
      const mepoHalim = mepos.find((m) => m.namaLokasi.includes('Halim')) || mepos[0]
      const mepoMendolo = mepos.find((m) => m.namaLokasi.includes('Mendolo')) || mepos[0]
      const mepoPrau = mepos.find((m) => m.namaLokasi.includes('Patak')) || mepos[0]
      const mepoCustomRow = mepos.find((m) => m.isCustom) || mepos[0]

      await db.insert(pesertaTrip).values([
        {
          idTrip: prauTripId,
          idTripPaket: pktB?.id ?? null,
          idMeetingPoint: mepoHalim?.id ?? null,
          nama: 'Raka Pratama',
          noIdentitas: '3404081205980001',
          noWa: '081288341102',
          kontakDarurat: 'Ibu (0813-2201-9910)',
          statusBayar: 'Lunas',
          nominalBayar: 450000,
          sewaAlatTambahan: 'SB Polar, Trekking Pole',
        },
        {
          idTrip: prauTripId,
          idTripPaket: pktC?.id ?? null,
          idMeetingPoint: mepoMendolo?.id ?? null,
          nama: 'Nadia Kusuma',
          noIdentitas: '3471056208990003',
          noWa: '085643197720',
          kontakDarurat: 'Kakak (0811-2540-882)',
          statusBayar: 'Lunas',
          nominalBayar: 625000,
          sewaAlatTambahan: null,
        },
        {
          idTrip: prauTripId,
          idTripPaket: pktB?.id ?? null,
          idMeetingPoint: mepoPrau?.id ?? null,
          nama: 'Bagas Adi',
          noIdentitas: '3402120901970002',
          noWa: '082133904451',
          kontakDarurat: 'Ayah (0815-7800-1204)',
          statusBayar: 'DP 50%',
          nominalBayar: 225000,
          sewaAlatTambahan: 'Headlamp Rechargeable',
        },
        {
          idTrip: prauTripId,
          idTripPaket: pktB?.id ?? null,
          idMeetingPoint: mepoCustomRow?.id ?? null,
          mepoCustom: 'Rest Area KM 250 Pejagan',
          nama: 'Ilham Ramadhan',
          noIdentitas: '3372011803960004',
          noWa: '081904228190',
          kontakDarurat: 'Adik (0857-4012-3390)',
          statusBayar: 'DP 50%',
          nominalBayar: 225000,
          sewaAlatTambahan: 'Carrier 60L',
        },
        {
          idTrip: prauTripId,
          idTripPaket: pktB?.id ?? null,
          idMeetingPoint: mepoPrau?.id ?? null,
          nama: 'Putri Maharani',
          noIdentitas: '3308116704010002',
          noWa: '085290185532',
          kontakDarurat: 'Ibu (0813-2800-7712)',
          statusBayar: 'Belum Bayar',
          nominalBayar: 0,
          sewaAlatTambahan: null,
        },
      ])
    }
  }

  console.log('Seed selesai untuk Merayau Outdoor Admin.')
}

main()
  .catch((err) => {
    console.error('Seed gagal:', err)
    process.exit(1)
  })
  .finally(async () => {
    await closeDb()
  })

