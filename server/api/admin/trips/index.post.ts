import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { infoTrip, tripMeetingPoint, tripPaket } from '../../../database/schema'

const tripSchema = z.object({
  kodeTrip: z.string().trim().min(2).max(40).optional(),
  judul: z.string().trim().min(3).max(180),
  lokasi: z.string().trim().min(2).max(120),
  tanggalBerangkat: z.string().trim().max(80).optional().default('Jadwal Fleksibel'),
  durasi: z.string().trim().min(1).max(60).default('2D1N'),
  kuota: z.coerce.number().int().min(1).max(500).default(20),
  foto: z.string().trim().max(500).nullable().optional(),
  itinerary: z.string().trim().max(5000).optional(),
  detail: tripDetailSchema.optional(),
  statusPublish: z.enum(['Published', 'Draft', 'Penuh']).default('Draft'),
  pakets: z
    .array(
      z.object({
        kodePaket: z.string().trim().min(1).max(30),
        deskripsiFasilitas: z.string().trim().min(1).max(160),
        harga: z.coerce.number().int().min(1000).max(50_000_000),
      }),
    )
    .min(1, 'Minimal 1 paket harga trip wajib diisi.'),
  meetingPoints: z
    .array(
      z.object({
        namaLokasi: z.string().trim().min(2).max(180),
        isCustom: z.boolean().default(false),
      }),
    )
    .min(1, 'Minimal 1 pilihan meeting point wajib diisi.'),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, tripSchema)
  const db = useDb()
  const adminId = event.context.admin?.id as number

  try {
    const tripId = await db.transaction(async (tx) => {
      const kodeTrip = body.kodeTrip?.toUpperCase() || `TRIP-${Date.now().toString().slice(-4)}`
      const itineraryText = body.itinerary?.trim() || summarizeItineraryText(body.detail)
      const [ins] = await tx.insert(infoTrip).values({
        kodeTrip,
        judul: body.judul,
        lokasi: body.lokasi,
        tanggalBerangkat: body.tanggalBerangkat || 'Jadwal Fleksibel',
        durasi: body.durasi,
        kuota: body.kuota,
        foto: body.foto || null,
        itinerary: itineraryText,
        detailJson: body.detail ? JSON.stringify(body.detail) : null,
        statusPublish: body.statusPublish,
        idAdmin: adminId,
      })
      const idTrip = Number(ins.insertId)

      await tx.insert(tripPaket).values(body.pakets.map((p) => ({ ...p, idTrip })))
      await tx.insert(tripMeetingPoint).values(
        body.meetingPoints.map((m, idx) => ({
          idTrip,
          namaLokasi: m.namaLokasi,
          isCustom: m.isCustom,
          urutan: idx,
        })),
      )

      return idTrip
    })

    const [created] = await db.select().from(infoTrip).where(eq(infoTrip.id, tripId)).limit(1)
    setResponseStatus(event, 201)
    return created
  } catch (err) {
    rethrowDbConflict(err, 'Kode trip atau kode paket dalam satu trip terduplikasi.')
  }
})

