import { eq } from 'drizzle-orm'
import { transaksiSewa } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  const [existing] = await db
    .select({ id: transaksiSewa.id })
    .from(transaksiSewa)
    .where(eq(transaksiSewa.id, id))
    .limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Transaksi sewa tidak ditemukan.' })
  }

  // detail_sewa rows cascade on delete, freeing rented stock automatically.
  await db.delete(transaksiSewa).where(eq(transaksiSewa.id, id))
  return { ok: true }
})

