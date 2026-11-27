import { asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  detailSewa,
  masterAlat,
  paketAlat,
  paketAlatItem,
  penyewa,
  transaksiSewa,
} from '../../../database/schema'

const createSewaSchema = z.object({
  idPenyewa: z.coerce.number().int().positive().optional(),
  penyewa: z
    .object({
      nama: z.string().trim().min(2).max(120),
      noIdentitas: z.string().trim().min(4).max(60).optional(),
      noWa: z.string().trim().min(6).max(30),
      alamat: z.string().trim().min(2).max(500),
    })
    .optional(),
  jenisJaminan: z.enum(['KTP', 'SIM', 'Kartu Pelajar']),
  tanggalPinjam: z.string().min(1),
  tanggalKembaliRencana: z.string().min(1),
  catatan: z.string().trim().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        idAlat: z.coerce.number().int().positive(),
        jumlah: z.coerce.number().int().min(1).max(100),
      }),
    )
    .default([]),
  paketItems: z
    .array(
      z.object({
        idPaket: z.coerce.number().int().positive(),
        qtyPaket: z.coerce.number().int().min(1).max(20),
      }),
    )
    .default([]),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, createSewaSchema)
  if (!body.idPenyewa && !body.penyewa) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Data penyewa wajib diisi.',
    })
  }
  if (!body.items.length && !body.paketItems.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pilih minimal 1 alat satuan atau paket alat untuk transaksi sewa.',
    })
  }

  const tanggalPinjam = new Date(body.tanggalPinjam)
  const tanggalKembaliRencana = new Date(body.tanggalKembaliRencana)
  if (
    Number.isNaN(tanggalPinjam.getTime()) ||
    Number.isNaN(tanggalKembaliRencana.getTime()) ||
    tanggalKembaliRencana <= tanggalPinjam
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Tanggal rencana kembali harus lebih besar dari tanggal pinjam.',
    })
  }

  const db = useDb()
  const adminId = event.context.admin?.id as number

  const created = await db.transaction(async (tx) => {
    const [rule, livePromos] = await Promise.all([
      getDefaultSetting(tx),
      getLivePromos(tx, tanggalPinjam),
    ])
    if (!rule) {
      throw createError({ statusCode: 500, statusMessage: 'Aturan sewa default belum tersedia.' })
    }

    let custId: number
    if (body.penyewa) {
      const [existingCust] = await tx
        .select()
        .from(penyewa)
        .where(
          body.penyewa.noIdentitas
            ? eq(penyewa.noIdentitas, body.penyewa.noIdentitas)
            : eq(penyewa.noWa, body.penyewa.noWa),
        )
        .limit(1)
      if (existingCust) {
        await tx
          .update(penyewa)
          .set({
            nama: body.penyewa.nama,
            noWa: body.penyewa.noWa,
            alamat: body.penyewa.alamat,
          })
          .where(eq(penyewa.id, existingCust.id))
        custId = existingCust.id
      } else {
        const noIdentitas =
          body.penyewa.noIdentitas ||
          `ID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        const [insCust] = await tx.insert(penyewa).values({
          nama: body.penyewa.nama,
          noIdentitas,
          noWa: body.penyewa.noWa,
          alamat: body.penyewa.alamat,
        })
        custId = Number(insCust.insertId)
      }
    } else {
      const [cust] = await tx
        .select()
        .from(penyewa)
        .where(eq(penyewa.id, body.idPenyewa!))
        .limit(1)
      if (!cust) {
        throw createError({ statusCode: 404, statusMessage: 'Penyewa tidak ditemukan.' })
      }
      custId = cust.id
    }

    const durasiHari = computeDurationDays(
      tanggalPinjam,
      tanggalKembaliRencana,
      rule.durasiDasarJam,
    )

    const requestedByAlat = new Map<number, number>()
    const regularDrafts: Array<{ idAlat: number; jumlah: number }> = []
    const paketGroups: Array<{
      idPaket: number
      tarifPaket: number
      qtyPaket: number
      lines: Array<{ idAlat: number; totalUnits: number }>
    }> = []

    for (const item of body.items) {
      requestedByAlat.set(item.idAlat, (requestedByAlat.get(item.idAlat) ?? 0) + item.jumlah)
      regularDrafts.push({
        idAlat: item.idAlat,
        jumlah: item.jumlah,
      })
    }

    if (body.paketItems.length) {
      const paketIds = [...new Set(body.paketItems.map((p) => p.idPaket))]
      const [pkgs, pkgLines] = await Promise.all([
        tx.select().from(paketAlat).where(inArray(paketAlat.id, paketIds)),
        tx.select().from(paketAlatItem).where(inArray(paketAlatItem.idPaket, paketIds)),
      ])
      const pkgMap = new Map(pkgs.map((p) => [p.id, p]))
      for (const reqPkg of body.paketItems) {
        const pkg = pkgMap.get(reqPkg.idPaket)
        if (!pkg || !pkg.statusAktif) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Paket alat tidak ditemukan atau sedang nonaktif.',
          })
        }
        const lines = pkgLines.filter((l) => l.idPaket === pkg.id)
        const groupLines: Array<{ idAlat: number; totalUnits: number }> = []
        for (const l of lines) {
          const totalUnits = l.jumlah * reqPkg.qtyPaket
          requestedByAlat.set(l.idAlat, (requestedByAlat.get(l.idAlat) ?? 0) + totalUnits)
          groupLines.push({ idAlat: l.idAlat, totalUnits })
        }
        if (groupLines.length) {
          const { hargaEfektif } = resolveBestPromoForPaket(
            { id: pkg.id, tarifPaket: pkg.tarifPaket },
            livePromos,
          )
          paketGroups.push({
            idPaket: pkg.id,
            tarifPaket: hargaEfektif,
            qtyPaket: reqPkg.qtyPaket,
            lines: groupLines,
          })
        }
      }
    }

    // Lock involved tool rows in ascending ID order to prevent concurrent overselling and deadlocks.
    const sortedAlatIds = [...requestedByAlat.keys()].sort((a, b) => a - b)
    const lockedAlatRows = await tx
      .select()
      .from(masterAlat)
      .where(inArray(masterAlat.id, sortedAlatIds))
      .orderBy(asc(masterAlat.id))
      .for('update')

    if (lockedAlatRows.length !== sortedAlatIds.length) {
      throw createError({ statusCode: 400, statusMessage: 'Sebagian alat tidak ditemukan.' })
    }

    const rentedMap = await getActiveRentedMap(tx, sortedAlatIds)
    const alatById = new Map(lockedAlatRows.map((a) => [a.id, a]))

    for (const idAlat of sortedAlatIds) {
      const alat = alatById.get(idAlat)!
      if (!alat.statusAktif) {
        throw createError({
          statusCode: 409,
          statusMessage: `${alat.namaAlat} sedang dinonaktifkan dan tidak bisa disewa.`,
        })
      }
      const available = Math.max(0, alat.stokTotal - (rentedMap.get(idAlat) ?? 0))
      const needed = requestedByAlat.get(idAlat)!
      if (needed > available) {
        throw createError({
          statusCode: 409,
          statusMessage: `Stok ${alat.namaAlat} tidak mencukupi (tersedia ${available} unit, diminta ${needed} unit).`,
        })
      }
    }

    let regularSubtotal = 0
    let subtotal = 0
    const detailValues: Array<{
      idAlat: number
      idPaket: number | null
      jumlah: number
      hargaSatuan: number
      subtotalItem: number
    }> = []

    for (const draft of regularDrafts) {
      const alat = alatById.get(draft.idAlat)!
      const { hargaEfektif } = resolveBestPromoForAlat(
        { id: alat.id, idKategori: alat.idKategori, hargaHarian: alat.hargaHarian },
        livePromos,
      )
      const unitRate = hargaEfektif
      const subItem = unitRate * draft.jumlah * durasiHari
      subtotal += subItem
      regularSubtotal += subItem
      detailValues.push({
        idAlat: draft.idAlat,
        idPaket: null,
        jumlah: draft.jumlah,
        hargaSatuan: unitRate,
        subtotalItem: subItem,
      })
    }

    for (const pg of paketGroups) {
      const targetPkgTotal = pg.tarifPaket * pg.qtyPaket * durasiHari
      const pkgWeightSum = pg.lines.reduce(
        (sum, l) => sum + (alatById.get(l.idAlat)?.hargaHarian ?? 0) * l.totalUnits,
        0,
      )
      let allocatedSoFar = 0
      pg.lines.forEach((l, idx) => {
        const isLast = idx === pg.lines.length - 1
        const alat = alatById.get(l.idAlat)!
        const lineWeight = alat.hargaHarian * l.totalUnits
        const allocatedSubtotal = isLast
          ? Math.max(0, targetPkgTotal - allocatedSoFar)
          : pkgWeightSum > 0
            ? Math.round((targetPkgTotal * lineWeight) / pkgWeightSum)
            : Math.round(targetPkgTotal / pg.lines.length)
        allocatedSoFar += allocatedSubtotal
        subtotal += allocatedSubtotal
        detailValues.push({
          idAlat: l.idAlat,
          idPaket: pg.idPaket,
          jumlah: l.totalUnits,
          hargaSatuan: Math.round(allocatedSubtotal / (l.totalUnits * durasiHari)),
          subtotalItem: allocatedSubtotal,
        })
      })
    }

    // Duration promo applies across the entire rental subtotal (items and packages/bundles).
    const diskonNominal =
      durasiHari >= rule.minHariPromo && rule.minHariPromo > 0
        ? Math.round((subtotal * rule.diskonPersen) / 100)
        : 0
    const totalBiayaSewa = Math.max(0, subtotal - diskonNominal)
    const kodeSewa = generateUniqueKode('TRX')

    const [ins] = await tx.insert(transaksiSewa).values({
      kodeSewa,
      idPenyewa: custId,
      idAdmin: adminId,
      idPengaturan: rule.id,
      jenisJaminan: body.jenisJaminan,
      tanggalPinjam,
      tanggalKembaliRencana,
      durasiHari,
      subtotal,
      diskonNominal,
      totalBiayaSewa,
      statusSewa: 'Disewa',
      catatan: body.catatan || null,
    })

    const idSewa = Number(ins.insertId)
    await tx.insert(detailSewa).values(detailValues.map((d) => ({ ...d, idSewa })))

    const [row] = await tx
      .select()
      .from(transaksiSewa)
      .where(eq(transaksiSewa.id, idSewa))
      .limit(1)
    return row
  })

  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.transaksi_created',
    severity: 'info',
    targetType: 'transaksi_sewa',
    targetId: created?.id,
    metadata: {
      kodeSewa: created?.kodeSewa,
      totalBiayaSewa: created?.totalBiayaSewa,
    },
  })

  setResponseStatus(event, 201)
  return created
})

