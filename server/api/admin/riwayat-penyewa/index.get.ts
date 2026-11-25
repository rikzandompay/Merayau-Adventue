import { desc } from 'drizzle-orm'
import { riwayatPenyewa } from '../../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const items = await db
    .select()
    .from(riwayatPenyewa)
    .orderBy(desc(riwayatPenyewa.tanggalKembaliAktual), desc(riwayatPenyewa.id))

  const kpis = {
    totalRiwayat: items.length,
    totalNominal: items.reduce((acc, r) => acc + r.totalAkhir, 0),
    tepatWaktu: items.filter((r) => r.statusKetepatan === 'Tepat Waktu').length,
    terlambat: items.filter((r) => r.statusKetepatan === 'Terlambat').length,
  }

  return { items, kpis }
})

