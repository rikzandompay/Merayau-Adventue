import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { promoDiskon } from '../../../database/schema'

const promoSchema = z.object({
  namaPromo: z.string().trim().min(2, 'Nama promo minimal 2 karakter.').max(120),
  labelBadge: z.string().trim().max(60).nullable().optional(),
  targetTipe: z.enum(['semua_alat', 'kategori', 'alat', 'paket']),
  targetId: z.coerce.number().int().positive().nullable().optional(),
  tipePotongan: z.enum(['persen', 'nominal']).default('persen'),
  nilaiPotongan: z.coerce.number().int().min(1, 'Nilai potongan wajib lebih dari 0.'),
  tanggalMulai: z.string().trim().nullable().optional(),
  tanggalSelesai: z.string().trim().nullable().optional(),
  statusAktif: z.boolean().default(true),
})

function parseOptionalDate(val: string | null | undefined, label: string): Date | null {
  const clean = (val ?? '').trim()
  if (!clean) return null
  const d = new Date(clean)
  if (Number.isNaN(d.getTime())) {
    throw createError({ statusCode: 400, statusMessage: `${label} tidak valid.` })
  }
  return d
}

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, promoSchema)

  if (body.targetTipe !== 'semua_alat' && !body.targetId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pilih target kategori, alat, atau paket/bundle yang didiskon.',
    })
  }
  if (body.tipePotongan === 'persen' && (body.nilaiPotongan < 1 || body.nilaiPotongan > 95)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Potongan persen harus antara 1% sampai 95%.',
    })
  }
  if (body.tipePotongan === 'nominal' && body.nilaiPotongan < 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Potongan nominal minimal Rp 100.',
    })
  }

  const tanggalMulai = parseOptionalDate(body.tanggalMulai, 'Tanggal mulai')
  const tanggalSelesai = parseOptionalDate(body.tanggalSelesai, 'Tanggal selesai')
  if (tanggalMulai && tanggalSelesai && tanggalSelesai < tanggalMulai) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tanggal selesai harus setelah tanggal mulai.',
    })
  }

  const db = useDb()
  const [ins] = await db.insert(promoDiskon).values({
    namaPromo: body.namaPromo,
    labelBadge: body.labelBadge || null,
    targetTipe: body.targetTipe,
    targetId: body.targetTipe === 'semua_alat' ? null : (body.targetId ?? null),
    tipePotongan: body.tipePotongan,
    nilaiPotongan: body.nilaiPotongan,
    tanggalMulai,
    tanggalSelesai,
    statusAktif: body.statusAktif,
  })

  const [created] = await db
    .select()
    .from(promoDiskon)
    .where(eq(promoDiskon.id, Number(ins.insertId)))
    .limit(1)

  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.promo_created',
    severity: 'info',
    targetType: 'promo_diskon',
    targetId: created?.id,
    metadata: {
      namaPromo: body.namaPromo,
      tipePotongan: body.tipePotongan,
      nilaiPotongan: body.nilaiPotongan,
    },
  })

  setResponseStatus(event, 201)
  return created
})

