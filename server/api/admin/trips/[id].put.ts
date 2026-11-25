import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { infoTrip, tripMeetingPoint, tripPaket } from '../../../database/schema'

const fullUpdateTripSchema = z.object({
  judul: z.string().trim().min(3).max(180),
  lokasi: z.string().trim().min(2).max(120),
  tanggalBerangkat: z.string().trim().max(80).optional().default('Jadwal Fleksibel'),
  durasi: z.string().trim().min(1).max(60).default('2D1N'),
  kuota: z.coerce.number().int().min(1).max(500).default(20),
  foto: z.string().trim().max(500).nullable().optional(),
  itinerary: z.string().trim().max(5000).optional(),
  detail: tripDetailSchema.optional(),
  statusPublish: z.enum(['Published', 'Draft', 'Penuh']),
  pakets: z
    .array(
      z.object({
        kodePaket: z.string().trim().min(1).max(30),
        deskripsiFasilitas: z.string().trim().min(1).max(160),
        harga: z.coerce.number().int().min(1000).max(50_000_000),
      }),
    )
    .min(1),
  meetingPoints: z
    .array(
      z.object({
        namaLokasi: z.string().trim().min(2).max(180),
        isCustom: z.boolean().default(false),
      }),
    )
    .min(1),
})

const statusOnlyTripSchema = z
  .object({
    statusPublish: z.enum(['Published', 'Draft', 'Penuh']),
  })
  .strict()

const updateTripSchema = z.union([fullUpdateTripSchema, statusOnlyTripSchema])

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updateTripSchema)
  const db = useDb()

  try {
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(infoTrip).where(eq(infoTrip.id, id)).limit(1)
      if (!existing) {
        throw createError({ statusCode: 404, statusMessage: 'Data trip tidak ditemukan.' })
      }

      if (!('judul' in body)) {
        await tx
          .update(infoTrip)
          .set({ statusPublish: body.statusPublish })
          .where(eq(infoTrip.id, id))
        const [row] = await tx.select().from(infoTrip).where(eq(infoTrip.id, id)).limit(1)
        return row
      }

      const itineraryText =
        body.itinerary?.trim() || summarizeItineraryText(body.detail, existing.itinerary)
      const detailJsonValue =
        body.detail === undefined
          ? existing.detailJson
          : body.detail
            ? JSON.stringify(body.detail)
            : null

      await tx
        .update(infoTrip)
        .set({
          judul: body.judul,
          lokasi: body.lokasi,
          tanggalBerangkat: body.tanggalBerangkat || existing.tanggalBerangkat,
          durasi: body.durasi,
          kuota: body.kuota,
          foto: body.foto === undefined ? existing.foto : body.foto,
          itinerary: itineraryText,
          detailJson: detailJsonValue,
          statusPublish: body.statusPublish,
        })
        .where(eq(infoTrip.id, id))

      await tx.delete(tripPaket).where(eq(tripPaket.idTrip, id))
      await tx.insert(tripPaket).values(body.pakets.map((p) => ({ ...p, idTrip: id })))

      await tx.delete(tripMeetingPoint).where(eq(tripMeetingPoint.idTrip, id))
      await tx.insert(tripMeetingPoint).values(
        body.meetingPoints.map((m, idx) => ({
          idTrip: id,
          namaLokasi: m.namaLokasi,
          isCustom: m.isCustom,
          urutan: idx,
        })),
      )

      const [row] = await tx.select().from(infoTrip).where(eq(infoTrip.id, id)).limit(1)
      return row
    })
    return updated
  } catch (err) {
    rethrowDbConflict(err, 'Kode paket tidak boleh ganda pada trip yang sama.')
  }
})

