import { count, eq } from 'drizzle-orm'
import { infoTrip, pesertaTrip } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  const [existing] = await db.select().from(infoTrip).where(eq(infoTrip.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Data trip tidak ditemukan.' })
  }

  const [refs] = await db
    .select({ total: count() })
    .from(pesertaTrip)
    .where(eq(pesertaTrip.idTrip, id))
  if (Number(refs?.total ?? 0) > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Trip sudah memiliki peserta terdaftar dan tidak dapat dihapus.',
    })
  }

  await db.delete(infoTrip).where(eq(infoTrip.id, id))
  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.trip_deleted',
    severity: 'warn',
    targetType: 'info_trip',
    targetId: id,
    metadata: { kodeTrip: existing.kodeTrip, judul: existing.judul },
  })
  return { ok: true }
})

