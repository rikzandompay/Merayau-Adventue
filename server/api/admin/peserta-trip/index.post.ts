import { count, eq } from 'drizzle-orm'
import { z } from 'zod'
import {
  infoTrip,
  pesertaTrip,
  tripMeetingPoint,
  tripPaket,
} from '../../../database/schema'

const createPesertaSchema = z.object({
  idTrip: z.coerce.number().int().positive(),
  idTripPaket: z.coerce.number().int().positive().nullable().optional(),
  idMeetingPoint: z.coerce.number().int().positive().nullable().optional(),
  mepoCustom: z.string().trim().max(180).nullable().optional(),
  nama: z.string().trim().min(2).max(120),
  noIdentitas: z.string().trim().min(5).max(60),
  noWa: z.string().trim().min(8).max(30),
  kontakDarurat: z.string().trim().min(3).max(160),
  statusBayar: z.enum(['Lunas', 'DP 50%', 'Belum Bayar']).default('Belum Bayar'),
  nominalBayar: z.coerce.number().int().min(0).max(50_000_000).default(0),
  sewaAlatTambahan: z.string().trim().max(200).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, createPesertaSchema)
  const db = useDb()

  const created = await db.transaction(async (tx) => {
    const [trip] = await tx
      .select()
      .from(infoTrip)
      .where(eq(infoTrip.id, body.idTrip))
      .limit(1)
      .for('update')

    if (!trip) {
      throw createError({ statusCode: 404, statusMessage: 'Jadwal trip tidak ditemukan.' })
    }

    const [cntRow] = await tx
      .select({ total: count() })
      .from(pesertaTrip)
      .where(eq(pesertaTrip.idTrip, trip.id))
    const currentCount = Number(cntRow?.total ?? 0)
    if (currentCount >= trip.kuota) {
      throw createError({ statusCode: 409, statusMessage: 'Kuota trip sudah penuh.' })
    }

    if (body.idTripPaket) {
      const [pkg] = await tx
        .select()
        .from(tripPaket)
        .where(eq(tripPaket.id, body.idTripPaket))
        .limit(1)
      if (!pkg || pkg.idTrip !== trip.id) {
        throw createError({ statusCode: 400, statusMessage: 'Paket trip tidak sesuai jadwal.' })
      }
    }

    if (body.idMeetingPoint) {
      const [mepo] = await tx
        .select()
        .from(tripMeetingPoint)
        .where(eq(tripMeetingPoint.id, body.idMeetingPoint))
        .limit(1)
      if (!mepo || mepo.idTrip !== trip.id) {
        throw createError({ statusCode: 400, statusMessage: 'Meeting point tidak sesuai jadwal.' })
      }
      if (mepo.isCustom && !body.mepoCustom?.trim()) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tuliskan lokasi titik kumpul custom saat memilih opsi Lainnya.',
        })
      }
    }

    const [ins] = await tx.insert(pesertaTrip).values({
      idTrip: trip.id,
      idTripPaket: body.idTripPaket ?? null,
      idMeetingPoint: body.idMeetingPoint ?? null,
      mepoCustom: body.mepoCustom?.trim() || null,
      nama: body.nama,
      noIdentitas: body.noIdentitas,
      noWa: body.noWa,
      kontakDarurat: body.kontakDarurat,
      statusBayar: body.statusBayar,
      nominalBayar: body.nominalBayar,
      sewaAlatTambahan: body.sewaAlatTambahan?.trim() || null,
    })

    if (currentCount + 1 >= trip.kuota && trip.statusPublish === 'Published') {
      await tx.update(infoTrip).set({ statusPublish: 'Penuh' }).where(eq(infoTrip.id, trip.id))
    }

    const [row] = await tx
      .select()
      .from(pesertaTrip)
      .where(eq(pesertaTrip.id, Number(ins.insertId)))
      .limit(1)
    return row
  })

  setResponseStatus(event, 201)
  return created
})

