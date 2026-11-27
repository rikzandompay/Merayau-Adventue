import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { kategoriAlat, masterAlat } from '../../../database/schema'

const createAlatSchema = z.object({
  kodeAlat: z.string().trim().min(2).max(40),
  idKategori: z.coerce.number().int().positive(),
  namaAlat: z.string().trim().min(2).max(150),
  spesifikasi: z.string().trim().min(1).max(1000).default('-'),
  hargaHarian: z.coerce.number().int().min(1000).max(50_000_000),
  stokTotal: z.coerce.number().int().min(0).max(10_000),
  kondisi: z.string().trim().min(2).max(60).default('Baik'),
  foto: safeOptionalImageUrlSchema(255),
  statusAktif: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, createAlatSchema)
  const db = useDb()
  const [cat] = await db
    .select()
    .from(kategoriAlat)
    .where(eq(kategoriAlat.id, body.idKategori))
    .limit(1)
  if (!cat) {
    throw createError({ statusCode: 400, statusMessage: 'Kategori tidak ditemukan.' })
  }

  try {
    const [res] = await db.insert(masterAlat).values({
      kodeAlat: body.kodeAlat.toUpperCase(),
      idKategori: body.idKategori,
      namaAlat: body.namaAlat,
      spesifikasi: body.spesifikasi,
      hargaHarian: body.hargaHarian,
      stokTotal: body.stokTotal,
      kondisi: body.kondisi,
      foto: body.foto || null,
      statusAktif: body.statusAktif,
    })
    const [created] = await db
      .select()
      .from(masterAlat)
      .where(eq(masterAlat.id, Number(res.insertId)))
      .limit(1)
    invalidateChatbotSnapshotCache()
    setResponseStatus(event, 201)
    return { ...created, namaKategori: cat.namaKategori, stokDisewa: 0, stokTersedia: created!.stokTotal }
  } catch (err) {
    rethrowDbConflict(err, 'Kode alat sudah digunakan.')
  }
})

