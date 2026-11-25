import { asc, eq } from 'drizzle-orm'
import { kategoriAlat, masterAlat } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const query = getQuery(event)
  const kategoriId = query.kategoriId ? Number(query.kategoriId) : null
  const search = String(query.search || '').trim().toLowerCase()

  const [rows, categories, rentedMap, livePromos] = await Promise.all([
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
    getActiveRentedMap(db),
    getLivePromos(db),
  ])

  const enriched = rows.map((r) => {
    const stokDisewa = rentedMap.get(r.id) ?? 0
    const { hargaEfektif, promoAktif } = resolveBestPromoForAlat(
      { id: r.id, idKategori: r.idKategori, hargaHarian: r.hargaHarian },
      livePromos,
    )
    return {
      ...r,
      stokDisewa,
      stokTersedia: Math.max(0, r.stokTotal - stokDisewa),
      hargaEfektif,
      promoAktif,
    }
  })

  const filtered = enriched.filter((r) => {
    if (kategoriId && r.idKategori !== kategoriId) return false
    if (
      search &&
      !r.namaAlat.toLowerCase().includes(search) &&
      !r.kodeAlat.toLowerCase().includes(search)
    ) {
      return false
    }
    return true
  })

  return { items: filtered, categories, allCount: enriched.length }
})

