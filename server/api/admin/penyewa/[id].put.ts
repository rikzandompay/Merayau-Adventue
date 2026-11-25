import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { penyewa } from '../../../database/schema'

const schema = z.object({
  nama: z.string().trim().min(2).max(120),
  noIdentitas: z.string().trim().min(5).max(60),
  noWa: z.string().trim().min(8).max(30),
  alamat: z.string().trim().min(3).max(500),
  catatan: z.string().trim().max(500).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, schema)
  const db = useDb()
  try {
    const [existing] = await db.select().from(penyewa).where(eq(penyewa.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Penyewa tidak ditemukan.' })
    }
    await db
      .update(penyewa)
      .set({
        nama: body.nama,
        noIdentitas: body.noIdentitas,
        noWa: body.noWa,
        alamat: body.alamat,
        catatan: body.catatan || null,
      })
      .where(eq(penyewa.id, id))
    const [updated] = await db.select().from(penyewa).where(eq(penyewa.id, id)).limit(1)
    return updated
  } catch (err) {
    rethrowDbConflict(err, 'Nomor identitas sudah dipakai penyewa lain.')
  }
})

