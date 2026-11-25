import { asc, desc } from 'drizzle-orm'
import { kategoriAlat, masterAlat, paketAlat, promoDiskon } from '../../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const [promos, categories, tools, packages] = await Promise.all([
    db.select().from(promoDiskon).orderBy(desc(promoDiskon.id)),
    db.select().from(kategoriAlat).orderBy(asc(kategoriAlat.namaKategori)),
    db
      .select({ id: masterAlat.id, kodeAlat: masterAlat.kodeAlat, namaAlat: masterAlat.namaAlat })
      .from(masterAlat)
      .orderBy(asc(masterAlat.kodeAlat)),
    db
      .select({
        id: paketAlat.id,
        kodePaket: paketAlat.kodePaket,
        namaPaket: paketAlat.namaPaket,
        tipePaket: paketAlat.tipePaket,
      })
      .from(paketAlat)
      .orderBy(asc(paketAlat.id)),
  ])

  const catMap = new Map(categories.map((c) => [c.id, c.namaKategori]))
  const alatMap = new Map(tools.map((t) => [t.id, `${t.kodeAlat} · ${t.namaAlat}`]))
  const paketMap = new Map(
    packages.map((p) => [p.id, `${p.tipePaket === 'bundle' ? '[Bundle]' : '[Paket]'} ${p.namaPaket}`]),
  )

  const now = new Date()
  return promos.map((p) => {
    let targetNama = 'Semua Alat Satuan'
    if (p.targetTipe === 'kategori') {
      targetNama = `Kategori: ${catMap.get(p.targetId ?? 0) ?? '-'}`
    } else if (p.targetTipe === 'alat') {
      targetNama = `Alat: ${alatMap.get(p.targetId ?? 0) ?? '-'}`
    } else if (p.targetTipe === 'paket') {
      targetNama = paketMap.get(p.targetId ?? 0) ?? 'Paket/Bundle'
    }

    return {
      ...p,
      targetNama,
      statusBerjalan: getPromoRuntimeStatus(p, now),
    }
  })
})

