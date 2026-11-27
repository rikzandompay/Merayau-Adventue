import { asc, desc, eq } from 'drizzle-orm'
import {
  infoTrip,
  pesertaTrip,
  tripMeetingPoint,
  tripPaket,
} from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const db = useDb()
  const query = getQuery(event)
  const idTrip = query.idTrip ? Number(query.idTrip) : null
  const statusBayar = String(query.statusBayar || '').trim()
  const search = String(query.search || '').trim().toLowerCase()

  const [allRows, trips, allPakets, allMepos] = await Promise.all([
    db
      .select({
        id: pesertaTrip.id,
        idTrip: pesertaTrip.idTrip,
        judulTrip: infoTrip.judul,
        idTripPaket: pesertaTrip.idTripPaket,
        kodePaket: tripPaket.kodePaket,
        hargaPaket: tripPaket.harga,
        idMeetingPoint: pesertaTrip.idMeetingPoint,
        namaMeetingPoint: tripMeetingPoint.namaLokasi,
        mepoCustom: pesertaTrip.mepoCustom,
        nama: pesertaTrip.nama,
        noIdentitas: pesertaTrip.noIdentitas,
        noWa: pesertaTrip.noWa,
        kontakDarurat: pesertaTrip.kontakDarurat,
        statusBayar: pesertaTrip.statusBayar,
        nominalBayar: pesertaTrip.nominalBayar,
        sewaAlatTambahan: pesertaTrip.sewaAlatTambahan,
        createdAt: pesertaTrip.createdAt,
      })
      .from(pesertaTrip)
      .innerJoin(infoTrip, eq(pesertaTrip.idTrip, infoTrip.id))
      .leftJoin(tripPaket, eq(pesertaTrip.idTripPaket, tripPaket.id))
      .leftJoin(tripMeetingPoint, eq(pesertaTrip.idMeetingPoint, tripMeetingPoint.id))
      .orderBy(desc(pesertaTrip.id)),
    db.select().from(infoTrip).orderBy(asc(infoTrip.id)),
    db.select().from(tripPaket).orderBy(asc(tripPaket.kodePaket)),
    db.select().from(tripMeetingPoint).orderBy(asc(tripMeetingPoint.urutan)),
  ])

  const tripFiltered = idTrip ? allRows.filter((r) => r.idTrip === idTrip) : allRows
  const selectedTrip = idTrip ? trips.find((t) => t.id === idTrip) : null

  const filtered = tripFiltered.filter((r) => {
    if (statusBayar && statusBayar !== 'Semua' && r.statusBayar !== statusBayar) return false
    if (
      search &&
      !r.nama.toLowerCase().includes(search) &&
      !r.noWa.includes(search) &&
      !r.noIdentitas.includes(search)
    ) {
      return false
    }
    return true
  })

  const lunasRows = tripFiltered.filter((r) => r.statusBayar === 'Lunas')
  const dpRows = tripFiltered.filter((r) => r.statusBayar === 'DP 50%')
  const belumRows = tripFiltered.filter((r) => r.statusBayar === 'Belum Bayar')
  const sewaTambahanCount = tripFiltered.filter((r) => Boolean(r.sewaAlatTambahan?.trim())).length
  const kuotaTotal = selectedTrip
    ? selectedTrip.kuota
    : trips.reduce((acc, t) => acc + t.kuota, 0)

  const kurangDpNominal = dpRows.reduce((acc, r) => {
    const target = r.hargaPaket || r.nominalBayar * 2
    return acc + Math.max(0, target - r.nominalBayar)
  }, 0)

  const tripsWithMeta = trips.map((t) => ({
    ...t,
    pesertaCount: allRows.filter((r) => r.idTrip === t.id).length,
    pakets: allPakets.filter((p) => p.idTrip === t.id),
    meetingPoints: allMepos.filter((m) => m.idTrip === t.id),
  }))

  return {
    items: filtered.map((r) => ({
      ...r,
      noIdentitasMasked: maskIdentityNumber(r.noIdentitas),
      lokasiMepoFinal: r.mepoCustom?.trim() || r.namaMeetingPoint || 'Belum dipilih',
    })),
    trips: tripsWithMeta,
    countsByStatus: {
      semua: tripFiltered.length,
      lunas: lunasRows.length,
      dp50: dpRows.length,
      belumBayar: belumRows.length,
    },
    kpis: {
      terdaftar: tripFiltered.length,
      kuotaTotal,
      lunas: lunasRows.length,
      lunasNominal: lunasRows.reduce((acc, r) => acc + r.nominalBayar, 0),
      dp50: dpRows.length,
      dp50Nominal: dpRows.reduce((acc, r) => acc + r.nominalBayar, 0),
      kurangDpNominal,
      sewaTambahan: sewaTambahanCount,
    },
  }
})

