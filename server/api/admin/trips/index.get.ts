import { asc, desc, sql } from 'drizzle-orm'
import { infoTrip, pesertaTrip, tripMeetingPoint, tripPaket } from '../../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  const [trips, pakets, mepos, pesertaCounts] = await Promise.all([
    db.select().from(infoTrip).orderBy(desc(infoTrip.id)),
    db.select().from(tripPaket).orderBy(asc(tripPaket.kodePaket)),
    db.select().from(tripMeetingPoint).orderBy(asc(tripMeetingPoint.urutan), asc(tripMeetingPoint.id)),
    db
      .select({
        idTrip: pesertaTrip.idTrip,
        total: sql<number>`COUNT(${pesertaTrip.id})`,
      })
      .from(pesertaTrip)
      .groupBy(pesertaTrip.idTrip),
  ])

  const countMap = new Map(pesertaCounts.map((c) => [c.idTrip, Number(c.total)]))
  const items = trips.map((t) => {
    const { detailJson, ...tripBase } = t
    const tripPakets = pakets.filter((p) => p.idTrip === t.id)
    const tripMepos = mepos.filter((m) => m.idTrip === t.id)
    const hargaMulai = tripPakets.length ? Math.min(...tripPakets.map((p) => p.harga)) : 0
    return {
      ...tripBase,
      detail: parseTripDetail(detailJson),
      pakets: tripPakets,
      meetingPoints: tripMepos,
      pesertaCount: countMap.get(t.id) ?? 0,
      hargaMulai,
    }
  })

  const publishedCount = items.filter((t) => t.statusPublish === 'Published').length
  const draftCount = items.filter((t) => t.statusPublish === 'Draft').length
  const totalPeserta = items.reduce((acc, t) => acc + t.pesertaCount, 0)
  const totalKapasitas = items.reduce((acc, t) => acc + t.kuota, 0)

  return {
    trips: items,
    kpis: { publishedCount, draftCount, totalPeserta, totalKapasitas },
  }
})

