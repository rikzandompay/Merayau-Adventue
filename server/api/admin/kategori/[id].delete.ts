import { eq } from 'drizzle-orm'
import { kategoriAlat } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  try {
    const [existing] = await db.select().from(kategoriAlat).where(eq(kategoriAlat.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Kategori tidak ditemukan.' })
    }
    await db.delete(kategoriAlat).where(eq(kategoriAlat.id, id))
    return { ok: true }
  } catch (err) {
    rethrowDbConflict(
      err,
      'Duplikat data.',
      'Kategori masih dipakai oleh alat di Master Alat dan tidak dapat dihapus.',
    )
  }
})

