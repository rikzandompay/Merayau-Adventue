import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { pengaturanSewa, transaksiSewa } from '../../../database/schema'

const updateSewaSchema = z.object({
  jenisJaminan: z.enum(['KTP', 'SIM', 'Kartu Pelajar']).optional(),
  tanggalKembaliRencana: z.string().min(1).optional(),
  statusSewa: z.enum(['Disewa', 'Terlambat', 'Selesai']).optional(),
  dendaTelat: z.coerce.number().int().min(0).max(50_000_000).optional(),
  dendaRusak: z.coerce.number().int().min(0).max(50_000_000).optional(),
})

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const body = await parseValidatedBody(event, updateSewaSchema)
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

    let nextDue = new Date(rental.tanggalKembaliRencana)
    let nextDurasi = rental.durasiHari
    if (body.tanggalKembaliRencana) {
      const parsedDue = new Date(body.tanggalKembaliRencana)
      if (Number.isNaN(parsedDue.getTime()) || parsedDue <= new Date(rental.tanggalPinjam)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tanggal rencana kembali harus lebih besar dari tanggal pinjam.',
        })
      }
      const [rule] = await tx
        .select()
        .from(pengaturanSewa)
        .where(eq(pengaturanSewa.id, rental.idPengaturan))
        .limit(1)
      nextDue = parsedDue
      nextDurasi = computeDurationDays(
        new Date(rental.tanggalPinjam),
        nextDue,
        rule?.durasiDasarJam ?? 24,
      )
    }

    const nextStatus = body.statusSewa ?? rental.statusSewa
    const nextActualReturn =
      nextStatus === 'Selesai'
        ? rental.tanggalKembaliAktual ?? new Date()
        : null

    await tx
      .update(transaksiSewa)
      .set({
        jenisJaminan: body.jenisJaminan ?? rental.jenisJaminan,
        tanggalKembaliRencana: nextDue,
        durasiHari: nextDurasi,
        statusSewa: nextStatus,
        tanggalKembaliAktual: nextActualReturn,
        dendaTelat: body.dendaTelat ?? rental.dendaTelat,
        dendaRusak: body.dendaRusak ?? rental.dendaRusak,
      })
      .where(eq(transaksiSewa.id, id))

    if (nextStatus === 'Selesai') {
      await recordRiwayatPenyewa(tx, id)
    } else if (rental.statusSewa === 'Selesai') {
      await removeRiwayatPenyewaBySewa(tx, id)
    }

    const [row] = await tx.select().from(transaksiSewa).where(eq(transaksiSewa.id, id)).limit(1)
    return row
  })

  return updated
})

