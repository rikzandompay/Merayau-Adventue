import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { masterAlat, paketAlat, paketAlatItem } from '../../../database/schema'

const updatePaketSchema = z.object({
  namaPaket: z.string().trim().min(2).max(150).optional(),
  tipePaket: z.enum(['paket', 'bundle']).optional(),
  deskripsi: z.string().trim().max(500).nullable().optional(),
  labelPromo: z.string().trim().max(60).nullable().optional(),
  foto: z.string().trim().max(255).nullable().optional(),
  diskonPersen: z.coerce.number().int().min(0).max(95).optional(),
  tarifPaket: z.coerce.number().int().min(1, 'Tarif paket wajib diisi lebih dari 0.').max(100_000_000).optional(),
  statusAktif: z.boolean().optional(),
  items: z
    .array(
      z.object({
        idAlat: z.coerce.number().int().positive(),
        jumlah: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1)
    .optional(),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updatePaketSchema)
  const db = useDb()

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(paketAlat).where(eq(paketAlat.id, id)).limit(1)
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Paket alat tidak ditemukan.' })
    }

    const nextTarif = body.tarifPaket ?? existing.tarifPaket
    if (body.items) {
      const mergedItems = new Map<number, number>()
      for (const item of body.items) {
        mergedItems.set(item.idAlat, (mergedItems.get(item.idAlat) ?? 0) + item.jumlah)
      }
      const uniqueIds = [...mergedItems.keys()]
      const alatRows = await tx.select().from(masterAlat).where(inArray(masterAlat.id, uniqueIds))
      if (alatRows.length !== uniqueIds.length) {
        throw createError({ statusCode: 400, statusMessage: 'Sebagian alat tidak ditemukan.' })
      }

      await tx.delete(paketAlatItem).where(eq(paketAlatItem.idPaket, id))
      await tx.insert(paketAlatItem).values(
        uniqueIds.map((idAlat) => ({
          idPaket: id,
          idAlat,
          jumlah: mergedItems.get(idAlat)!,
        })),
      )
    }

    await tx
      .update(paketAlat)
      .set({
        namaPaket: body.namaPaket ?? existing.namaPaket,
        tipePaket: body.tipePaket ?? existing.tipePaket,
        deskripsi: body.deskripsi === undefined ? existing.deskripsi : (body.deskripsi || null),
        labelPromo: body.labelPromo === undefined ? existing.labelPromo : (body.labelPromo || null),
        foto: body.foto === undefined ? existing.foto : body.foto,
        statusAktif: body.statusAktif ?? existing.statusAktif,
        diskonPersen: body.diskonPersen ?? existing.diskonPersen,
        tarifPaket: nextTarif,
      })
      .where(eq(paketAlat.id, id))

    const [row] = await tx.select().from(paketAlat).where(eq(paketAlat.id, id)).limit(1)
    return row
  })

  return updated
})

