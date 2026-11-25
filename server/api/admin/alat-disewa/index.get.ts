import { asc, eq, inArray } from 'drizzle-orm'
import {
  detailSewa,
  masterAlat,
  pengaturanSewa,
  penyewa,
  transaksiSewa,
} from '../../../database/schema'

function toWaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('62')) return digits
  return `62${digits}`
}

export default defineEventHandler(async () => {
  const db = useDb()
  await syncOverdueTransactions(db)

  const rows = await db
    .select({
      idDetail: detailSewa.id,
      idSewa: transaksiSewa.id,
      kodeSewa: transaksiSewa.kodeSewa,
      namaAlat: masterAlat.namaAlat,
      kodeAlat: masterAlat.kodeAlat,
      jumlah: detailSewa.jumlah,
      hargaSatuan: detailSewa.hargaSatuan,
      namaPenyewa: penyewa.nama,
      kontakWa: penyewa.noWa,
      jenisJaminan: transaksiSewa.jenisJaminan,
      tanggalKembaliRencana: transaksiSewa.tanggalKembaliRencana,
      statusSewa: transaksiSewa.statusSewa,
      toleransiTelatJam: pengaturanSewa.toleransiTelatJam,
      dendaPersenHarian: pengaturanSewa.dendaPersenHarian,
    })
    .from(detailSewa)
    .innerJoin(transaksiSewa, eq(detailSewa.idSewa, transaksiSewa.id))
    .innerJoin(masterAlat, eq(detailSewa.idAlat, masterAlat.id))
    .innerJoin(penyewa, eq(transaksiSewa.idPenyewa, penyewa.id))
    .innerJoin(pengaturanSewa, eq(transaksiSewa.idPengaturan, pengaturanSewa.id))
    .where(inArray(transaksiSewa.statusSewa, ['Disewa', 'Terlambat']))
    .orderBy(asc(transaksiSewa.tanggalKembaliRencana))

  interface GroupedRental {
    idSewa: number
    kodeSewa: string
    namaPenyewa: string
    kontakWa: string
    jenisJaminan: string
    tanggalKembaliRencana: Date
    statusSewa: 'Disewa' | 'Terlambat' | 'Selesai'
    toleransiTelatJam: number
    dendaPersenHarian: number
    totalUnit: number
    dailyTotal: number
    items: Array<{
      idDetail: number
      kodeAlat: string
      namaAlat: string
      jumlah: number
      hargaSatuan: number
    }>
  }

  const grouped = new Map<number, GroupedRental>()
  for (const r of rows) {
    let entry = grouped.get(r.idSewa)
    if (!entry) {
      entry = {
        idSewa: r.idSewa,
        kodeSewa: r.kodeSewa,
        namaPenyewa: r.namaPenyewa,
        kontakWa: r.kontakWa,
        jenisJaminan: r.jenisJaminan,
        tanggalKembaliRencana: r.tanggalKembaliRencana,
        statusSewa: r.statusSewa,
        toleransiTelatJam: r.toleransiTelatJam,
        dendaPersenHarian: r.dendaPersenHarian,
        totalUnit: 0,
        dailyTotal: 0,
        items: [],
      }
      grouped.set(r.idSewa, entry)
    }
    entry.totalUnit += r.jumlah
    entry.dailyTotal += r.hargaSatuan * r.jumlah
    entry.items.push({
      idDetail: r.idDetail,
      kodeAlat: r.kodeAlat,
      namaAlat: r.namaAlat,
      jumlah: r.jumlah,
      hargaSatuan: r.hargaSatuan,
    })
  }

  const now = new Date()
  return [...grouped.values()].map((g) => {
    const due = new Date(g.tanggalKembaliRencana)
    const hoursUntilDue = (due.getTime() - now.getTime()) / 3_600_000
    const lateInfo = computeLatePenalty(
      due,
      now,
      g.toleransiTelatJam,
      g.dailyTotal,
      g.dendaPersenHarian,
    )
    const displayStatus =
      g.statusSewa === 'Terlambat' || lateInfo.dendaTelat > 0
        ? 'Terlambat'
        : hoursUntilDue <= 6
          ? 'Jatuh Tempo'
          : 'Disewa'

    const summary = g.items.map((it) => `${it.namaAlat} x${it.jumlah}`).join(', ')
    const msg = encodeURIComponent(
      `Halo ${g.namaPenyewa}, pengingat pengembalian ${summary} (${g.totalUnit} unit) untuk transaksi ${g.kodeSewa} di Merayau Outdoor.`,
    )

    return {
      idSewa: g.idSewa,
      kodeSewa: g.kodeSewa,
      namaPenyewa: g.namaPenyewa,
      kontakWa: g.kontakWa,
      jenisJaminan: g.jenisJaminan,
      tanggalKembaliRencana: g.tanggalKembaliRencana,
      statusSewa: g.statusSewa,
      totalUnit: g.totalUnit,
      items: g.items,
      estimasiDenda: lateInfo.dendaTelat,
      displayStatus,
      waLink: `https://wa.me/${toWaPhone(g.kontakWa)}?text=${msg}`,
    }
  })
})

