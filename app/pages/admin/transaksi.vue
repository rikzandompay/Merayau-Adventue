<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface RentalItemRow {
  namaAlat: string
  namaPaket: string | null
  jumlah: number
}

interface RentalApiRow {
  id: number
  kodeSewa: string
  penyewaNama: string
  penyewaWa: string
  jenisJaminan: 'KTP' | 'SIM' | 'Kartu Pelajar'
  tanggalPinjam: string
  tanggalKembaliRencana: string
  durasiHari: number
  totalBiayaSewa: number
  dendaTelat: number
  dendaRusak: number
  estimasiDendaTelat: number
  statusSewa: 'Disewa' | 'Terlambat' | 'Selesai'
  items: RentalItemRow[]
}

interface TripMeta {
  id: number
  judul: string
  tanggalBerangkat: string
  kuota: number
  pesertaCount: number
  pakets: Array<{ id: number; kodePaket: string; deskripsiFasilitas: string; harga: number }>
  meetingPoints: Array<{ id: number; namaLokasi: string; isCustom: boolean }>
}

interface TripApiRow {
  id: number
  idTrip: number
  judulTrip: string
  idTripPaket: number | null
  kodePaket: string | null
  hargaPaket: number | null
  idMeetingPoint: number | null
  lokasiMepoFinal: string
  mepoCustom: string | null
  nama: string
  noWa: string
  kontakDarurat: string
  statusBayar: 'Lunas' | 'DP 50%' | 'Belum Bayar'
  nominalBayar: number
  sewaAlatTambahan: string | null
  createdAt: string
}

interface AlatOption {
  id: number
  idKategori: number
  namaAlat: string
  hargaHarian: number
  hargaEfektif?: number
  stokTersedia: number
  statusAktif: boolean
}

interface PaketOption {
  id: number
  namaPaket: string
  tipePaket?: 'paket' | 'bundle'
  tarifPaket: number
  hargaEfektif?: number
  kuotaTersedia: number
  statusAktif: boolean
}

interface PenyewaOption {
  id: number
  nama: string
  noWa: string
  alamat: string
}

interface UnifiedTxRow {
  uid: string
  id: number
  type: 'rental' | 'trip'
  code: string
  dateIso: string
  periodText: string
  customerName: string
  customerWa: string
  titleLine: string
  subLine: string
  searchText: string
  amount: number
  amountSub: string | null
  status: string
  statusTone: 'good' | 'bad' | 'warn' | 'accent'
  waText: string
  rentalRaw?: RentalApiRow
  tripRaw?: TripApiRow
}

// shortcut: merges rental and trip endpoints client-side; replace with a paginated server union endpoint if total rows exceed ~1,000.
const [
  { data: rentalRes, pending: rentalPending, error: rentalErr, refresh: refreshRentals },
  { data: tripRes, pending: tripPending, error: tripErr, refresh: refreshTrips },
] = await Promise.all([
  useFetch<{ transactions: RentalApiRow[] }>('/api/admin/transaksi'),
  useFetch<{ items: TripApiRow[]; trips: TripMeta[] }>('/api/admin/peserta-trip'),
])

const loading = computed(() => (rentalPending.value || tripPending.value) && !rentalRes.value && !tripRes.value)
const loadError = computed(() => rentalErr.value || tripErr.value)

async function refreshAll() {
  await Promise.all([refreshRentals(), refreshTrips()])
}

const allRows = computed<UnifiedTxRow[]>(() => {
  const rentals = (rentalRes.value?.transactions ?? []).map((r): UnifiedTxRow => {
    const totalUnits = r.items.reduce((acc, it) => acc + it.jumlah, 0)
    const hasBundle = r.items.some((it) => Boolean(it.namaPaket))
    const itemNames = r.items.map((it) => it.namaAlat).join(' ')
    const total = r.totalBiayaSewa + r.dendaTelat + r.dendaRusak
    return {
      uid: `rental-${r.id}`,
      id: r.id,
      type: 'rental',
      code: r.kodeSewa,
      dateIso: r.tanggalPinjam,
      periodText: `${formatDateShort(r.tanggalPinjam)} - ${formatDateShort(r.tanggalKembaliRencana)}`,
      customerName: r.penyewaNama,
      customerWa: r.penyewaWa,
      titleLine: hasBundle
        ? `Sewa Paket & Alat · ${totalUnits} unit`
        : `Sewa Alat · ${r.items.length} item (${totalUnits} unit)`,
      subLine: `${r.durasiHari} hari · Jaminan ${r.jenisJaminan}`,
      searchText: `${r.kodeSewa} ${r.penyewaNama} ${r.penyewaWa} ${itemNames}`.toLowerCase(),
      amount: total,
      amountSub:
        r.statusSewa !== 'Selesai' && r.estimasiDendaTelat > 0
          ? `Est. denda ${formatRupiah(r.estimasiDendaTelat)}`
          : null,
      status: r.statusSewa,
      statusTone: r.statusSewa === 'Selesai' ? 'good' : r.statusSewa === 'Terlambat' ? 'bad' : 'accent',
      waText: `Halo ${r.penyewaNama}, info transaksi sewa ${r.kodeSewa} di Merayau Outdoor.`,
      rentalRaw: r,
    }
  })

  const trips = (tripRes.value?.items ?? []).map((p): UnifiedTxRow => {
    const target = p.hargaPaket ?? 0
    return {
      uid: `trip-${p.id}`,
      id: p.id,
      type: 'trip',
      code: `TRIP-${String(p.id).padStart(3, '0')}`,
      dateIso: p.createdAt,
      periodText: formatDateShort(p.createdAt),
      customerName: p.nama,
      customerWa: p.noWa,
      titleLine: p.judulTrip,
      subLine: `${p.kodePaket || 'Reguler'} · ${p.lokasiMepoFinal}`,
      searchText: `trip-${String(p.id).padStart(3, '0')} ${p.nama} ${p.noWa} ${p.judulTrip} ${p.lokasiMepoFinal}`.toLowerCase(),
      amount: p.nominalBayar,
      amountSub:
        p.statusBayar !== 'Lunas' && target > p.nominalBayar
          ? `Target ${formatRupiah(target)}`
          : null,
      status: p.statusBayar,
      statusTone: p.statusBayar === 'Lunas' ? 'good' : p.statusBayar === 'DP 50%' ? 'warn' : 'bad',
      waText: `Halo ${p.nama}, info pendaftaran Open Trip ${p.judulTrip} di Merayau Outdoor.`,
      tripRaw: p,
    }
  })

  return [...rentals, ...trips].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime(),
  )
})

type PeriodPreset = 'all' | 'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom'

const periodPreset = ref<PeriodPreset>('all')
const periodStart = ref('')
const periodEnd = ref('')
const typeFilter = ref<'all' | 'rental' | 'trip'>('all')
const statusFilter = ref('Semua')
const search = ref('')

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rowDateKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return toLocalDateKey(d)
}

watch(periodPreset, (val) => {
  if (val === 'custom' && !periodStart.value && !periodEnd.value) {
    const now = new Date()
    periodStart.value = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
    periodEnd.value = toLocalDateKey(now)
  }
})

watch(typeFilter, () => {
  statusFilter.value = 'Semua'
})

const periodBounds = computed<{ start: string | null; end: string | null }>(() => {
  const now = new Date()
  const today = toLocalDateKey(now)
  if (periodPreset.value === 'all') return { start: null, end: null }
  if (periodPreset.value === 'today') return { start: today, end: today }
  if (periodPreset.value === '7d') {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    return { start: toLocalDateKey(s), end: today }
  }
  if (periodPreset.value === '30d') {
    const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    return { start: toLocalDateKey(s), end: today }
  }
  if (periodPreset.value === 'this_month') {
    const s = new Date(now.getFullYear(), now.getMonth(), 1)
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: toLocalDateKey(s), end: toLocalDateKey(e) }
  }
  if (periodPreset.value === 'last_month') {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const e = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: toLocalDateKey(s), end: toLocalDateKey(e) }
  }
  return { start: periodStart.value || null, end: periodEnd.value || null }
})

const invalidCustomRange = computed(
  () => periodPreset.value === 'custom' && Boolean(periodStart.value && periodEnd.value && periodStart.value > periodEnd.value),
)

const periodLabel = computed(() => {
  if (periodPreset.value === 'all') return 'Semua Periode'
  if (periodPreset.value === 'today') return 'Hari Ini'
  if (periodPreset.value === '7d') return '7 Hari Terakhir'
  if (periodPreset.value === '30d') return '30 Hari Terakhir'
  if (periodPreset.value === 'this_month') return 'Bulan Ini'
  if (periodPreset.value === 'last_month') return 'Bulan Lalu'
  if (periodStart.value && periodEnd.value) {
    return `${formatDateShort(periodStart.value)} - ${formatDateShort(periodEnd.value)}`
  }
  if (periodStart.value) return `Mulai ${formatDateShort(periodStart.value)}`
  if (periodEnd.value) return `Sampai ${formatDateShort(periodEnd.value)}`
  return 'Rentang Tanggal'
})

const statusOptions = computed<string[]>(() => {
  if (typeFilter.value === 'rental') return ['Semua', 'Disewa', 'Terlambat', 'Selesai']
  if (typeFilter.value === 'trip') return ['Semua', 'Lunas', 'DP 50%', 'Belum Bayar']
  return ['Semua', 'Lunas / Selesai', 'Aktif / DP', 'Terlambat / Belum Bayar']
})

const periodRows = computed(() => {
  const { start, end } = periodBounds.value
  if (!start && !end) return allRows.value
  if (invalidCustomRange.value) return []
  return allRows.value.filter((row) => {
    const key = rowDateKey(row.dateIso)
    if (!key) return false
    if (start && key < start) return false
    if (end && key > end) return false
    return true
  })
})

const typeCounts = computed(() => {
  const list = periodRows.value
  const rentalRows = list.filter((r) => r.type === 'rental')
  const tripRows = list.filter((r) => r.type === 'trip')
  return {
    all: list.length,
    rental: rentalRows.length,
    trip: tripRows.length,
    rentalSum: rentalRows.reduce((acc, r) => acc + r.amount, 0),
    tripSum: tripRows.reduce((acc, r) => acc + r.amount, 0),
  }
})

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return periodRows.value.filter((row) => {
    if (typeFilter.value !== 'all' && row.type !== typeFilter.value) return false

    if (statusFilter.value !== 'Semua') {
      if (typeFilter.value === 'all') {
        if (statusFilter.value === 'Lunas / Selesai' && row.status !== 'Selesai' && row.status !== 'Lunas') {
          return false
        }
        if (statusFilter.value === 'Aktif / DP' && row.status !== 'Disewa' && row.status !== 'DP 50%') {
          return false
        }
        if (
          statusFilter.value === 'Terlambat / Belum Bayar' &&
          row.status !== 'Terlambat' &&
          row.status !== 'Belum Bayar'
        ) {
          return false
        }
      } else if (row.status !== statusFilter.value) {
        return false
      }
    }

    if (q && !row.searchText.includes(q)) return false
    return true
  })
})

const activeRevenueSum = computed(() => filteredRows.value.reduce((acc, r) => acc + r.amount, 0))
const hasActiveFilters = computed(
  () =>
    periodPreset.value !== 'all' ||
    typeFilter.value !== 'all' ||
    statusFilter.value !== 'Semua' ||
    search.value.trim().length > 0,
)

function resetFilters() {
  periodPreset.value = 'all'
  periodStart.value = ''
  periodEnd.value = ''
  typeFilter.value = 'all'
  statusFilter.value = 'Semua'
  search.value = ''
}

const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 3000)
}

const rentalCatalogLoaded = ref(false)
const rentalCatalogLoading = ref(false)
const alatOptions = ref<AlatOption[]>([])
const paketOptions = ref<PaketOption[]>([])
const penyewaOptions = ref<PenyewaOption[]>([])

async function ensureRentalCatalog() {
  if (rentalCatalogLoaded.value || rentalCatalogLoading.value) return
  rentalCatalogLoading.value = true
  try {
    const [alatRes, paketRes, penyewaRes] = await Promise.all([
      $fetch<{ items: AlatOption[] }>('/api/admin/alat'),
      $fetch<PaketOption[]>('/api/admin/paket-alat'),
      $fetch<PenyewaOption[]>('/api/admin/penyewa'),
    ])
    alatOptions.value = (alatRes.items ?? []).filter((a) => a.statusAktif && a.stokTersedia > 0)
    paketOptions.value = (paketRes ?? []).filter((p) => p.statusAktif && p.kuotaTersedia > 0)
    penyewaOptions.value = penyewaRes ?? []
    rentalCatalogLoaded.value = true
  } finally {
    rentalCatalogLoading.value = false
  }
}

const showCreateModal = ref(false)
const createKind = ref<'rental' | 'trip'>('rental')
const createErr = ref('')
const creating = ref(false)
const quickPickPenyewaId = ref(0)

const createRentalForm = reactive({
  nama: '',
  noWa: '',
  alamat: '',
  jenisJaminan: 'KTP' as 'KTP' | 'SIM' | 'Kartu Pelajar',
  tanggalPinjam: '',
  tanggalKembaliRencana: '',
  itemLines: [] as Array<{ idAlat: number; jumlah: number }>,
  paketLines: [] as Array<{ idPaket: number; qtyPaket: number }>,
})

const createTripForm = reactive({
  idTrip: 0,
  idTripPaket: 0,
  idMeetingPoint: 0,
  mepoCustom: '',
  nama: '',
  noIdentitas: '',
  noWa: '',
  kontakDarurat: '',
  statusBayar: 'DP 50%' as 'Lunas' | 'DP 50%' | 'Belum Bayar',
  nominalBayar: 0,
  sewaAlatTambahan: '',
})

const selectedCreateTrip = computed(
  () => (tripRes.value?.trips ?? []).find((t) => t.id === createTripForm.idTrip) ?? null,
)
const selectedCreateMepo = computed(
  () => selectedCreateTrip.value?.meetingPoints.find((m) => m.id === createTripForm.idMeetingPoint) ?? null,
)

watch(quickPickPenyewaId, (id) => {
  if (!id) return
  const cust = penyewaOptions.value.find((p) => p.id === id)
  if (cust) {
    createRentalForm.nama = cust.nama
    createRentalForm.noWa = cust.noWa
    createRentalForm.alamat = cust.alamat
  }
  quickPickPenyewaId.value = 0
})

watch(
  () => createTripForm.idTrip,
  (newId) => {
    const t = (tripRes.value?.trips ?? []).find((tr) => tr.id === newId)
    if (!t) return
    createTripForm.idTripPaket = t.pakets[0]?.id ?? 0
    createTripForm.idMeetingPoint = t.meetingPoints[0]?.id ?? 0
  },
)

watch([() => createTripForm.idTripPaket, () => createTripForm.statusBayar], () => {
  const pkg = selectedCreateTrip.value?.pakets.find((p) => p.id === createTripForm.idTripPaket)
  const price = pkg?.harga ?? 0
  if (createTripForm.statusBayar === 'Lunas') createTripForm.nominalBayar = price
  else if (createTripForm.statusBayar === 'DP 50%') createTripForm.nominalBayar = Math.round(price * 0.5)
  else createTripForm.nominalBayar = 0
})

async function openCreateModal() {
  createErr.value = ''
  createKind.value = typeFilter.value === 'trip' ? 'trip' : 'rental'
  const now = new Date()
  const twoDays = new Date(now.getTime() + 2 * 86_400_000)

  createRentalForm.nama = ''
  createRentalForm.noWa = ''
  createRentalForm.alamat = ''
  createRentalForm.jenisJaminan = 'KTP'
  createRentalForm.tanggalPinjam = toDatetimeLocalValue(now)
  createRentalForm.tanggalKembaliRencana = toDatetimeLocalValue(twoDays)
  createRentalForm.itemLines = []
  createRentalForm.paketLines = []

  const firstTrip = tripRes.value?.trips?.[0]
  createTripForm.idTrip = firstTrip?.id ?? 0
  createTripForm.idTripPaket = firstTrip?.pakets[0]?.id ?? 0
  createTripForm.idMeetingPoint = firstTrip?.meetingPoints[0]?.id ?? 0
  createTripForm.mepoCustom = ''
  createTripForm.nama = ''
  createTripForm.noIdentitas = ''
  createTripForm.noWa = ''
  createTripForm.kontakDarurat = ''
  createTripForm.statusBayar = 'DP 50%'
  createTripForm.nominalBayar = Math.round((firstTrip?.pakets[0]?.harga ?? 0) * 0.5)
  createTripForm.sewaAlatTambahan = ''

  showCreateModal.value = true
  await ensureRentalCatalog()
  if (alatOptions.value[0] && !createRentalForm.itemLines.length) {
    createRentalForm.itemLines.push({ idAlat: alatOptions.value[0].id, jumlah: 1 })
  }
}

function addCreateAlatLine() {
  const first = alatOptions.value[0]
  if (!first) return
  createRentalForm.itemLines.push({ idAlat: first.id, jumlah: 1 })
}

function addCreatePaketLine() {
  const first = paketOptions.value[0]
  if (!first) return
  createRentalForm.paketLines.push({ idPaket: first.id, qtyPaket: 1 })
}

async function submitCreate() {
  createErr.value = ''
  creating.value = true
  try {
    if (createKind.value === 'rental') {
      if (!createRentalForm.nama.trim() || !createRentalForm.noWa.trim() || !createRentalForm.alamat.trim()) {
        createErr.value = 'Nama, no. WhatsApp, dan alamat penyewa wajib diisi.'
        return
      }
      const validItems = createRentalForm.itemLines.filter((l) => l.idAlat > 0)
      if (!validItems.length && !createRentalForm.paketLines.length) {
        createErr.value = 'Tambahkan minimal 1 alat satuan atau paket alat.'
        return
      }
      const created = await $fetch<{ kodeSewa: string }>('/api/admin/transaksi', {
        method: 'POST',
        body: {
          penyewa: {
            nama: createRentalForm.nama.trim(),
            noWa: createRentalForm.noWa.trim(),
            alamat: createRentalForm.alamat.trim(),
          },
          jenisJaminan: createRentalForm.jenisJaminan,
          tanggalPinjam: new Date(createRentalForm.tanggalPinjam).toISOString(),
          tanggalKembaliRencana: new Date(createRentalForm.tanggalKembaliRencana).toISOString(),
          items: validItems,
          paketItems: createRentalForm.paketLines,
        },
      })
      showCreateModal.value = false
      await refreshAll()
      showToast(`Transaksi rental ${created.kodeSewa} tersimpan.`)
    } else {
      if (!createTripForm.idTrip) {
        createErr.value = 'Jadwal open trip belum tersedia.'
        return
      }
      await $fetch('/api/admin/peserta-trip', {
        method: 'POST',
        body: {
          ...createTripForm,
          idTripPaket: createTripForm.idTripPaket || null,
          idMeetingPoint: createTripForm.idMeetingPoint || null,
          mepoCustom: selectedCreateMepo.value?.isCustom ? createTripForm.mepoCustom : null,
          sewaAlatTambahan: createTripForm.sewaAlatTambahan || null,
        },
      })
      showCreateModal.value = false
      await refreshAll()
      showToast('Pendaftaran peserta open trip tersimpan.')
    }
  } catch (err: unknown) {
    createErr.value =
      (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage ||
      'Gagal menyimpan transaksi baru.'
  } finally {
    creating.value = false
  }
}

const editTarget = ref<UnifiedTxRow | null>(null)
const editErr = ref('')
const savingEdit = ref(false)

const editRentalForm = reactive({
  jenisJaminan: 'KTP' as 'KTP' | 'SIM' | 'Kartu Pelajar',
  tanggalKembaliRencana: '',
  statusSewa: 'Disewa' as 'Disewa' | 'Terlambat' | 'Selesai',
  dendaTelat: 0,
  dendaRusak: 0,
})

const editTripForm = reactive({
  nama: '',
  noWa: '',
  kontakDarurat: '',
  idTripPaket: 0,
  idMeetingPoint: 0,
  mepoCustom: '',
  statusBayar: 'DP 50%' as 'Lunas' | 'DP 50%' | 'Belum Bayar',
  nominalBayar: 0,
  sewaAlatTambahan: '',
})

const editTripMeta = computed(() => {
  const tripId = editTarget.value?.tripRaw?.idTrip
  return (tripRes.value?.trips ?? []).find((t) => t.id === tripId) ?? null
})
const editTripMepo = computed(
  () => editTripMeta.value?.meetingPoints.find((m) => m.id === editTripForm.idMeetingPoint) ?? null,
)

function openEditModal(row: UnifiedTxRow) {
  editErr.value = ''
  editTarget.value = row
  if (row.type === 'rental' && row.rentalRaw) {
    const r = row.rentalRaw
    editRentalForm.jenisJaminan = r.jenisJaminan
    editRentalForm.tanggalKembaliRencana = toDatetimeLocalValue(new Date(r.tanggalKembaliRencana))
    editRentalForm.statusSewa = r.statusSewa
    editRentalForm.dendaTelat = r.dendaTelat
    editRentalForm.dendaRusak = r.dendaRusak
  } else if (row.type === 'trip' && row.tripRaw) {
    const p = row.tripRaw
    editTripForm.nama = p.nama
    editTripForm.noWa = p.noWa
    editTripForm.kontakDarurat = p.kontakDarurat
    editTripForm.idTripPaket = p.idTripPaket ?? 0
    editTripForm.idMeetingPoint = p.idMeetingPoint ?? 0
    editTripForm.mepoCustom = p.mepoCustom ?? ''
    editTripForm.statusBayar = p.statusBayar
    editTripForm.nominalBayar = p.nominalBayar
    editTripForm.sewaAlatTambahan = p.sewaAlatTambahan ?? ''
  }
}

async function submitEdit() {
  if (!editTarget.value) return
  editErr.value = ''
  savingEdit.value = true
  try {
    if (editTarget.value.type === 'rental') {
      await $fetch(`/api/admin/transaksi/${editTarget.value.id}`, {
        method: 'PUT',
        body: {
          jenisJaminan: editRentalForm.jenisJaminan,
          tanggalKembaliRencana: new Date(editRentalForm.tanggalKembaliRencana).toISOString(),
          statusSewa: editRentalForm.statusSewa,
          dendaTelat: editRentalForm.dendaTelat,
          dendaRusak: editRentalForm.dendaRusak,
        },
      })
      showToast(`Transaksi ${editTarget.value.code} diperbarui.`)
    } else {
      await $fetch(`/api/admin/peserta-trip/${editTarget.value.id}`, {
        method: 'PUT',
        body: {
          nama: editTripForm.nama.trim(),
          noWa: editTripForm.noWa.trim(),
          kontakDarurat: editTripForm.kontakDarurat.trim(),
          idTripPaket: editTripForm.idTripPaket || null,
          idMeetingPoint: editTripForm.idMeetingPoint || null,
          mepoCustom: editTripMepo.value?.isCustom ? editTripForm.mepoCustom : null,
          statusBayar: editTripForm.statusBayar,
          nominalBayar: editTripForm.nominalBayar,
          sewaAlatTambahan: editTripForm.sewaAlatTambahan || null,
        },
      })
      showToast(`Data ${editTarget.value.customerName} diperbarui.`)
    }
    editTarget.value = null
    await refreshAll()
  } catch (err: unknown) {
    editErr.value =
      (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage ||
      'Gagal memperbarui transaksi.'
  } finally {
    savingEdit.value = false
  }
}

const deleteTarget = ref<UnifiedTxRow | null>(null)
const deleteErr = ref('')
const deleting = ref(false)

function openDeleteModal(row: UnifiedTxRow) {
  deleteErr.value = ''
  deleteTarget.value = row
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteErr.value = ''
  deleting.value = true
  try {
    const endpoint =
      deleteTarget.value.type === 'rental'
        ? `/api/admin/transaksi/${deleteTarget.value.id}`
        : `/api/admin/peserta-trip/${deleteTarget.value.id}`
    await $fetch(endpoint, { method: 'DELETE' })
    const code = deleteTarget.value.code
    deleteTarget.value = null
    await refreshAll()
    showToast(`Transaksi ${code} dihapus.`)
  } catch (err: unknown) {
    deleteErr.value =
      (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage ||
      'Gagal menghapus transaksi.'
  } finally {
    deleting.value = false
  }
}

function exportCsv() {
  const rows = filteredRows.value
  if (!rows.length || !import.meta.client) return
  const headers = ['Kode', 'Jenis', 'Tanggal', 'Pelanggan', 'WhatsApp', 'Ringkasan', 'Detail', 'Nominal', 'Status']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.map(esc).join(','),
    ...rows.map((r) =>
      [
        r.code,
        r.type === 'rental' ? 'Rental' : 'Trip',
        r.dateIso,
        r.customerName,
        r.customerWa,
        r.titleLine,
        r.subLine,
        r.amount,
        r.status,
      ]
        .map(esc)
        .join(','),
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `merayau-transaksi-${typeFilter.value}-${periodPreset.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (deleteTarget.value) deleteTarget.value = null
  else if (editTarget.value) editTarget.value = null
  else if (showCreateModal.value) showCreateModal.value = false
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="ed-label">BUKU TRANSAKSI TERPADU</p>
        <h1 class="text-xl font-bold tracking-tight sm:text-2xl" style="color: var(--srf-ink)">
          Transaksi Keseluruhan
        </h1>
        <p class="mt-0.5 text-xs sm:text-sm" style="color: var(--srf-ink-3)">
          Rental Alat ({{ typeCounts.rental }}) dan Open Trip ({{ typeCounts.trip }}) dalam satu daftar.
        </p>
      </div>

      <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <button
          type="button"
          class="ed-btn-secondary flex-1 sm:flex-initial !text-xs"
          :disabled="!filteredRows.length"
          @click="exportCsv"
        >
          Export CSV
        </button>
        <button type="button" class="ed-btn-primary flex-1 sm:flex-initial !text-xs" @click="openCreateModal">
          + Tambah Transaksi
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
      <div class="ed-card p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
        <div class="text-xs font-semibold" style="color: var(--srf-ink-2)">
          Total Pemasukan (Filter Aktif)
        </div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink)">
          {{ formatRupiah(activeRevenueSum) }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3)">
          Dari {{ filteredRows.length }} transaksi · {{ periodLabel }}
        </div>
      </div>

      <button
        type="button"
        class="ed-card ed-card-hover cursor-pointer p-4 text-left sm:p-5"
        :style="typeFilter === 'rental' ? { borderColor: 'var(--srf-accent-border)' } : {}"
        @click="typeFilter = typeFilter === 'rental' ? 'all' : 'rental'"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Transaksi Rental</span>
          <StatusBadge variant="light" tone="accent" label="Rental" />
        </div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink)">
          {{ formatRupiah(typeCounts.rentalSum) }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3)">
          {{ typeCounts.rental }} nota penyewaan alat
        </div>
      </button>

      <button
        type="button"
        class="ed-card ed-card-hover cursor-pointer p-4 text-left sm:p-5"
        :style="typeFilter === 'trip' ? { borderColor: 'var(--srf-purple-border)' } : {}"
        @click="typeFilter = typeFilter === 'trip' ? 'all' : 'trip'"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Transaksi Open Trip</span>
          <StatusBadge variant="light" tone="purple" label="Trip" />
        </div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink)">
          {{ formatRupiah(typeCounts.tripSum) }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3)">
          {{ typeCounts.trip }} pendaftaran peserta trip
        </div>
      </button>
    </div>

    <div
      v-if="loadError"
      class="ed-card flex flex-wrap items-center justify-between gap-3 p-5 text-sm"
      style="border-color: var(--srf-bad-border); color: var(--srf-bad-ink)"
    >
      <span>Gagal memuat data transaksi: {{ loadError.message }}</span>
      <button type="button" class="ed-btn-secondary !text-xs" @click="refreshAll">
        Coba Lagi
      </button>
    </div>

    <div v-else-if="loading" class="ed-card p-8 text-sm" style="color: var(--srf-ink-3)">
      Memuat gabungan transaksi rental dan open trip...
    </div>

    <section v-else class="ed-card overflow-hidden">
      <div
        class="flex flex-col gap-3 border-b p-4 sm:p-5"
        style="border-color: var(--srf-line)"
      >
        <div class="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:flex lg:items-center">
            <select
              v-model="periodPreset"
              class="ed-select col-span-2 sm:col-span-1 !min-h-[44px] lg:!min-h-[40px] lg:!w-44 !py-2 !text-xs font-medium"
              aria-label="Periode transaksi"
            >
              <option value="all">Semua Periode</option>
              <option value="today">Hari Ini</option>
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
              <option value="this_month">Bulan Ini</option>
              <option value="last_month">Bulan Lalu</option>
              <option value="custom">Pilih Tanggal...</option>
            </select>

            <select
              v-model="typeFilter"
              class="ed-select !min-h-[44px] lg:!min-h-[40px] lg:!w-44 !py-2 !text-xs font-medium"
              aria-label="Filter jenis transaksi"
            >
              <option value="all">Semua Jenis ({{ typeCounts.all }})</option>
              <option value="rental">Rental Alat ({{ typeCounts.rental }})</option>
              <option value="trip">Open Trip ({{ typeCounts.trip }})</option>
            </select>

            <select
              v-model="statusFilter"
              class="ed-select !min-h-[44px] lg:!min-h-[40px] lg:!w-48 !py-2 !text-xs font-medium"
              aria-label="Filter status transaksi"
            >
              <option v-for="st in statusOptions" :key="st" :value="st">
                {{ st === 'Semua' ? 'Semua Status' : st }}
              </option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="search"
              type="search"
              class="ed-input !min-h-[44px] flex-1 lg:!min-h-[40px] lg:!w-60 lg:flex-initial !py-2 !text-xs"
              placeholder="Cari kode, nama, WA, atau item..."
            />
            <button
              v-if="hasActiveFilters"
              type="button"
              class="ed-btn-ghost shrink-0 !text-xs"
              @click="resetFilters"
            >
              Reset
            </button>
          </div>
        </div>

        <div
          v-if="periodPreset === 'custom'"
          class="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <span class="text-xs font-medium" style="color: var(--srf-ink-3)">Periode:</span>
          <input
            v-model="periodStart"
            type="date"
            aria-label="Tanggal mulai periode"
            class="ed-input !min-h-[44px] sm:!min-h-[38px] sm:!w-44 !py-1.5 !text-xs tabular"
          />
          <span class="text-xs" style="color: var(--srf-ink-3)">s/d</span>
          <input
            v-model="periodEnd"
            type="date"
            aria-label="Tanggal selesai periode"
            class="ed-input !min-h-[44px] sm:!min-h-[38px] sm:!w-44 !py-1.5 !text-xs tabular"
          />
          <span v-if="invalidCustomRange" class="text-xs font-medium" style="color: var(--srf-warn-ink)">
            Tanggal mulai melewati tanggal selesai.
          </span>
        </div>
      </div>

      <div
        v-if="!allRows.length"
        class="px-4 py-10 text-center text-xs"
        style="color: var(--srf-ink-3)"
      >
        Belum ada transaksi rental maupun pendaftaran open trip yang tercatat.
      </div>

      <div
        v-else-if="!filteredRows.length"
        class="space-y-3 px-4 py-10 text-center text-xs"
        style="color: var(--srf-ink-3)"
      >
        <div>Tidak ada transaksi yang cocok dengan filter saat ini.</div>
        <button type="button" class="ed-btn-secondary !text-xs" @click="resetFilters">
          Reset Filter
        </button>
      </div>

      <template v-else>
        <div class="divide-y md:hidden" style="border-color: var(--srf-line)">
          <article
            v-for="row in filteredRows"
            :key="`mob-${row.uid}`"
            class="space-y-3 p-4"
            style="border-color: var(--srf-line)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="tabular text-xs font-semibold" style="color: var(--srf-ink)">
                  {{ row.code }}
                </div>
                <div class="tabular text-[11px]" style="color: var(--srf-ink-3)">
                  {{ row.periodText }}
                </div>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-1.5">
                <StatusBadge
                  variant="light"
                  :tone="row.type === 'rental' ? 'accent' : 'purple'"
                  :label="row.type === 'rental' ? 'Rental' : 'Trip'"
                />
                <StatusBadge variant="outline" :label="row.status" :tone="row.statusTone" />
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-sm font-semibold" style="color: var(--srf-ink)">
                {{ row.customerName }}
                <span class="tabular font-normal text-xs" style="color: var(--srf-ink-3)">
                  · {{ row.customerWa }}
                </span>
              </div>
              <div class="text-xs font-medium" style="color: var(--srf-ink-2)">
                {{ row.titleLine }}
              </div>
              <div class="text-[11px]" style="color: var(--srf-ink-3)">
                {{ row.subLine }}
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 pt-1">
              <div>
                <div class="tabular text-sm font-bold" style="color: var(--srf-ink)">
                  {{ formatRupiah(row.amount) }}
                </div>
                <div v-if="row.amountSub" class="tabular text-[11px]" style="color: var(--srf-warn-ink)">
                  {{ row.amountSub }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="ed-btn-secondary h-11 w-11 !p-0"
                  title="Edit transaksi"
                  :aria-label="`Edit ${row.code}`"
                  @click="openEditModal(row)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <a
                  :href="buildWaLink(row.customerWa, row.waText)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ed-btn-secondary h-11 w-11 !p-0"
                  style="color: var(--srf-good)"
                  title="Hubungi via WhatsApp"
                  :aria-label="`Hubungi ${row.customerName} via WhatsApp`"
                >
                  <WaIcon :size="16" />
                </a>
                <button
                  type="button"
                  class="ed-btn-secondary h-11 w-11 !p-0"
                  style="color: var(--srf-bad-ink)"
                  title="Hapus transaksi"
                  :aria-label="`Hapus ${row.code}`"
                  @click="openDeleteModal(row)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </article>
        </div>

        <div class="hidden overflow-x-auto px-2 pb-2 md:block">
          <table class="ed-table-dashed w-full border-collapse text-left text-sm">
            <thead>
              <tr class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--srf-ink-3)">
                <th class="px-4 py-3">Kode &amp; Periode</th>
                <th class="px-4 py-3">Jenis</th>
                <th class="px-4 py-3">Pelanggan</th>
                <th class="px-4 py-3">Ringkasan</th>
                <th class="px-4 py-3">Nominal</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.uid">
                <td class="px-4 py-3">
                  <div class="tabular text-xs font-semibold" style="color: var(--srf-ink)">
                    {{ row.code }}
                  </div>
                  <div class="tabular text-[11px]" style="color: var(--srf-ink-3)">
                    {{ row.periodText }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <StatusBadge
                    variant="light"
                    :tone="row.type === 'rental' ? 'accent' : 'purple'"
                    :label="row.type === 'rental' ? 'Rental' : 'Trip'"
                  />
                </td>
                <td class="px-4 py-3">
                  <div class="text-xs font-semibold" style="color: var(--srf-ink)">
                    {{ row.customerName }}
                  </div>
                  <div class="tabular text-[11px]" style="color: var(--srf-ink-3)">
                    {{ row.customerWa }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="text-xs font-semibold" style="color: var(--srf-ink)">
                    {{ row.titleLine }}
                  </div>
                  <div class="text-[11px]" style="color: var(--srf-ink-3)">
                    {{ row.subLine }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <div class="tabular text-xs font-semibold" style="color: var(--srf-ink)">
                    {{ formatRupiah(row.amount) }}
                  </div>
                  <div v-if="row.amountSub" class="tabular text-[11px]" style="color: var(--srf-warn-ink)">
                    {{ row.amountSub }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <StatusBadge variant="outline" :label="row.status" :tone="row.statusTone" />
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      class="ed-btn-secondary h-9 w-9 min-h-0 !p-0"
                      title="Edit transaksi"
                      :aria-label="`Edit ${row.code}`"
                      @click="openEditModal(row)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                    <a
                      :href="buildWaLink(row.customerWa, row.waText)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      style="color: var(--srf-good)"
                      title="Hubungi via WhatsApp"
                      :aria-label="`Hubungi ${row.customerName} via WhatsApp`"
                    >
                      <WaIcon :size="16" />
                    </a>
                    <button
                      type="button"
                      class="ed-btn-secondary h-9 w-9 min-h-0 !p-0"
                      style="color: var(--srf-bad-ink)"
                      title="Hapus transaksi"
                      :aria-label="`Hapus ${row.code}`"
                      @click="openDeleteModal(row)"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"
                          stroke="currentColor"
                          stroke-width="1.8"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <div
      v-if="showCreateModal"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
      @click.self="showCreateModal = false"
    >
      <div
        class="ed-card my-4 w-full max-w-2xl overflow-hidden shadow-xl sm:my-6"
        style="border-color: var(--srf-line-strong)"
      >
        <div
          class="flex items-center justify-between border-b px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <div>
            <p class="ed-label">TRANSAKSI BARU</p>
            <h2 class="text-lg font-bold">Tambah Transaksi</h2>
          </div>
          <button
            type="button"
            class="ed-btn-ghost !px-2.5 !py-1 text-xs font-bold"
            aria-label="Tutup modal"
            @click="showCreateModal = false"
          >
            X
          </button>
        </div>

        <div class="border-b px-5 py-3" style="border-color: var(--srf-line)">
          <div
            class="inline-flex rounded-[10px] border p-0.5 text-xs"
            style="background-color: var(--srf-well); border-color: var(--srf-line)"
          >
            <button
              type="button"
              class="min-h-[38px] cursor-pointer rounded-[8px] px-4 py-1.5 font-semibold"
              :style="
                createKind === 'rental'
                  ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-accent-ink)' }
                  : { color: 'var(--srf-ink-2)' }
              "
              @click="createKind = 'rental'"
            >
              Rental Alat
            </button>
            <button
              type="button"
              class="min-h-[38px] cursor-pointer rounded-[8px] px-4 py-1.5 font-semibold"
              :style="
                createKind === 'trip'
                  ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-purple-ink)' }
                  : { color: 'var(--srf-ink-2)' }
              "
              @click="createKind = 'trip'"
            >
              Open Trip
            </button>
          </div>
        </div>

        <div class="max-h-[68dvh] space-y-4 overflow-y-auto p-5 text-xs">
          <template v-if="createKind === 'rental'">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="ed-label">DATA PENYEWA &amp; JADWAL SEWA</span>
              <select
                v-if="penyewaOptions.length"
                v-model="quickPickPenyewaId"
                class="ed-select !w-auto !py-1.5 !text-xs"
              >
                <option :value="0">Isi dari penyewa lama...</option>
                <option v-for="p in penyewaOptions" :key="p.id" :value="p.id">
                  {{ p.nama }} · {{ p.noWa }}
                </option>
              </select>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">NAMA PENYEWA</label>
                <input v-model="createRentalForm.nama" type="text" class="ed-input !text-xs" placeholder="Nama lengkap" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">NO. WHATSAPP</label>
                <input v-model="createRentalForm.noWa" type="text" class="ed-input tabular !text-xs" placeholder="0812xxxxxxxx" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">JAMINAN FISIK</label>
                <select v-model="createRentalForm.jenisJaminan" class="ed-select !text-xs">
                  <option value="KTP">KTP</option>
                  <option value="SIM">SIM</option>
                  <option value="Kartu Pelajar">Kartu Pelajar</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">ALAMAT</label>
                <input v-model="createRentalForm.alamat" type="text" class="ed-input !text-xs" placeholder="Alamat domisili" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">TANGGAL PINJAM</label>
                <input v-model="createRentalForm.tanggalPinjam" type="datetime-local" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">RENCANA KEMBALI</label>
                <input v-model="createRentalForm.tanggalKembaliRencana" type="datetime-local" class="ed-input tabular !text-xs" />
              </div>
            </div>

            <div class="space-y-2 border-t pt-3" style="border-color: var(--srf-line)">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="ed-label">ALAT &amp; PAKET DISEWA</span>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="ed-btn-secondary !min-h-[34px] !px-3 !py-1 !text-[11px]"
                    :disabled="!paketOptions.length"
                    @click="addCreatePaketLine"
                  >
                    + Paket
                  </button>
                  <button
                    type="button"
                    class="ed-btn-secondary !min-h-[34px] !px-3 !py-1 !text-[11px]"
                    :disabled="!alatOptions.length"
                    @click="addCreateAlatLine"
                  >
                    + Alat Satuan
                  </button>
                </div>
              </div>

              <div v-if="rentalCatalogLoading" class="text-xs" style="color: var(--srf-ink-3)">
                Memuat daftar alat dan paket...
              </div>

              <div
                v-for="(pl, idx) in createRentalForm.paketLines"
                :key="`cp-${idx}`"
                class="flex items-center gap-2"
              >
                <select v-model.number="pl.idPaket" class="ed-select flex-1 !text-xs">
                  <option v-for="pkg in paketOptions" :key="pkg.id" :value="pkg.id">
                    {{ pkg.tipePaket === 'bundle' ? '[Bundle]' : '[Paket]' }} {{ pkg.namaPaket }} · {{ formatRupiah(pkg.hargaEfektif ?? pkg.tarifPaket) }}/24j
                  </option>
                </select>
                <input v-model.number="pl.qtyPaket" type="number" min="1" class="ed-input tabular !w-20 !text-xs" />
                <button
                  type="button"
                  class="cursor-pointer px-2 font-semibold"
                  style="color: var(--srf-bad-ink)"
                  @click="createRentalForm.paketLines.splice(idx, 1)"
                >
                  Hapus
                </button>
              </div>

              <div
                v-for="(line, idx) in createRentalForm.itemLines"
                :key="`ci-${idx}`"
                class="flex items-center gap-2"
              >
                <select v-model.number="line.idAlat" class="ed-select flex-1 !text-xs">
                  <option v-for="a in alatOptions" :key="a.id" :value="a.id">
                    {{ a.namaAlat }} · {{ formatRupiah(a.hargaEfektif ?? a.hargaHarian) }}/24j (Stok {{ a.stokTersedia }})
                  </option>
                </select>
                <input v-model.number="line.jumlah" type="number" min="1" class="ed-input tabular !w-20 !text-xs" />
                <button
                  type="button"
                  class="cursor-pointer px-2 font-semibold"
                  style="color: var(--srf-bad-ink)"
                  @click="createRentalForm.itemLines.splice(idx, 1)"
                >
                  Hapus
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="space-y-1">
              <label class="ed-label">JADWAL OPEN TRIP</label>
              <select v-model="createTripForm.idTrip" class="ed-select !text-xs">
                <option v-for="t in (tripRes?.trips ?? [])" :key="t.id" :value="t.id">
                  {{ t.judul }} · {{ t.tanggalBerangkat }} ({{ t.pesertaCount }}/{{ t.kuota }})
                </option>
              </select>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">PAKET TRIP</label>
                <select v-model="createTripForm.idTripPaket" class="ed-select !text-xs">
                  <option v-for="p in (selectedCreateTrip?.pakets ?? [])" :key="p.id" :value="p.id">
                    {{ p.kodePaket }} · {{ formatRupiah(p.harga) }}
                  </option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">MEETING POINT</label>
                <select v-model="createTripForm.idMeetingPoint" class="ed-select !text-xs">
                  <option v-for="m in (selectedCreateTrip?.meetingPoints ?? [])" :key="m.id" :value="m.id">
                    {{ m.namaLokasi }}
                  </option>
                </select>
              </div>
            </div>

            <div v-if="selectedCreateMepo?.isCustom" class="space-y-1">
              <label class="ed-label">LOKASI MEPO CUSTOM</label>
              <input v-model="createTripForm.mepoCustom" type="text" class="ed-input !text-xs" placeholder="Tulis lokasi titik kumpul..." />
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">NAMA PESERTA</label>
                <input v-model="createTripForm.nama" type="text" class="ed-input !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">NIK / KTP / SIM</label>
                <input v-model="createTripForm.noIdentitas" type="text" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">NO. WHATSAPP</label>
                <input v-model="createTripForm.noWa" type="text" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">KONTAK DARURAT</label>
                <input v-model="createTripForm.kontakDarurat" type="text" class="ed-input !text-xs" placeholder="Mis. Ibu (0812xxx)" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">STATUS BAYAR</label>
                <select v-model="createTripForm.statusBayar" class="ed-select !text-xs">
                  <option value="Lunas">Lunas</option>
                  <option value="DP 50%">DP 50%</option>
                  <option value="Belum Bayar">Belum Bayar</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">NOMINAL BAYAR</label>
                <input v-model.number="createTripForm.nominalBayar" type="number" min="0" class="ed-input tabular !text-xs" />
              </div>
            </div>

            <div class="space-y-1">
              <label class="ed-label">SEWA ALAT TAMBAHAN (OPSIONAL)</label>
              <input v-model="createTripForm.sewaAlatTambahan" type="text" class="ed-input !text-xs" placeholder="Mis. Headlamp, Trekking Pole" />
            </div>
          </template>

          <div
            v-if="createErr"
            class="rounded-[10px] border px-3.5 py-2.5 text-xs font-medium"
            style="
              background-color: var(--srf-bad-soft);
              border-color: var(--srf-bad-border);
              color: var(--srf-bad-ink);
            "
          >
            {{ createErr }}
          </div>
        </div>

        <div
          class="flex justify-end gap-2.5 border-t px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <button type="button" class="ed-btn-secondary !text-xs" @click="showCreateModal = false">
            Batal
          </button>
          <button type="button" class="ed-btn-primary !text-xs" :disabled="creating" @click="submitCreate">
            {{ creating ? 'Menyimpan...' : 'Simpan Transaksi' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="editTarget"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
      @click.self="editTarget = null"
    >
      <div
        class="ed-card my-4 w-full max-w-lg overflow-hidden shadow-xl sm:my-6"
        style="border-color: var(--srf-line-strong)"
      >
        <div
          class="flex items-center justify-between border-b px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <div>
            <p class="ed-label">
              EDIT {{ editTarget.type === 'rental' ? 'TRANSAKSI RENTAL' : 'PESERTA TRIP' }} · {{ editTarget.code }}
            </p>
            <h2 class="text-lg font-bold">{{ editTarget.customerName }}</h2>
          </div>
          <button
            type="button"
            class="ed-btn-ghost !px-2.5 !py-1 text-xs font-bold"
            aria-label="Tutup modal edit"
            @click="editTarget = null"
          >
            X
          </button>
        </div>

        <div class="max-h-[70dvh] space-y-4 overflow-y-auto p-5 text-xs">
          <template v-if="editTarget.type === 'rental' && editTarget.rentalRaw">
            <div class="ed-well space-y-1.5 p-3">
              <div class="ed-label">ITEM DISEWA ({{ editTarget.rentalRaw.items.length }})</div>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="(it, idx) in editTarget.rentalRaw.items"
                  :key="idx"
                  class="rounded-md border px-2.5 py-0.5 text-[11px] font-medium"
                  style="background-color: var(--srf-surface); border-color: var(--srf-line)"
                >
                  {{ it.namaAlat }} x{{ it.jumlah }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">STATUS SEWA</label>
                <select v-model="editRentalForm.statusSewa" class="ed-select !text-xs">
                  <option value="Disewa">Disewa</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">JAMINAN FISIK</label>
                <select v-model="editRentalForm.jenisJaminan" class="ed-select !text-xs">
                  <option value="KTP">KTP</option>
                  <option value="SIM">SIM</option>
                  <option value="Kartu Pelajar">Kartu Pelajar</option>
                </select>
              </div>
              <div class="space-y-1 sm:col-span-2">
                <label class="ed-label">RENCANA KEMBALI</label>
                <input v-model="editRentalForm.tanggalKembaliRencana" type="datetime-local" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">DENDA TELAT (RP)</label>
                <input v-model.number="editRentalForm.dendaTelat" type="number" min="0" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">DENDA RUSAK (RP)</label>
                <input v-model.number="editRentalForm.dendaRusak" type="number" min="0" class="ed-input tabular !text-xs" />
              </div>
            </div>
          </template>

          <template v-else-if="editTarget.type === 'trip'">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">NAMA PESERTA</label>
                <input v-model="editTripForm.nama" type="text" class="ed-input !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">NO. WHATSAPP</label>
                <input v-model="editTripForm.noWa" type="text" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1 sm:col-span-2">
                <label class="ed-label">KONTAK DARURAT</label>
                <input v-model="editTripForm.kontakDarurat" type="text" class="ed-input !text-xs" />
              </div>
              <div v-if="editTripMeta?.pakets.length" class="space-y-1">
                <label class="ed-label">PAKET TRIP</label>
                <select v-model="editTripForm.idTripPaket" class="ed-select !text-xs">
                  <option v-for="p in editTripMeta.pakets" :key="p.id" :value="p.id">
                    {{ p.kodePaket }} · {{ formatRupiah(p.harga) }}
                  </option>
                </select>
              </div>
              <div v-if="editTripMeta?.meetingPoints.length" class="space-y-1">
                <label class="ed-label">MEETING POINT</label>
                <select v-model="editTripForm.idMeetingPoint" class="ed-select !text-xs">
                  <option v-for="m in editTripMeta.meetingPoints" :key="m.id" :value="m.id">
                    {{ m.namaLokasi }}
                  </option>
                </select>
              </div>
              <div v-if="editTripMepo?.isCustom" class="space-y-1 sm:col-span-2">
                <label class="ed-label">LOKASI MEPO CUSTOM</label>
                <input v-model="editTripForm.mepoCustom" type="text" class="ed-input !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">STATUS PEMBAYARAN</label>
                <select v-model="editTripForm.statusBayar" class="ed-select !text-xs">
                  <option value="Lunas">Lunas</option>
                  <option value="DP 50%">DP 50%</option>
                  <option value="Belum Bayar">Belum Bayar</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">NOMINAL BAYAR (RP)</label>
                <input v-model.number="editTripForm.nominalBayar" type="number" min="0" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1 sm:col-span-2">
                <label class="ed-label">SEWA ALAT TAMBAHAN</label>
                <input v-model="editTripForm.sewaAlatTambahan" type="text" class="ed-input !text-xs" />
              </div>
            </div>
          </template>

          <div
            v-if="editErr"
            class="rounded-[10px] border px-3.5 py-2.5 text-xs font-medium"
            style="
              background-color: var(--srf-bad-soft);
              border-color: var(--srf-bad-border);
              color: var(--srf-bad-ink);
            "
          >
            {{ editErr }}
          </div>
        </div>

        <div
          class="flex justify-end gap-2.5 border-t px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <button type="button" class="ed-btn-secondary !text-xs" @click="editTarget = null">
            Batal
          </button>
          <button type="button" class="ed-btn-primary !text-xs" :disabled="savingEdit" @click="submitEdit">
            {{ savingEdit ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      @click.self="deleteTarget = null"
    >
      <div
        class="ed-card w-full max-w-sm space-y-4 p-5 text-center shadow-xl"
        style="border-color: var(--srf-line-strong)"
      >
        <div>
          <p class="ed-label" style="color: var(--srf-bad-ink)">KONFIRMASI HAPUS</p>
          <h3 class="mt-1 text-lg font-bold">{{ deleteTarget.code }} · {{ deleteTarget.customerName }}</h3>
          <p class="mt-1 text-xs" style="color: var(--srf-ink-2)">
            Yakin ingin menghapus transaksi {{ deleteTarget.type === 'rental' ? 'rental alat' : 'peserta open trip' }} ini?
          </p>
        </div>
        <div
          v-if="deleteErr"
          class="rounded-[10px] border px-3 py-2 text-xs font-medium"
          style="
            background-color: var(--srf-bad-soft);
            border-color: var(--srf-bad-border);
            color: var(--srf-bad-ink);
          "
        >
          {{ deleteErr }}
        </div>
        <div class="flex justify-center gap-2.5">
          <button type="button" class="ed-btn-secondary !text-xs" @click="deleteTarget = null">
            Batal
          </button>
          <button
            type="button"
            class="ed-btn-primary !text-xs"
            style="background-color: var(--srf-bad)"
            :disabled="deleting"
            @click="confirmDelete"
          >
            {{ deleting ? 'Menghapus...' : 'Ya, Hapus' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toastMsg"
      class="fixed bottom-5 right-5 z-50 rounded-[10px] border px-4 py-2 text-xs font-semibold shadow-lg"
      style="
        background-color: var(--srf-ink);
        border-color: var(--srf-line-strong);
        color: var(--srf-bg);
      "
    >
      {{ toastMsg }}
    </div>
  </div>
</template>
