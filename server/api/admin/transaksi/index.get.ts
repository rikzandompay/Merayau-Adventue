import { desc, eq, inArray } from 'drizzle-orm'
import {
  detailSewa,
  masterAlat,
  paketAlat,
  pengaturanSewa,
  penyewa,
  transaksiSewa,
} from '../../../database/schema'

export default defineEventHandler(async () => {
  const db = useDb()
  await syncOverdueTransactions(db)

  const [rentals, setting] = await Promise.all([
    db
      .select({
        id: transaksiSewa.id,
        kodeSewa: transaksiSewa.kodeSewa,
        idPenyewa: transaksiSewa.idPenyewa,
        penyewaNama: penyewa.nama,
        penyewaWa: penyewa.noWa,
        idPengaturan: transaksiSewa.idPengaturan,
        jenisJaminan: transaksiSewa.jenisJaminan,
        tanggalPinjam: transaksiSewa.tanggalPinjam,
        tanggalKembaliRencana: transaksiSewa.tanggalKembaliRencana,
        tanggalKembaliAktual: transaksiSewa.tanggalKembaliAktual,
        durasiHari: transaksiSewa.durasiHari,
        subtotal: transaksiSewa.subtotal,
        diskonNominal: transaksiSewa.diskonNominal,
        totalBiayaSewa: transaksiSewa.totalBiayaSewa,
        dendaTelat: transaksiSewa.dendaTelat,
        dendaRusak: transaksiSewa.dendaRusak,
        statusSewa: transaksiSewa.statusSewa,
        catatan: transaksiSewa.catatan,
        toleransiTelatJam: pengaturanSewa.toleransiTelatJam,
        dendaPersenHarian: pengaturanSewa.dendaPersenHarian,
      })
      .from(transaksiSewa)
      .innerJoin(penyewa, eq(transaksiSewa.idPenyewa, penyewa.id))
      .innerJoin(pengaturanSewa, eq(transaksiSewa.idPengaturan, pengaturanSewa.id))
      .orderBy(desc(transaksiSewa.id)),
    getDefaultSetting(db),
  ])

  const sewaIds = rentals.map((r) => r.id)
  const itemsBySewa = new Map<
    number,
    Array<{
      id: number
      idAlat: number
      idPaket: number | null
      namaAlat: string
      namaPaket: string | null
      jumlah: number
      hargaSatuan: number
      subtotalItem: number
      kondisiKembali: string | null
    }>
  >()

  if (sewaIds.length) {
    const details = await db
      .select({
        id: detailSewa.id,
        idSewa: detailSewa.idSewa,
        idAlat: detailSewa.idAlat,
        idPaket: detailSewa.idPaket,
        namaAlat: masterAlat.namaAlat,
        namaPaket: paketAlat.namaPaket,
        jumlah: detailSewa.jumlah,
        hargaSatuan: detailSewa.hargaSatuan,
        subtotalItem: detailSewa.subtotalItem,
        kondisiKembali: detailSewa.kondisiKembali,
      })
      .from(detailSewa)
      .innerJoin(masterAlat, eq(detailSewa.idAlat, masterAlat.id))
      .leftJoin(paketAlat, eq(detailSewa.idPaket, paketAlat.id))
      .where(inArray(detailSewa.idSewa, sewaIds))

    for (const d of details) {
      const arr = itemsBySewa.get(d.idSewa) ?? []
      arr.push(d)
      itemsBySewa.set(d.idSewa, arr)
    }
  }

  const now = new Date()
  const enriched = rentals.map((r) => {
    const items = itemsBySewa.get(r.id) ?? []
    const dailyTotal = items.reduce((acc, it) => acc + it.hargaSatuan * it.jumlah, 0)
    const lateInfo =
      r.statusSewa === 'Selesai'
        ? { lateHours: 0, lateDays: 0, dendaTelat: r.dendaTelat }
        : computeLatePenalty(
            new Date(r.tanggalKembaliRencana),
            now,
            r.toleransiTelatJam,
            dailyTotal,
            r.dendaPersenHarian,
          )
    return {
      ...r,
      items,
      dailyTotal,
      estimasiDendaTelat: lateInfo.dendaTelat,
      terlambatJam: lateInfo.lateHours,
    }
  })

  return { transactions: enriched, setting }
})

