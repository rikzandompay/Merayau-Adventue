import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { promoDiskon } from '../../../database/schema'

const updatePromoSchema = z.object({
  namaPromo: z.string().trim().min(2).max(120).optional(),
  labelBadge: z.string().trim().max(60).nullable().optional(),
  targetTipe: z.enum(['semua_alat', 'kategori', 'alat', 'paket']).optional(),
  targetId: z.coerce.number().int().positive().nullable().optional(),
  tipePotongan: z.enum(['persen', 'nominal']).optional(),
  nilaiPotongan: z.coerce.number().int().min(1).optional(),
  tanggalMulai: z.string().trim().nullable().optional(),
  tanggalSelesai: z.string().trim().nullable().optional(),
  statusAktif: z.boolean().optional(),
})

function parseDatePatch(
  raw: string | null | undefined,
  fallback: Date | null,
  label: string,
): Date | null {
  if (raw === undefined) return fallback
  const clean = (raw ?? '').trim()
  if (!clean) return null
  const d = new Date(clean)
  if (Number.isNaN(d.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `${label} tidak valid.` })
  }
  return d
}

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updatePromoSchema)
  const db = useDb()

  const [existing] = await db.select().from(promoDiskon).where(eq(promoDiskon.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Promo diskon tidak ditemukan.' })
  }

  const nextTargetTipe = body.targetTipe ?? existing.targetTipe
  const nextTargetId =
    nextTargetTipe === 'semua_alat'
      ? null
      : (body.targetId === undefined ? existing.targetId : body.targetId)

  if (nextTargetTipe !== 'semua_alat' && !nextTargetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pilih target kategori, alat, atau paket/bundle yang didiskon.',
    })
  }

  const nextTipePotongan = body.tipePotongan ?? existing.tipePotongan
  const nextNilai = body.nilaiPotongan ?? existing.nilaiPotongan
  if (nextTipePotongan === 'persen' && (nextNilai < 1 || nextNilai > 95)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Potongan persen harus antara 1% sampai 95%.',
    })
  }
  if (nextTipePotongan === 'nominal' && nextNilai < 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Potongan nominal minimal Rp 100.',
    })
  }

  const nextStart = parseDatePatch(body.tanggalMulai, existing.tanggalMulai, 'Tanggal mulai')
  const nextEnd = parseDatePatch(body.tanggalSelesai, existing.tanggalSelesai, 'Tanggal selesai')
  if (nextStart && nextEnd && nextEnd < nextStart) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tanggal selesai harus setelah tanggal mulai.',
    })
  }

  await db
    .update(promoDiskon)
    .set({
      namaPromo: body.namaPromo ?? existing.namaPromo,
      labelBadge: body.labelBadge === undefined ? existing.labelBadge : (body.labelBadge || null),
      targetTipe: nextTargetTipe,
      targetId: nextTargetId,
      tipePotongan: nextTipePotongan,
      nilaiPotongan: nextNilai,
      tanggalMulai: nextStart,
      tanggalSelesai: nextEnd,
      statusAktif: body.statusAktif ?? existing.statusAktif,
    })
    .where(eq(promoDiskon.id, id))

  const [updated] = await db.select().from(promoDiskon).where(eq(promoDiskon.id, id)).limit(1)
  return updated
})

