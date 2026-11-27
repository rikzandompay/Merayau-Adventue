import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { detailSewa, pengaturanSewa, transaksiSewa } from '../../../../database/schema'

const returnSchema = z.object({
  tanggalKembaliAktual: z.string().optional(),
  dendaRusak: z.coerce.number().int().min(0).max(50_000_000).default(0),
  kondisiKembali: z.string().trim().min(1).max(120).default('Baik & Lengkap'),
  catatan: z.string().trim().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, returnSchema)
  const actualReturn = body.tanggalKembaliAktual ? new Date(body.tanggalKembaliAktual) : new Date()
  if (Number.isNaN(actualReturn.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Format tanggal kembali aktual tidak valid.' })
  }

  const db = useDb()
  const updated = await db.transaction(async (tx) => {
    const [rental] = await tx
      .select()
      .from(transaksiSewa)
      .where(eq(transaksiSewa.id, id))
      .limit(1)
      .for('update')

    if (!rental) {
      throw createError({ statusCode: 404, statusMessage: 'Transaksi sewa tidak ditemukan.' })
    }
    if (rental.statusSewa === 'Selesai') {
      throw createError({ statusCode: 409, statusMessage: 'Transaksi ini sudah diselesaikan sebelumnya.' })
    }

    const [[rule], items] = await Promise.all([
      tx
        .select()
        .from(pengaturanSewa)
        .where(eq(pengaturanSewa.id, rental.idPengaturan))
        .limit(1),
      tx.select().from(detailSewa).where(eq(detailSewa.idSewa, id)),
    ])

    const dailyTotal = items.reduce((acc, it) => acc + it.hargaSatuan * it.jumlah, 0)
    const lateInfo = computeLatePenalty(
      new Date(rental.tanggalKembaliRencana),
      actualReturn,
      rule?.toleransiTelatJam ?? 2,
      dailyTotal,
      rule?.dendaPersenHarian ?? 50,
    )

    await tx
      .update(transaksiSewa)
      .set({
        tanggalKembaliAktual: actualReturn,
        dendaTelat: lateInfo.dendaTelat,
        dendaRusak: body.dendaRusak,
        statusSewa: 'Selesai',
        catatan: body.catatan === undefined ? rental.catatan : body.catatan,
      })
      .where(eq(transaksiSewa.id, id))

    await tx
      .update(detailSewa)
      .set({ kondisiKembali: body.kondisiKembali })
      .where(eq(detailSewa.idSewa, id))

    await recordRiwayatPenyewa(tx, id, body.kondisiKembali)

    const [row] = await tx.select().from(transaksiSewa).where(eq(transaksiSewa.id, id)).limit(1)
    return row
  })

  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.transaksi_returned',
    severity: 'info',
    targetType: 'transaksi_sewa',
    targetId: id,
    metadata: {
      dendaTelat: updated?.dendaTelat,
      dendaRusak: updated?.dendaRusak,
    },
  })

  return updated
})

