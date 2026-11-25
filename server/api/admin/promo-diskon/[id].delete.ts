import { eq } from 'drizzle-orm'
import { promoDiskon } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()

  const [existing] = await db.select().from(promoDiskon).where(eq(promoDiskon.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Promo diskon tidak ditemukan.' })
  }

  await db.delete(promoDiskon).where(eq(promoDiskon.id, id))
  return { ok: true }
})

