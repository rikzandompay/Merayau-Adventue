import { asc, desc, eq, sql } from 'drizzle-orm'
import {
  infoTrip,
  kategoriAlat,
  masterAlat,
  paketAlat,
  paketAlatItem,
  pesertaTrip,
  tripMeetingPoint,
  tripPaket,
} from '../../database/schema'

const SHOWCASE_GEAR_CODES = new Set([
  'TND-01',
  'CRR-01',
  'TND-07',
  'TRK-01',
  'COK-01',
  'LMP-05',
])

const PRODUK_IMG_VERSION = 'hd3'

const TRIP_FALLBACK_PHOTOS = [
  '/images/landing/trip-prau.png',
  '/images/landing/trip-merbabu.png',
  '/images/landing/trip-lawu.png',
]

function resolveGearPhoto(kodeAlat: string, foto: string | null): { url: string; isShowcase: boolean } {
  const clean = (foto ?? '').trim()
  const code = kodeAlat.toUpperCase()
  const baseUrl = clean || `/images/produk/${code}.jpg`
  const url = baseUrl.startsWith('/images/produk/')
    ? `${baseUrl}?v=${PRODUK_IMG_VERSION}`
    : baseUrl
  const isShowcase =
    clean.startsWith('/uploads/') ||
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    SHOWCASE_GEAR_CODES.has(code)
  return { url, isShowcase }
}

function resolveTripPhoto(
  foto: string | null | undefined,
  judul: string,
  detailGallery: string[] | undefined,
  idx: number,
): string {
  const main = foto?.trim()
  if (main) return main
  const first = detailGallery?.find((g) => Boolean(g?.trim()))?.trim()
  if (first) return first
  const lower = judul.toLowerCase()
  if (lower.includes('prau')) return '/images/landing/trip-prau.png'
  if (lower.includes('merbabu')) return '/images/landing/trip-merbabu.png'
  if (lower.includes('lawu')) return '/images/landing/trip-lawu.png'
  return TRIP_FALLBACK_PHOTOS[idx % TRIP_FALLBACK_PHOTOS.length] ?? '/images/landing/trip-prau.png'
}

function formatTierNote(
  spesifikasi: string | null,
  hargaHarian: number,
  minHariPromo: number,
  diskonPersen: number,
): string {
  const match = (spesifikasi ?? '').match(/Tarif katalog:\s*([^|\n]+)/i)
  if (match?.[1]) {
    return match[1].trim()
  }
  const day2 = Math.round((hargaHarian * 2) / 1000)
  return `2H ${day2}rb · ${minHariPromo}H -${diskonPersen}%`
}

export default defineEventHandler(async () => {
  const db = useDb()

  const [
    alatRows,
    catRows,
    pkgRows,
    pkgItemRows,
    tripRows,
    tripPaketRows,
    tripMepoRows,
    pesertaCounts,
    rentedMap,
    settingRow,
    enabledPromos,
  ] = await Promise.all([
    db
      .select({
        id: masterAlat.id,
        kodeAlat: masterAlat.kodeAlat,
        idKategori: masterAlat.idKategori,
        namaKategori: kategoriAlat.namaKategori,
        namaAlat: masterAlat.namaAlat,
        spesifikasi: masterAlat.spesifikasi,
        hargaHarian: masterAlat.hargaHarian,
        stokTotal: masterAlat.stokTotal,
        kondisi: masterAlat.kondisi,
        foto: masterAlat.foto,
        statusAktif: masterAlat.statusAktif,
      })
      .from(masterAlat)
      .innerJoin(kategoriAlat, eq(masterAlat.idKategori, kategoriAlat.id))
      .orderBy(asc(masterAlat.kodeAlat)),
    db.select().from(kategoriAlat).orderBy(asc(kategoriAlat.namaKategori)),
    db.select().from(paketAlat).orderBy(asc(paketAlat.id)),
    db
      .select({
        idPaket: paketAlatItem.idPaket,
        idAlat: paketAlatItem.idAlat,
        jumlah: paketAlatItem.jumlah,
        kodeAlat: masterAlat.kodeAlat,
        namaAlat: masterAlat.namaAlat,
        hargaHarian: masterAlat.hargaHarian,
        stokTotal: masterAlat.stokTotal,
        namaKategori: kategoriAlat.namaKategori,
      })
      .from(paketAlatItem)
      .innerJoin(masterAlat, eq(paketAlatItem.idAlat, masterAlat.id))
      .innerJoin(kategoriAlat, eq(masterAlat.idKategori, kategoriAlat.id)),
    db.select().from(infoTrip).orderBy(desc(infoTrip.id)),
    db.select().from(tripPaket).orderBy(asc(tripPaket.harga), asc(tripPaket.kodePaket)),
    db.select().from(tripMeetingPoint).orderBy(asc(tripMeetingPoint.urutan), asc(tripMeetingPoint.id)),
    db
      .select({
        idTrip: pesertaTrip.idTrip,
        total: sql<number>`COUNT(${pesertaTrip.id})`,
      })
      .from(pesertaTrip)
      .groupBy(pesertaTrip.idTrip),
    getActiveRentedMap(db),
    getDefaultSetting(db),
    getEnabledPromos(db),
  ])

  const now = new Date()
  const livePromos = enabledPromos.filter((p) => isPromoLive(p, now))

  const aturan = {
    durasiMinimalJam: settingRow?.durasiMinimalJam ?? 24,
    toleransiTelatJam: settingRow?.toleransiTelatJam ?? 2,
    dendaPersenHarian: settingRow?.dendaPersenHarian ?? 30,
    minHariPromo: settingRow?.minHariPromo ?? 3,
    diskonPersen: settingRow?.diskonPersen ?? 10,
  }

  const availMap = new Map<number, number>()
  const activeAlat = alatRows
    .filter((r) => r.statusAktif)
    .map((r) => {
      const stokDisewa = rentedMap.get(r.id) ?? 0
      const stokTersedia = Math.max(0, r.stokTotal - stokDisewa)
      availMap.set(r.id, stokTersedia)
      const resolved = resolveGearPhoto(r.kodeAlat, r.foto)
      const { hargaEfektif, promoAktif } = resolveBestPromoForAlat(
        { id: r.id, idKategori: r.idKategori, hargaHarian: r.hargaHarian },
        livePromos,
      )
      const upcomingPromo = promoAktif
        ? null
        : resolveUpcomingPromoForAlat({ id: r.id, idKategori: r.idKategori }, enabledPromos, now)
      return {
        id: r.id,
        kodeAlat: r.kodeAlat,
        idKategori: r.idKategori,
        namaKategori: r.namaKategori,
        namaAlat: r.namaAlat,
        spesifikasi: (r.spesifikasi ?? '').trim(),
        hargaHarian: r.hargaHarian,
        hargaEfektif,
        promoAktif,
        upcomingPromo,
        stokTotal: r.stokTotal,
        stokDisewa,
        stokTersedia,
        kondisi: r.kondisi,
        fotoUrl: resolved.url,
        isShowcase: resolved.isShowcase,
        tarifNote: formatTierNote(r.spesifikasi, r.hargaHarian, aturan.minHariPromo, aturan.diskonPersen),
      }
    })

  const categoryCountMap = new Map<number, number>()
  for (const item of activeAlat) {
    categoryCountMap.set(item.idKategori, (categoryCountMap.get(item.idKategori) ?? 0) + 1)
  }
  const categories = catRows.map((c) => ({
    id: c.id,
    namaKategori: c.namaKategori,
    jumlahAlat: categoryCountMap.get(c.id) ?? 0,
  }))

  const pkgItemsByPkg = new Map<number, typeof pkgItemRows>()
  for (const row of pkgItemRows) {
    const list = pkgItemsByPkg.get(row.idPaket) ?? []
    list.push(row)
    pkgItemsByPkg.set(row.idPaket, list)
  }

  const packages = pkgRows
    .filter((p) => p.statusAktif)
    .map((pkg) => {
      const rawItems = pkgItemsByPkg.get(pkg.id) ?? []
      const items = rawItems.map((it) => {
        const stokTersedia = Math.max(0, it.stokTotal - (rentedMap.get(it.idAlat) ?? 0))
        return {
          idAlat: it.idAlat,
          kodeAlat: it.kodeAlat,
          namaAlat: it.namaAlat,
          namaKategori: it.namaKategori,
          jumlah: it.jumlah,
          hargaHarian: it.hargaHarian,
          stokTersedia,
        }
      })
      const totalNormal = items.reduce((sum, it) => sum + it.hargaHarian * it.jumlah, 0)
      const tarifPaket = pkg.tarifPaket
      const { hargaEfektif, promoAktif } = resolveBestPromoForPaket(
        { id: pkg.id, tarifPaket },
        livePromos,
      )
      const upcomingPromo = promoAktif
        ? null
        : resolveUpcomingPromoForPaket({ id: pkg.id }, enabledPromos, now)
      const kuotaTersedia = computePackageQuota(items, availMap)
      const fotoClean = (pkg.foto ?? '').trim()
      return {
        id: pkg.id,
        namaPaket: pkg.namaPaket,
        tipePaket: pkg.tipePaket,
        deskripsi: pkg.deskripsi ?? '',
        labelPromo: pkg.labelPromo ?? '',
        diskonPersen: pkg.diskonPersen,
        totalNormal,
        tarifPaket,
        hargaEfektif,
        promoAktif,
        upcomingPromo,
        kuotaTersedia,
        fotoUrl: fotoClean || '/images/landing/paket-tektok.png',
        items,
      }
    })

  const pesertaCountMap = new Map(pesertaCounts.map((c) => [c.idTrip, Number(c.total)]))
  const trips = tripRows
    .filter((t) => t.statusPublish !== 'Draft')
    .map((t, idx) => {
      const { detailJson, ...base } = t
      const detail = parseTripDetail(detailJson)
      const pakets = tripPaketRows.filter((p) => p.idTrip === t.id)
      const meetingPoints = tripMepoRows.filter((m) => m.idTrip === t.id)
      const pesertaCount = pesertaCountMap.get(t.id) ?? 0
      const sisaKuota = Math.max(0, t.kuota - pesertaCount)
      const hargaMulai = pakets.length ? Math.min(...pakets.map((p) => p.harga)) : 0
      const fotoUrl = resolveTripPhoto(t.foto, t.judul, detail.gallery, idx)

      return {
        ...base,
        detail,
        pakets,
        meetingPoints,
        pesertaCount,
        sisaKuota,
        hargaMulai,
        fotoUrl,
      }
    })

  const totalStokUnit = activeAlat.reduce((sum, a) => sum + a.stokTotal, 0)
  const hargaPaketMulai = packages.length
    ? Math.min(...packages.map((p) => p.hargaEfektif))
    : 0
  const activePromos = livePromos.map((p) => ({
    id: p.id,
    namaPromo: p.namaPromo,
    label: formatPromoBadgeLabel(p),
    targetTipe: p.targetTipe,
    targetId: p.targetId,
    tipePotongan: p.tipePotongan,
    nilaiPotongan: p.nilaiPotongan,
    tanggalSelesai: p.tanggalSelesai,
  }))
  const promos = enabledPromos.map((p) => ({
    id: p.id,
    namaPromo: p.namaPromo,
    label: formatPromoBadgeLabel(p),
    targetTipe: p.targetTipe,
    targetId: p.targetId,
    tipePotongan: p.tipePotongan,
    nilaiPotongan: p.nilaiPotongan,
    tanggalMulai: p.tanggalMulai,
    tanggalSelesai: p.tanggalSelesai,
    statusBerjalan: getPromoRuntimeStatus(p, now),
  }))

  return {
    alat: activeAlat,
    categories,
    packages,
    activePromos,
    promos,
    trips,
    aturan,
    stats: {
      totalAlatAktif: activeAlat.length,
      totalStokUnit,
      totalKategori: categories.filter((c) => c.jumlahAlat > 0).length,
      diskonPromoPersen: aturan.diskonPersen,
      minHariPromo: aturan.minHariPromo,
      hargaPaketMulai,
    },
    kontak: {
      whatsapp: '6285156549003',
      whatsappDisplay: '+62 851-5654-9003',
      email: 'admin@merayau.id',
      alamat:
        'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b (gang tepat di samping Mr. DIY Tanray 2), Pontianak, Kalimantan Barat',
      alamatSingkat: 'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b, Pontianak',
      mapsUrl:
        'https://www.google.com/maps/search/?api=1&query=Jl.+Tanjung+Raya+2+Gg.+Nusa+Abadi+No.+22b+Pontianak',
      jamBuka: 'Setiap Hari · 08.00 - 21.00 WIB',
    },
  }
})
