import { asc, eq } from 'drizzle-orm'
import { kategoriAlat, masterAlat, paketAlat, paketAlatItem } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const query = getQuery(event)
  const tipeFilter =
    query.tipe === 'paket' || query.tipe === 'bundle' ? query.tipe : null

  const pkgQuery = tipeFilter
    ? db
        .select()
        .from(paketAlat)
        .where(eq(paketAlat.tipePaket, tipeFilter))
        .orderBy(asc(paketAlat.id))
    : db.select().from(paketAlat).orderBy(asc(paketAlat.id))

  const [packages, itemRows, rentedMap, livePromos] = await Promise.all([
    pkgQuery,
    db
      .select({
        idPaket: paketAlatItem.idPaket,
        idAlat: paketAlatItem.idAlat,
        jumlah: paketAlatItem.jumlah,
        kodeAlat: masterAlat.kodeAlat,
        namaAlat: masterAlat.namaAlat,
        hargaHarian: masterAlat.hargaHarian,
        stokTotal: masterAlat.stokTotal,
        idKategori: masterAlat.idKategori,
        namaKategori: kategoriAlat.namaKategori,
      })
      .from(paketAlatItem)
      .innerJoin(masterAlat, eq(paketAlatItem.idAlat, masterAlat.id))
      .innerJoin(kategoriAlat, eq(masterAlat.idKategori, kategoriAlat.id)),
    getActiveRentedMap(db),
    getLivePromos(db),
  ])

  const itemsByPkg = new Map<number, typeof itemRows>()
  for (const row of itemRows) {
    const list = itemsByPkg.get(row.idPaket) ?? []
    list.push(row)
    itemsByPkg.set(row.idPaket, list)
  }

  return packages.map((pkg) => {
    const rawItems = itemsByPkg.get(pkg.id) ?? []
    const availMap = new Map<number, number>()
    const items = rawItems.map((it) => {
      const disewa = rentedMap.get(it.idAlat) ?? 0
      const stokTersedia = Math.max(0, it.stokTotal - disewa)
      availMap.set(it.idAlat, stokTersedia)
      return { ...it, stokDisewa: disewa, stokTersedia }
    })

    const totalNormal = items.reduce((acc, it) => acc + it.hargaHarian * it.jumlah, 0)
    const tarifPaket = pkg.tarifPaket
    const { hargaEfektif, promoAktif } = resolveBestPromoForPaket(
      { id: pkg.id, tarifPaket },
      livePromos,
    )
    const kuotaTersedia = computePackageQuota(items, availMap)

    return {
      ...pkg,
      deskripsi: pkg.deskripsi ?? '',
      labelPromo: pkg.labelPromo ?? '',
      totalNormal,
      tarifPaket,
      hargaEfektif,
      promoAktif,
      kuotaTersedia,
      items,
    }
  })
})

