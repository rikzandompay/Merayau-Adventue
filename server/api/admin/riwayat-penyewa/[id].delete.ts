import { eq } from 'drizzle-orm'
import { riwayatPenyewa } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  const [existing] = await db
    .select({ id: riwayatPenyewa.id })
    .from(riwayatPenyewa)
    .where(eq(riwayatPenyewa.id, id))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Data riwayat penyewa tidak ditemukan.' })
  }

  await db.delete(riwayatPenyewa).where(eq(riwayatPenyewa.id, id))
  return { ok: true }
})

