import { eq } from 'drizzle-orm'
import { pesertaTrip } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  const [existing] = await db.select().from(pesertaTrip).where(eq(pesertaTrip.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Peserta trip tidak ditemukan.' })
  }
  await db.delete(pesertaTrip).where(eq(pesertaTrip.id, id))
  return { ok: true }
})

