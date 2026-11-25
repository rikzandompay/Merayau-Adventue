import { eq } from 'drizzle-orm'
import { detailSewa, masterAlat, penyewa, riwayatPenyewa, transaksiSewa } from '../database/schema'
import type { DbExecutor } from './db'

/**
 * Snapshot a completed rental transaction and its borrower into `riwayat_penyewa`.
 */
export async function recordRiwayatPenyewa(
  tx: DbExecutor,
  idSewa: number,
  kondisiKembaliOverride?: string,
): Promise<void> {
  const [rental] = await tx
    .select({
      id: transaksiSewa.id,
      idPenyewa: transaksiSewa.idPenyewa,
      kodeSewa: transaksiSewa.kodeSewa,
      jenisJaminan: transaksiSewa.jenisJaminan,
      tanggalPinjam: transaksiSewa.tanggalPinjam,
      tanggalKembaliRencana: transaksiSewa.tanggalKembaliRencana,
      tanggalKembaliAktual: transaksiSewa.tanggalKembaliAktual,
      durasiHari: transaksiSewa.durasiHari,
      totalBiayaSewa: transaksiSewa.totalBiayaSewa,
      dendaTelat: transaksiSewa.dendaTelat,
      dendaRusak: transaksiSewa.dendaRusak,
      catatan: transaksiSewa.catatan,
      namaPenyewa: penyewa.nama,
      noIdentitas: penyewa.noIdentitas,
      noWa: penyewa.noWa,
    })
    .from(transaksiSewa)
    .innerJoin(penyewa, eq(transaksiSewa.idPenyewa, penyewa.id))
    .where(eq(transaksiSewa.id, idSewa))
    .limit(1)

  if (!rental) return

  const items = await tx
    .select({
      namaAlat: masterAlat.namaAlat,
      jumlah: detailSewa.jumlah,
      kondisiKembali: detailSewa.kondisiKembali,
    })
    .from(detailSewa)
    .innerJoin(masterAlat, eq(detailSewa.idAlat, masterAlat.id))
    .where(eq(detailSewa.idSewa, idSewa))

  const ringkasanAlat = items.map((d) => `${d.namaAlat} x${d.jumlah}`).join(', ') || '-'
  const totalUnit = items.reduce((acc, d) => acc + d.jumlah, 0)
  const actualReturn = rental.tanggalKembaliAktual ? new Date(rental.tanggalKembaliAktual) : new Date()
  const dueDate = new Date(rental.tanggalKembaliRencana)
  const statusKetepatan =
    rental.dendaTelat > 0 || actualReturn.getTime() > dueDate.getTime()
      ? 'Terlambat'
      : 'Tepat Waktu'
  const kondisiKembali =
    kondisiKembaliOverride ||
    items.find((d) => d.kondisiKembali)?.kondisiKembali ||
    'Baik & Lengkap'
  const totalAkhir = rental.totalBiayaSewa + rental.dendaTelat + rental.dendaRusak

  const payload = {
    idSewa: rental.id,
    idPenyewa: rental.idPenyewa,
    kodeSewa: rental.kodeSewa,
    namaPenyewa: rental.namaPenyewa,
    noIdentitas: rental.noIdentitas,
    noWa: rental.noWa,
    jenisJaminan: rental.jenisJaminan,
    tanggalPinjam: new Date(rental.tanggalPinjam),
    tanggalKembaliRencana: dueDate,
    tanggalKembaliAktual: actualReturn,
    durasiHari: rental.durasiHari,
    ringkasanAlat,
    totalUnit,
    totalBiayaSewa: rental.totalBiayaSewa,
    dendaTelat: rental.dendaTelat,
    dendaRusak: rental.dendaRusak,
    totalAkhir,
    kondisiKembali,
    statusKetepatan: statusKetepatan as 'Tepat Waktu' | 'Terlambat',
    catatan: rental.catatan,
  }

  const [existing] = await tx
    .select({ id: riwayatPenyewa.id })
    .from(riwayatPenyewa)
    .where(eq(riwayatPenyewa.idSewa, idSewa))
    .limit(1)

  if (existing) {
    await tx.update(riwayatPenyewa).set(payload).where(eq(riwayatPenyewa.id, existing.id))
  } else {
    await tx.insert(riwayatPenyewa).values(payload)
  }
}

/**
 * Remove archived history row when a completed rental is reverted or removed.
 */
export async function removeRiwayatPenyewaBySewa(tx: DbExecutor, idSewa: number): Promise<void> {
  await tx.delete(riwayatPenyewa).where(eq(riwayatPenyewa.idSewa, idSewa))
}

