import { asc } from 'drizzle-orm'
import { penyewa, transaksiSewa } from '../../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const [customers, rentals] = await Promise.all([
    db.select().from(penyewa).orderBy(asc(penyewa.nama)),
    db
      .select({
        id: transaksiSewa.id,
        idPenyewa: transaksiSewa.idPenyewa,
        statusSewa: transaksiSewa.statusSewa,
      })
      .from(transaksiSewa),
  ])

  const rentalsByPenyewa = new Map<number, Array<(typeof rentals)[number]>>()
  for (const r of rentals) {
    const list = rentalsByPenyewa.get(r.idPenyewa) ?? []
    list.push(r)
    rentalsByPenyewa.set(r.idPenyewa, list)
  }

  return customers.map((c) => {
    const rows = rentalsByPenyewa.get(c.id) ?? []
    const telatCount = rows.filter((r) => r.statusSewa === 'Terlambat').length
    const disewaCount = rows.filter((r) => r.statusSewa === 'Disewa').length
    const standing = telatCount > 0 ? 'Telat Aktif' : disewaCount > 0 ? 'Sedang Sewa' : 'Tepat Waktu'
    return {
      ...c,
      totalTransaksi: rows.length,
      telatCount,
      disewaCount,
      standing,
    }
  })
})
