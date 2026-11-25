import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { pesertaTrip } from '../../../database/schema'

const updatePesertaSchema = z.object({
  nama: z.string().trim().min(2).max(120).optional(),
  noWa: z.string().trim().min(8).max(30).optional(),
  kontakDarurat: z.string().trim().min(3).max(160).optional(),
  idTripPaket: z.coerce.number().int().positive().nullable().optional(),
  idMeetingPoint: z.coerce.number().int().positive().nullable().optional(),
  mepoCustom: z.string().trim().max(180).nullable().optional(),
  statusBayar: z.enum(['Lunas', 'DP 50%', 'Belum Bayar']),
  nominalBayar: z.coerce.number().int().min(0).max(50_000_000),
  sewaAlatTambahan: z.string().trim().max(200).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updatePesertaSchema)
  const db = useDb()

  const [existing] = await db.select().from(pesertaTrip).where(eq(pesertaTrip.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Peserta trip tidak ditemukan.' })
  }

  await db
    .update(pesertaTrip)
    .set({
      nama: body.nama ?? existing.nama,
      noWa: body.noWa ?? existing.noWa,
      kontakDarurat: body.kontakDarurat ?? existing.kontakDarurat,
      idTripPaket: body.idTripPaket === undefined ? existing.idTripPaket : body.idTripPaket,
      idMeetingPoint:
        body.idMeetingPoint === undefined ? existing.idMeetingPoint : body.idMeetingPoint,
      mepoCustom: body.mepoCustom === undefined ? existing.mepoCustom : body.mepoCustom,
      statusBayar: body.statusBayar,
      nominalBayar: body.nominalBayar,
      sewaAlatTambahan:
        body.sewaAlatTambahan === undefined ? existing.sewaAlatTambahan : body.sewaAlatTambahan,
    })
    .where(eq(pesertaTrip.id, id))

  const [updated] = await db.select().from(pesertaTrip).where(eq(pesertaTrip.id, id)).limit(1)
  return updated
})

