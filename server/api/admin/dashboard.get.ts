import { asc, count, desc, eq, gte, inArray, or, sql } from 'drizzle-orm'
import {
  detailSewa,
  kategoriAlat,
  masterAlat,
  penyewa,
  pesertaTrip,
  transaksiSewa,
} from '../../database/schema'

const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export default defineEventHandler(async (event) => {
  const db = useDb()
  await syncOverdueTransactions(db)

  const query = getQuery(event)
  const periodKey = String(query.period || '30d')
  const days = PERIOD_DAYS[periodKey] ?? 30

  const now = new Date()
  const periodStart = new Date(now.getTime() - days * 86_400_000)
  const prevStart = new Date(periodStart.getTime() - days * 86_400_000)

  const [windowRentals, allAlat, rentedMap, pesertaCountRows, customerStatsRows, weekdayRows] =
    await Promise.all([
      db
        .select({
          id: transaksiSewa.id,
          idPenyewa: transaksiSewa.idPenyewa,
          kodeSewa: transaksiSewa.kodeSewa,
          penyewaNama: penyewa.nama,
          penyewaAlamat: penyewa.alamat,
          tanggalPinjam: transaksiSewa.tanggalPinjam,
          tanggalKembaliRencana: transaksiSewa.tanggalKembaliRencana,
          durasiHari: transaksiSewa.durasiHari,
          subtotal: transaksiSewa.subtotal,
          diskonNominal: transaksiSewa.diskonNominal,
          totalBiayaSewa: transaksiSewa.totalBiayaSewa,
          dendaTelat: transaksiSewa.dendaTelat,
          dendaRusak: transaksiSewa.dendaRusak,
          statusSewa: transaksiSewa.statusSewa,
        })
        .from(transaksiSewa)
        .innerJoin(penyewa, eq(transaksiSewa.idPenyewa, penyewa.id))
        .where(
          or(
            gte(transaksiSewa.tanggalPinjam, prevStart),
            inArray(transaksiSewa.statusSewa, ['Disewa', 'Terlambat']),
          ),
        )
        .orderBy(desc(transaksiSewa.tanggalPinjam)),
      db
        .select({
          id: masterAlat.id,
          kodeAlat: masterAlat.kodeAlat,
          namaAlat: masterAlat.namaAlat,
          foto: masterAlat.foto,
          namaKategori: kategoriAlat.namaKategori,
          stokTotal: masterAlat.stokTotal,
          statusAktif: masterAlat.statusAktif,
        })
        .from(masterAlat)
        .innerJoin(kategoriAlat, eq(masterAlat.idKategori, kategoriAlat.id))
        .orderBy(asc(masterAlat.id)),
      getActiveRentedMap(db),
      db.select({ total: count() }).from(pesertaTrip),
      db
        .select({
          idPenyewa: transaksiSewa.idPenyewa,
          txCount: count(),
        })
        .from(transaksiSewa)
        .groupBy(transaksiSewa.idPenyewa),
      db
        .select({
          dow: sql<number>`DAYOFWEEK(${transaksiSewa.tanggalPinjam})`,
          cnt: count(),
        })
        .from(transaksiSewa)
        .groupBy(sql`DAYOFWEEK(${transaksiSewa.tanggalPinjam})`),
    ])

  const windowIds = windowRentals.map((r) => r.id)
  const windowDetails = windowIds.length
    ? await db
        .select({
          idSewa: detailSewa.idSewa,
          idAlat: detailSewa.idAlat,
          idPaket: detailSewa.idPaket,
          jumlah: detailSewa.jumlah,
          subtotalItem: detailSewa.subtotalItem,
          kodeAlat: masterAlat.kodeAlat,
          namaAlat: masterAlat.namaAlat,
          foto: masterAlat.foto,
          namaKategori: kategoriAlat.namaKategori,
        })
        .from(detailSewa)
        .innerJoin(masterAlat, eq(detailSewa.idAlat, masterAlat.id))
        .innerJoin(kategoriAlat, eq(masterAlat.idKategori, kategoriAlat.id))
        .where(inArray(detailSewa.idSewa, windowIds))
    : []

  const allRentals = windowRentals
  const allDetails = windowDetails

  const detailsBySewa = new Map<number, typeof allDetails>()
  for (const d of allDetails) {
    const arr = detailsBySewa.get(d.idSewa) ?? []
    arr.push(d)
    detailsBySewa.set(d.idSewa, arr)
  }

  const currentRentals = allRentals.filter((r) => new Date(r.tanggalPinjam) >= periodStart)
  const prevRentals = allRentals.filter((r) => {
    const dt = new Date(r.tanggalPinjam)
    return dt >= prevStart && dt < periodStart
  })

  const revenueSum = (list: typeof allRentals) =>
    list.reduce((acc, r) => acc + r.totalBiayaSewa + r.dendaTelat + r.dendaRusak, 0)

  const currentRev = revenueSum(currentRentals)
  const prevRev = revenueSum(prevRentals)
  const revDeltaPct =
    prevRev > 0 ? Math.round(((currentRev - prevRev) / prevRev) * 1000) / 10 : null

  const activeRentals = allRentals.filter(
    (r) => r.statusSewa === 'Disewa' || r.statusSewa === 'Terlambat',
  )
  const overdueRentals = allRentals.filter((r) => r.statusSewa === 'Terlambat')

  const stokTotalSemua = allAlat.reduce((acc, a) => acc + a.stokTotal, 0)
  const unitSedangDisewa = [...rentedMap.values()].reduce((acc, n) => acc + n, 0)
  const stokTersedia = Math.max(0, stokTotalSemua - unitSedangDisewa)

  // Bucket chart series cleanly into 6 intervals across the selected window.
  const bucketCount = 6
  const bucketMs = (days * 86_400_000) / bucketCount
  const trendSeries = Array.from({ length: bucketCount }, (_, i) => {
    const bStart = new Date(periodStart.getTime() + i * bucketMs)
    const bEnd = new Date(periodStart.getTime() + (i + 1) * bucketMs)
    const curVal = currentRentals
      .filter((r) => {
        const dt = new Date(r.tanggalPinjam)
        return dt >= bStart && dt < bEnd
      })
      .reduce((acc, r) => acc + r.totalBiayaSewa + r.dendaTelat + r.dendaRusak, 0)

    const pStart = new Date(prevStart.getTime() + i * bucketMs)
    const pEnd = new Date(prevStart.getTime() + (i + 1) * bucketMs)
    const prevVal = prevRentals
      .filter((r) => {
        const dt = new Date(r.tanggalPinjam)
        return dt >= pStart && dt < pEnd
      })
      .reduce((acc, r) => acc + r.totalBiayaSewa + r.dendaTelat + r.dendaRusak, 0)

    return {
      label: bEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      current: curVal,
      previous: prevVal,
    }
  })

  const currentSewaIds = new Set(currentRentals.map((r) => r.id))
  const currentDetails = allDetails.filter((d) => currentSewaIds.has(d.idSewa))

  let regularRev = 0
  let bundleRev = 0
  let regularUnitCount = 0
  let bundleUnitCount = 0
  for (const d of currentDetails) {
    if (d.idPaket) {
      bundleRev += d.subtotalItem
      bundleUnitCount += d.jumlah
    } else {
      regularRev += d.subtotalItem
      regularUnitCount += d.jumlah
    }
  }
  const lateRev = currentRentals.reduce((acc, r) => acc + r.dendaTelat, 0)
  const damageRev = currentRentals.reduce((acc, r) => acc + r.dendaRusak, 0)

  const alatLookup = new Map(allAlat.map((a) => [a.id, a]))
  const byCatMap = new Map<string, number>()
  const byItemMap = new Map<
    number,
    { idAlat: number; kodeAlat: string; namaAlat: string; foto: string | null; units: number; revenue: number }
  >()
  for (const d of currentDetails) {
    byCatMap.set(d.namaKategori, (byCatMap.get(d.namaKategori) ?? 0) + d.jumlah)
    const prev = byItemMap.get(d.idAlat)
    if (prev) {
      prev.units += d.jumlah
      prev.revenue += d.subtotalItem
    } else {
      byItemMap.set(d.idAlat, {
        idAlat: d.idAlat,
        kodeAlat: d.kodeAlat,
        namaAlat: d.namaAlat,
        foto: d.foto,
        units: d.jumlah,
        revenue: d.subtotalItem,
      })
    }
  }

  const categoryBreakdown = [...byCatMap.entries()]
    .map(([namaKategori, units]) => ({ namaKategori, units }))
    .sort((a, b) => b.units - a.units)

  const topItems = [...byItemMap.values()]
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 5)
    .map((item) => {
      const alatRow = alatLookup.get(item.idAlat)
      const stokTotal = alatRow?.stokTotal ?? 0
      const stokDisewa = rentedMap.get(item.idAlat) ?? 0
      const stokTersedia = Math.max(0, stokTotal - stokDisewa)
      const pct = stokTotal > 0 ? Math.round((stokTersedia / stokTotal) * 100) : 0
      const statusStok = pct <= 15 ? 'Kritis' : pct <= 40 ? 'Menipis' : 'Aman'
      return {
        ...item,
        stokTersedia,
        stokTotal,
        statusStok,
      }
    })

  const weekdayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]
  for (const row of weekdayRows) {
    // MySQL DAYOFWEEK returns 1=Sunday .. 7=Saturday
    const dayIdx = Number(row.dow) - 1
    if (dayIdx >= 0 && dayIdx <= 6) weekdayCounts[dayIdx] = Number(row.cnt)
  }
  const weekdayActivity = weekdayLabels.map((label, idx) => ({
    label,
    count: weekdayCounts[idx] ?? 0,
  }))

  const totalPesertaTrip = Number(pesertaCountRows[0]?.total ?? 0)
  const serviceDistribution = [
    { key: 'reguler', label: 'Sewa Reguler', count: regularUnitCount, amount: regularRev, color: 'blue' },
    { key: 'paket', label: 'Paket Bundel', count: bundleUnitCount, amount: bundleRev, color: 'green' },
    { key: 'trip', label: 'Peserta Trip', count: totalPesertaTrip, amount: 0, color: 'orange' },
  ]

  const totalCustomerCount = customerStatsRows.length
  const repeatCustomerCount = customerStatsRows.filter((c) => Number(c.txCount) >= 2).length
  const repeatCustomerPct =
    totalCustomerCount > 0 ? Math.round((repeatCustomerCount / totalCustomerCount) * 100) : 0
  const stockReadyPct =
    stokTotalSemua > 0 ? Math.round((stokTersedia / stokTotalSemua) * 100) : 0

  const activeAlat = allAlat.filter((a) => a.statusAktif)
  const stokAlatPanel = activeAlat
    .map((a) => {
      const disewa = rentedMap.get(a.id) ?? 0
      const tersedia = Math.max(0, a.stokTotal - disewa)
      const pct = a.stokTotal > 0 ? Math.round((tersedia / a.stokTotal) * 100) : 0
      const statusStok = pct <= 15 ? 'Kritis' : pct <= 40 ? 'Menipis' : 'Aman'
      return {
        ...a,
        stokDisewa: disewa,
        stokTersedia: tersedia,
        pctTersedia: pct,
        statusStok,
      }
    })
    .sort((a, b) => a.pctTersedia - b.pctTersedia || b.stokDisewa - a.stokDisewa || a.id - b.id)
    .slice(0, 9)

  const recentTransactions = allRentals.slice(0, 12).map((r) => {
    const items = (detailsBySewa.get(r.id) ?? []).map((d) => `${d.namaAlat} x${d.jumlah}`)
    return {
      ...r,
      ringkasanItem: items.join(', '),
    }
  })

  return {
    period: periodKey,
    days,
    kpis: {
      pendapatanSewa: currentRev,
      revDeltaPct,
      transaksiCount: currentRentals.length,
      unitSedangDisewa,
      activeTransaksiCount: activeRentals.length,
      stokTersedia,
      stokTotalSemua,
      transaksiTerlambat: overdueRentals.length,
    },
    trendSeries,
    revenueSources: [
      { label: 'Sewa Reguler (24j)', amount: regularRev },
      { label: 'Paket Bundel', amount: bundleRev },
      { label: 'Denda Keterlambatan', amount: lateRev },
      { label: 'Denda Kerusakan Alat', amount: damageRev },
    ],
    categoryBreakdown,
    topItems,
    weekdayActivity,
    serviceDistribution,
    readiness: {
      stockReadyPct,
      repeatCustomerPct,
      repeatCustomerCount,
      totalCustomerCount,
    },
    stokAlatPanel,
    stokAlatTotalAktif: activeAlat.length,
    recentTransactions,
  }
})
