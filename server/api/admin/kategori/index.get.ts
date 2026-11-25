import { asc, eq, sql } from 'drizzle-orm'
import { kategoriAlat, masterAlat } from '../../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const rows = await db
    .select({
      id: kategoriAlat.id,
      namaKategori: kategoriAlat.namaKategori,
      jumlahAlat: sql<number>`COALESCE(COUNT(${masterAlat.id}), 0)`,
    })
    .from(kategoriAlat)
    .leftJoin(masterAlat, eq(masterAlat.idKategori, kategoriAlat.id))
    .groupBy(kategoriAlat.id)
    .orderBy(asc(kategoriAlat.namaKategori))

  return rows.map((r) => ({ ...r, jumlahAlat: Number(r.jumlahAlat) }))
})

