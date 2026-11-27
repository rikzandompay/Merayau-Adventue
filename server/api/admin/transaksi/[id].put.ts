import { asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  detailSewa,
  masterAlat,
  pengaturanSewa,
  transaksiSewa,
} from '../../../database/schema'

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

    const [rule] = await tx
      .select()
      .from(pengaturanSewa)
      .where(eq(pengaturanSewa.id, rental.idPengaturan))
      .limit(1)

    const items = await tx.select().from(detailSewa).where(eq(detailSewa.idSewa, id))

    let nextDue = new Date(rental.tanggalKembaliRencana)
    let nextDurasi = rental.durasiHari
    let nextSubtotal = rental.subtotal
    let nextDiskon = rental.diskonNominal
    let nextTotalBiaya = rental.totalBiayaSewa

    if (body.tanggalKembaliRencana) {
      const parsedDue = new Date(body.tanggalKembaliRencana)
      if (Number.isNaN(parsedDue.getTime()) || parsedDue <= new Date(rental.tanggalPinjam)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Tanggal rencana kembali harus lebih besar dari tanggal pinjam.',
        })
      }
      nextDue = parsedDue
      nextDurasi = computeDurationDays(
        new Date(rental.tanggalPinjam),
        nextDue,
        rule?.durasiDasarJam ?? 24,
      )

      if (nextDurasi !== rental.durasiHari && items.length > 0) {
        let recalculatedSubtotal = 0
        for (const line of items) {
          const nextLineSub = line.hargaSatuan * line.jumlah * nextDurasi
          recalculatedSubtotal += nextLineSub
          await tx
            .update(detailSewa)
            .set({ subtotalItem: nextLineSub })
            .where(eq(detailSewa.id, line.id))
        }
        nextSubtotal = recalculatedSubtotal
        const minHariPromo = rule?.minHariPromo ?? 0
        const diskonPersen = rule?.diskonPersen ?? 0
        nextDiskon =
          nextDurasi >= minHariPromo && minHariPromo > 0
            ? Math.round((nextSubtotal * diskonPersen) / 100)
            : 0
        nextTotalBiaya = Math.max(0, nextSubtotal - nextDiskon)
      }
    }

    const nextStatus = body.statusSewa ?? rental.statusSewa

    // Re-check live inventory before allowing a completed rental to become active again.
    if (rental.statusSewa === 'Selesai' && nextStatus !== 'Selesai' && items.length > 0) {
      const neededByAlat = new Map<number, number>()
      for (const line of items) {
        neededByAlat.set(line.idAlat, (neededByAlat.get(line.idAlat) ?? 0) + line.jumlah)
      }
      const sortedAlatIds = [...neededByAlat.keys()].sort((a, b) => a - b)
      const lockedAlatRows = await tx
        .select()
        .from(masterAlat)
        .where(inArray(masterAlat.id, sortedAlatIds))
        .orderBy(asc(masterAlat.id))
        .for('update')

      const rentedMap = await getActiveRentedMap(tx, sortedAlatIds)
      const alatById = new Map(lockedAlatRows.map((a) => [a.id, a]))

      for (const idAlat of sortedAlatIds) {
        const alat = alatById.get(idAlat)
        if (!alat || !alat.statusAktif) {
          throw createError({
            statusCode: 409,
            statusMessage: `${alat?.namaAlat || 'Alat'} sedang nonaktif sehingga status sewa tidak dapat dibuka kembali.`,
          })
        }
        const available = Math.max(0, alat.stokTotal - (rentedMap.get(idAlat) ?? 0))
        const needed = neededByAlat.get(idAlat) ?? 0
        if (needed > available) {
          throw createError({
            statusCode: 409,
            statusMessage: `Stok ${alat.namaAlat} tidak mencukupi untuk mengaktifkan kembali transaksi ini (tersedia ${available}, butuh ${needed}).`,
          })
        }
      }
    }

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
        subtotal: nextSubtotal,
        diskonNominal: nextDiskon,
        totalBiayaSewa: nextTotalBiaya,
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

  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.transaksi_updated',
    severity: 'info',
    targetType: 'transaksi_sewa',
    targetId: id,
    metadata: { statusSewa: updated?.statusSewa },
  })

  return updated
})
