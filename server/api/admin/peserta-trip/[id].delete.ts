import { count, eq } from 'drizzle-orm'
import { infoTrip, pesertaTrip } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()

  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(pesertaTrip).where(eq(pesertaTrip.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Peserta trip tidak ditemukan.' })
    }

    const [trip] = await tx
      .select()
      .from(infoTrip)
      .where(eq(infoTrip.id, existing.idTrip))
      .limit(1)
      .for('update')

    await tx.delete(pesertaTrip).where(eq(pesertaTrip.id, id))

    if (trip && trip.statusPublish === 'Penuh') {
      const [cntRow] = await tx
        .select({ total: count() })
        .from(pesertaTrip)
        .where(eq(pesertaTrip.idTrip, trip.id))
      if (Number(cntRow?.total ?? 0) < trip.kuota) {
        await tx.update(infoTrip).set({ statusPublish: 'Published' }).where(eq(infoTrip.id, trip.id))
      }
    }
  })

  return { ok: true }
})

