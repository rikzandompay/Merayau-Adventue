import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { masterAlat, paketAlat, paketAlatItem } from '../../../database/schema'

const paketPayloadSchema = z.object({
  kodePaket: z.string().trim().min(2).max(40).optional(),
  namaPaket: z.string().trim().min(2).max(150),
  tipePaket: z.enum(['paket', 'bundle']).default('paket'),
  deskripsi: z.string().trim().max(500).nullable().optional(),
  labelPromo: z.string().trim().max(60).nullable().optional(),
  foto: z.string().trim().max(255).nullable().optional(),
  diskonPersen: z.coerce.number().int().min(0).max(95).default(0),
  tarifPaket: z.coerce.number().int().min(1, 'Tarif paket wajib diisi lebih dari 0.').max(100_000_000),
  statusAktif: z.boolean().default(true),
  items: z
    .array(
      z.object({
        idAlat: z.coerce.number().int().positive(),
        jumlah: z.coerce.number().int().min(1).max(100),
      }),
    )
    .min(1, 'Pilih minimal 1 alat dalam paket.'),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, paketPayloadSchema)
  const db = useDb()

  const mergedItems = new Map<number, number>()
  for (const item of body.items) {
    mergedItems.set(item.idAlat, (mergedItems.get(item.idAlat) ?? 0) + item.jumlah)
  }
  const uniqueIds = [...mergedItems.keys()]

  try {
    const createdId = await db.transaction(async (tx) => {
      const alatRows = await tx.select().from(masterAlat).where(inArray(masterAlat.id, uniqueIds))
      if (alatRows.length !== uniqueIds.length) {
        throw createError({ statusCode: 400, statusMessage: 'Sebagian alat tidak ditemukan.' })
      }

      const prefix = body.tipePaket === 'bundle' ? 'BND' : 'PKT'
      const kodePaket =
        body.kodePaket?.toUpperCase() || `${prefix}-${Date.now().toString().slice(-5)}`

      const [res] = await tx.insert(paketAlat).values({
        kodePaket,
        namaPaket: body.namaPaket,
        tipePaket: body.tipePaket,
        deskripsi: body.deskripsi || null,
        labelPromo: body.labelPromo || null,
        foto: body.foto || null,
        diskonPersen: body.diskonPersen,
        tarifPaket: body.tarifPaket,
        statusAktif: body.statusAktif,
      })
      const idPaket = Number(res.insertId)

      await tx.insert(paketAlatItem).values(
        uniqueIds.map((idAlat) => ({
          idPaket,
          idAlat,
          jumlah: mergedItems.get(idAlat)!,
        })),
      )

      return idPaket
    })

    const [created] = await db.select().from(paketAlat).where(eq(paketAlat.id, createdId)).limit(1)
    setResponseStatus(event, 201)
    return created
  } catch (err) {
    rethrowDbConflict(err, 'Kode paket sudah digunakan.')
  }
})

