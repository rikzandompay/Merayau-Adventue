import { eq } from 'drizzle-orm'
import { penyewa } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  try {
    const [existing] = await db.select().from(penyewa).where(eq(penyewa.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Penyewa tidak ditemukan.' })
    }
    await db.delete(penyewa).where(eq(penyewa.id, id))
    return { ok: true }
  } catch (err) {
    rethrowDbConflict(
      err,
      'Duplikat.',
      'Penyewa memiliki riwayat transaksi sewa dan tidak dapat dihapus.',
    )
  }
})

