import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { masterAlat } from '../../../database/schema'

const updateAlatSchema = z.object({
  idKategori: z.coerce.number().int().positive().optional(),
  namaAlat: z.string().trim().min(2).max(150),
  spesifikasi: z.string().trim().min(1).max(1000).optional(),
  hargaHarian: z.coerce.number().int().min(1000).max(50_000_000),
  stokTotal: z.coerce.number().int().min(0).max(10_000),
  kondisi: z.string().trim().min(2).max(60).optional(),
  foto: safeOptionalImageUrlSchema(255),
  statusAktif: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updateAlatSchema)
  const db = useDb()

  const [existing] = await db.select().from(masterAlat).where(eq(masterAlat.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Alat tidak ditemukan.' })
  }

  const rentedMap = await getActiveRentedMap(db, [id])
  const activeRented = rentedMap.get(id) ?? 0
  if (body.stokTotal < activeRented) {
    throw createError({
      statusCode: 409,
      statusMessage: `Stok total tidak boleh kurang dari unit yang sedang disewa (${activeRented} unit).`,
    })
  }

  await db
    .update(masterAlat)
    .set({
      idKategori: body.idKategori ?? existing.idKategori,
      namaAlat: body.namaAlat,
      spesifikasi: body.spesifikasi ?? existing.spesifikasi,
      hargaHarian: body.hargaHarian,
      stokTotal: body.stokTotal,
      kondisi: body.kondisi ?? existing.kondisi,
      foto: body.foto === undefined ? existing.foto : body.foto,
      statusAktif: body.statusAktif,
    })
    .where(eq(masterAlat.id, id))

  const [updated] = await db.select().from(masterAlat).where(eq(masterAlat.id, id)).limit(1)
  invalidateChatbotSnapshotCache()
  return {
    ...updated,
    stokDisewa: activeRented,
    stokTersedia: Math.max(0, updated!.stokTotal - activeRented),
  }
})

