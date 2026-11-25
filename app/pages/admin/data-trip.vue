<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface TripItinerarySchedule {
  time: string
  event: string
}

interface TripItineraryDay {
  day: string
  title: string
  desc?: string
  schedules: TripItinerarySchedule[]
}

interface TripRouteFilter {
  id: string
  label: string
}

interface TripFeatureComparison {
  feature: string
  pkgA: string
  pkgB: string
  pkgC: string
}

interface TripMepoPrice {
  mepo: string
  isCustom?: boolean
  pkgA: string
  pkgB: string
  pkgC: string
}

interface TripPackageCard {
  kodePaket: string
  namaPaket: string
  durasiKeterangan: string
  harga: number
  tag?: string
}

interface TripDetailData {
  elevation?: string
  difficulty?: string
  tipeTrip?: string
  deskripsi?: string
  gallery?: string[]
  packageCards?: TripPackageCard[]
  comparisons?: TripFeatureComparison[]
  mepoPrices?: TripMepoPrice[]
  routeFilters?: TripRouteFilter[]
  itineraryDays?: TripItineraryDay[]
  routeItineraries?: Record<string, TripItineraryDay[]>
}

interface TripPaket {
  id?: number
  kodePaket: string
  deskripsiFasilitas: string
  harga: number
}

interface TripMepo {
  id?: number
  namaLokasi: string
  isCustom: boolean
}

interface TripRow {
  id: number
  kodeTrip: string
  judul: string
  lokasi: string
  tanggalBerangkat: string
  durasi: string
  kuota: number
  foto: string | null
  itinerary: string
  detail?: TripDetailData
  statusPublish: 'Published' | 'Draft' | 'Penuh'
  pesertaCount: number
  hargaMulai: number
  pakets: TripPaket[]
  meetingPoints: TripMepo[]
}

interface TripsResponse {
  trips: TripRow[]
  kpis: {
    publishedCount: number
    draftCount: number
    totalPeserta: number
    totalKapasitas: number
  }
}

interface EditTripForm {
  id: number | null
  kodeTrip: string
  judul: string
  lokasi: string
  tanggalBerangkat: string
  durasi: string
  kuota: number
  foto: string | null
  gallery: string[]
  statusPublish: 'Published' | 'Draft' | 'Penuh'
  elevation: string
  difficulty: (typeof DIFFICULTIES)[number]
  tipeTrip: string
  deskripsi: string
  packageCards: TripPackageCard[]
  comparisons: TripFeatureComparison[]
  mepoPrices: TripMepoPrice[]
  routeFilters: TripRouteFilter[]
  itineraryDays: TripItineraryDay[]
  routeItineraries: Record<string, TripItineraryDay[]>
}

const DIFFICULTIES = ['Pemula', 'Pemula - Menengah', 'Menengah', 'Menengah - Menantang', 'Sulit'] as const

const DEFAULT_COMPARISONS: TripFeatureComparison[] = [
  { feature: 'Transportasi PP Meeting Point - Basecamp', pkgA: 'Termasuk', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'Tiket Simaksi Pendakian', pkgA: 'Termasuk', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'Guide Lokal & Sweeper Tim', pkgA: 'Termasuk', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'First Aid Kit / P3K Standar Tim', pkgA: 'Termasuk', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'Porter Tenda & Peralatan Masak Tim', pkgA: '-', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'Tenda Double Layer & Matras Camp', pkgA: '-', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'Makan Selama Camp (Malam & Pagi)', pkgA: '-', pkgB: 'Termasuk', pkgC: 'Termasuk' },
  { feature: 'Sleeping Bag, Headlamp & Trekking Pole', pkgA: '-', pkgB: '-', pkgC: 'Termasuk' },
  { feature: 'Dokumentasi Khusus VIP & Sertifikat PDF', pkgA: '-', pkgB: '-', pkgC: 'Termasuk' },
]

function defaultPackageCards(): TripPackageCard[] {
  return [
    { kodePaket: 'Paket A', namaPaket: 'Paket A - Hemat', durasiKeterangan: 'Start Basecamp / 2D1N', harga: 350000 },
    { kodePaket: 'Paket B', namaPaket: 'Paket B - Full Inclusive', durasiKeterangan: 'Start Kota / 2D1N', harga: 450000, tag: 'POPULER' },
    { kodePaket: 'Paket C', namaPaket: 'Paket C - Premium All-In', durasiKeterangan: 'Start VIP / 2D1N', harga: 625000 },
  ]
}

function defaultItineraryDays(summaryText = ''): TripItineraryDay[] {
  return [
    {
      day: 'Hari 1',
      title: 'Meeting Point & Pendakian Awal',
      desc: summaryText || 'Registrasi peserta, briefing perlengkapan, dan perjalanan menuju pos camp.',
      schedules: [
        { time: '07:00 - 09:00', event: 'Berkumpul di meeting point & cek logistik' },
        { time: '10:00 - 15:00', event: 'Pendakian menuju area camp & dirikan tenda' },
      ],
    },
    {
      day: 'Hari 2',
      title: 'Summit Attack & Perjalanan Pulang',
      desc: 'Menikmati matahari terbit di puncak lalu turun kembali ke basecamp.',
      schedules: [
        { time: '03:30 - 06:30', event: 'Summit attack & dokumentasi sunrise' },
        { time: '09:00 - 13:00', event: 'Turun ke basecamp & trip selesai' },
      ],
    },
  ]
}

function emptyTripForm(): EditTripForm {
  return {
    id: null,
    kodeTrip: `TRIP-${Date.now().toString().slice(-3)}`,
    judul: '',
    lokasi: '',
    tanggalBerangkat: '',
    durasi: '2D1N',
    kuota: 20,
    foto: null,
    gallery: [],
    statusPublish: 'Draft',
    elevation: '',
    difficulty: 'Menengah',
    tipeTrip: 'OPEN TRIP · 2D1N',
    deskripsi: '',
    packageCards: defaultPackageCards(),
    comparisons: DEFAULT_COMPARISONS.map((c) => ({ ...c })),
    mepoPrices: [
      { mepo: 'Jakarta - Halim', isCustom: false, pkgA: 'Rp 550.000', pkgB: 'Rp 850.000', pkgC: 'Rp 1.250.000' },
      { mepo: 'Basecamp Merayau Sleman', isCustom: false, pkgA: 'Rp 350.000', pkgB: 'Rp 450.000', pkgC: 'Rp 625.000' },
      { mepo: 'Lainnya (atur lokasi sendiri)', isCustom: true, pkgA: '-', pkgB: '-', pkgC: '-' },
    ],
    routeFilters: [],
    itineraryDays: defaultItineraryDays(),
    routeItineraries: {},
  }
}

const search = ref('')
const statusTab = ref<'Semua' | 'Published' | 'Draft' | 'Penuh'>('Semua')
const { data, pending, refresh } = await useFetch<TripsResponse>('/api/admin/trips')

const filtered = computed(() => {
  const list = data.value?.trips ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter((t) => {
    if (statusTab.value !== 'Semua' && t.statusPublish !== statusTab.value) return false
    if (
      q &&
      !t.judul.toLowerCase().includes(q) &&
      !t.lokasi.toLowerCase().includes(q) &&
      !t.kodeTrip.toLowerCase().includes(q)
    ) {
      return false
    }
    return true
  })
})

const editForm = ref<EditTripForm | null>(null)
const isNew = ref(false)
const activeSection = ref<'info' | 'packages' | 'mepo' | 'itinerary' | 'all'>('info')
const activeRouteId = ref<string>('default')
const saving = ref(false)
const modalErr = ref('')

const deleteTarget = ref<TripRow | null>(null)
const deleteErr = ref('')
const deleting = ref(false)

const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 3000)
}

function hydratePackageCards(trip: TripRow): TripPackageCard[] {
  const detailCards = trip.detail?.packageCards
  if (detailCards && detailCards.length === 3) {
    return detailCards.map((c) => ({ ...c }))
  }
  const base = defaultPackageCards()
  const byKode = new Map(trip.pakets.map((p) => [p.kodePaket, p]))
  return base.map((card, idx) => {
    const match = byKode.get(card.kodePaket) ?? trip.pakets[idx]
    if (!match) return card
    const raw = (match.deskripsiFasilitas ?? '').trim()
    const parenMatch = /^([^(]+)\(([^)]+)\)/.exec(raw)
    const parsedName = parenMatch ? parenMatch[1]!.trim() : raw.split(' · ')[0]?.trim()
    const parsedDesc = parenMatch
      ? parenMatch[2]!.trim()
      : raw.split(' · ')[1]?.trim() || trip.durasi || card.durasiKeterangan
    return {
      ...card,
      namaPaket: parsedName || card.namaPaket,
      durasiKeterangan: parsedDesc,
      harga: match.harga,
    }
  })
}

function hydrateMepoPrices(trip: TripRow): TripMepoPrice[] {
  if (trip.detail?.mepoPrices?.length) {
    return trip.detail.mepoPrices.map((m) => ({ ...m }))
  }
  const cards = hydratePackageCards(trip)
  const fmtA = cards[0] ? formatRupiah(cards[0].harga) : '-'
  const fmtB = cards[1] ? formatRupiah(cards[1].harga) : '-'
  const fmtC = cards[2] ? formatRupiah(cards[2].harga) : '-'
  return trip.meetingPoints.map((m) => ({
    mepo: m.namaLokasi,
    isCustom: m.isCustom,
    pkgA: m.isCustom ? '-' : fmtA,
    pkgB: m.isCustom ? '-' : fmtB,
    pkgC: m.isCustom ? '-' : fmtC,
  }))
}

function openNew() {
  editForm.value = emptyTripForm()
  isNew.value = true
  activeSection.value = 'info'
  activeRouteId.value = 'default'
  modalErr.value = ''
}

function openEdit(trip: TripRow) {
  const d = trip.detail ?? {}

  const clonedRouteItins: Record<string, TripItineraryDay[]> = {}
  if (d.routeItineraries) {
    for (const [k, days] of Object.entries(d.routeItineraries)) {
      clonedRouteItins[k] = days.map((day) => ({
        ...day,
        schedules: (day.schedules ?? []).map((s) => ({ ...s })),
      }))
    }
  }

  const diffVal = DIFFICULTIES.includes(d.difficulty as (typeof DIFFICULTIES)[number])
    ? (d.difficulty as (typeof DIFFICULTIES)[number])
    : 'Menengah'

  editForm.value = {
    id: trip.id,
    kodeTrip: trip.kodeTrip,
    judul: trip.judul,
    lokasi: trip.lokasi,
    tanggalBerangkat: trip.tanggalBerangkat,
    durasi: trip.durasi,
    kuota: trip.kuota,
    foto: trip.foto,
    gallery: (d.gallery ?? []).filter((g) => Boolean(g?.trim())),
    statusPublish: trip.statusPublish,
    elevation: d.elevation || '',
    difficulty: diffVal,
    tipeTrip: d.tipeTrip || `OPEN TRIP · ${trip.durasi}`,
    deskripsi: d.deskripsi || '',
    packageCards: hydratePackageCards(trip),
    comparisons: d.comparisons?.length
      ? d.comparisons.map((c) => ({ ...c }))
      : DEFAULT_COMPARISONS.map((c) => ({ ...c })),
    mepoPrices: hydrateMepoPrices(trip),
    routeFilters: (d.routeFilters ?? []).map((rf) => ({ ...rf })),
    itineraryDays: d.itineraryDays?.length
      ? d.itineraryDays.map((day) => ({
        ...day,
        schedules: (day.schedules ?? []).map((s) => ({ ...s })),
      }))
      : defaultItineraryDays(trip.itinerary),
    routeItineraries: clonedRouteItins,
  }
  isNew.value = false
  activeSection.value = 'info'
  activeRouteId.value = 'default'
  modalErr.value = ''
}

function closeModal() {
  editForm.value = null
  modalErr.value = ''
}

function addComparisonRow() {
  editForm.value?.comparisons.push({ feature: '', pkgA: '', pkgB: '', pkgC: '' })
}

function removeComparisonRow(idx: number) {
  editForm.value?.comparisons.splice(idx, 1)
}

function moveComparisonRow(idx: number, dir: 'up' | 'down') {
  if (!editForm.value) return
  const arr = editForm.value.comparisons
  const target = dir === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= arr.length) return
  const tmp = arr[idx]!
  arr[idx] = arr[target]!
  arr[target] = tmp
}

function addGallerySlot() {
  if (!editForm.value || editForm.value.gallery.length >= 5) return
  editForm.value.gallery.push('')
}

function removeGallerySlot(idx: number) {
  editForm.value?.gallery.splice(idx, 1)
}

function addMepoRow() {
  editForm.value?.mepoPrices.push({
    mepo: '',
    isCustom: false,
    pkgA: '-',
    pkgB: 'Rp 500.000',
    pkgC: 'Rp 800.000',
  })
}

function removeMepoRow(idx: number) {
  editForm.value?.mepoPrices.splice(idx, 1)
}

function getActiveItineraryList(): TripItineraryDay[] {
  if (!editForm.value) return []
  if (activeRouteId.value !== 'default') {
    return editForm.value.routeItineraries[activeRouteId.value] ?? []
  }
  return editForm.value.itineraryDays
}

function setActiveItineraryList(next: TripItineraryDay[]) {
  if (!editForm.value) return
  if (activeRouteId.value === 'default') {
    editForm.value.itineraryDays = next
  } else {
    editForm.value.routeItineraries[activeRouteId.value] = next
  }
}

function addRouteFilter() {
  if (!editForm.value) return
  const newId = `route_${Date.now()}`
  editForm.value.routeFilters.push({ id: newId, label: 'Start Jalur Baru · 2D1N' })
  editForm.value.routeItineraries[newId] = editForm.value.itineraryDays.map((d) => ({
    ...d,
    schedules: d.schedules.map((s) => ({ ...s })),
  }))
  activeRouteId.value = newId
}

const activeRouteLabel = computed({
  get() {
    return editForm.value?.routeFilters.find((rf) => rf.id === activeRouteId.value)?.label ?? ''
  },
  set(val: string) {
    const found = editForm.value?.routeFilters.find((rf) => rf.id === activeRouteId.value)
    if (found) found.label = val
  },
})

function removeRouteFilter(id: string) {
  if (!editForm.value) return
  editForm.value.routeFilters = editForm.value.routeFilters.filter((rf) => rf.id !== id)
  delete editForm.value.routeItineraries[id]
  if (activeRouteId.value === id) activeRouteId.value = 'default'
}

function addItineraryDay() {
  const current = getActiveItineraryList()
  setActiveItineraryList([
    ...current,
    {
      day: `Hari ${current.length + 1}`,
      title: '',
      desc: '',
      schedules: [{ time: '08:00 - 10:00', event: '' }],
    },
  ])
}

function removeItineraryDay(dayIdx: number) {
  const current = getActiveItineraryList()
  setActiveItineraryList(current.filter((_, i) => i !== dayIdx))
}

function moveItineraryDay(dayIdx: number, dir: 'up' | 'down') {
  const current = [...getActiveItineraryList()]
  const target = dir === 'up' ? dayIdx - 1 : dayIdx + 1
  if (target < 0 || target >= current.length) return
  const tmp = current[dayIdx]!
  current[dayIdx] = current[target]!
  current[target] = tmp
  setActiveItineraryList(current)
}

function addItinerarySchedule(dayIdx: number) {
  const current = [...getActiveItineraryList()]
  const day = current[dayIdx]
  if (!day) return
  day.schedules.push({ time: '08:00 - 10:00', event: '' })
  setActiveItineraryList(current)
}

function removeItinerarySchedule(dayIdx: number, schedIdx: number) {
  const current = [...getActiveItineraryList()]
  const day = current[dayIdx]
  if (!day) return
  day.schedules.splice(schedIdx, 1)
  setActiveItineraryList(current)
}

function moveItinerarySchedule(dayIdx: number, schedIdx: number, dir: 'up' | 'down') {
  const current = [...getActiveItineraryList()]
  const day = current[dayIdx]
  if (!day) return
  const target = dir === 'up' ? schedIdx - 1 : schedIdx + 1
  if (target < 0 || target >= day.schedules.length) return
  const tmp = day.schedules[schedIdx]!
  day.schedules[schedIdx] = day.schedules[target]!
  day.schedules[target] = tmp
  setActiveItineraryList(current)
}

const draggedSched = ref<{ dayIdx: number; schedIdx: number } | null>(null)

function onDropSchedule(dayIdx: number, targetIdx: number) {
  if (!draggedSched.value || draggedSched.value.dayIdx !== dayIdx) return
  const sourceIdx = draggedSched.value.schedIdx
  draggedSched.value = null
  if (sourceIdx === targetIdx) return
  const current = [...getActiveItineraryList()]
  const day = current[dayIdx]
  if (!day) return
  const [moved] = day.schedules.splice(sourceIdx, 1)
  if (moved) {
    day.schedules.splice(targetIdx, 0, moved)
    setActiveItineraryList(current)
  }
}

async function handleSave() {
  if (!editForm.value) return
  modalErr.value = ''
  const f = editForm.value

  if (f.judul.trim().length < 3 || f.lokasi.trim().length < 2) {
    modalErr.value = 'Judul trip dan lokasi wajib diisi (minimal 3 karakter).'
    return
  }

  const validMepos = f.mepoPrices
    .filter((m) => m.mepo.trim().length >= 2)
    .map((m) => ({
      namaLokasi: m.mepo.trim(),
      isCustom: Boolean(m.isCustom),
    }))

  if (!validMepos.length) {
    modalErr.value = 'Isi minimal 1 lokasi meeting point di tab Harga MEPO.'
    return
  }

  const syncedPakets = f.packageCards.map((card, idx) => {
    const kode = card.kodePaket || `Paket ${String.fromCharCode(65 + idx)}`
    const descParts = [card.namaPaket.trim(), card.durasiKeterangan.trim()].filter(Boolean)
    return {
      kodePaket: kode,
      deskripsiFasilitas: (descParts.join(' · ') || kode).slice(0, 160),
      harga: Math.max(1000, Math.round(Number(card.harga) || 350000)),
    }
  })

  const detailPayload: TripDetailData = {
    elevation: f.elevation.trim(),
    difficulty: f.difficulty,
    tipeTrip: f.tipeTrip.trim(),
    deskripsi: f.deskripsi.trim(),
    gallery: f.gallery.map((g) => g.trim()).filter(Boolean).slice(0, 5),
    packageCards: f.packageCards.map((c) => ({
      ...c,
      harga: Math.max(1000, Math.round(Number(c.harga) || 350000)),
    })),
    comparisons: f.comparisons.filter((c) => c.feature.trim() || c.pkgA || c.pkgB || c.pkgC),
    mepoPrices: f.mepoPrices.filter((m) => m.mepo.trim().length >= 2),
    routeFilters: f.routeFilters.filter((rf) => rf.label.trim().length > 0),
    itineraryDays: f.itineraryDays,
    routeItineraries: f.routeItineraries,
  }

  const payload = {
    kodeTrip: f.kodeTrip.trim() || undefined,
    judul: f.judul.trim(),
    lokasi: f.lokasi.trim(),
    tanggalBerangkat: f.tanggalBerangkat.trim() || 'Jadwal Fleksibel',
    durasi: f.durasi.trim() || '2D1N',
    kuota: Math.max(1, Number(f.kuota) || 20),
    foto: f.foto,
    statusPublish: f.statusPublish,
    pakets: syncedPakets,
    meetingPoints: validMepos,
    detail: detailPayload,
  }

  saving.value = true
  try {
    if (isNew.value) {
      await $fetch('/api/admin/trips', { method: 'POST', body: payload })
      showToast('Trip baru berhasil ditambahkan.')
    } else if (f.id) {
      await $fetch(`/api/admin/trips/${f.id}`, { method: 'PUT', body: payload })
      showToast('Data trip berhasil diperbarui.')
    }
    editForm.value = null
    await refresh()
  } catch (err: unknown) {
    modalErr.value =
      (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage ||
      'Gagal menyimpan data trip.'
  } finally {
    saving.value = false
  }
}

const togglingId = ref<number | null>(null)

async function toggleStatus(trip: TripRow) {
  const nextStatus = trip.statusPublish === 'Published' ? 'Draft' : 'Published'
  togglingId.value = trip.id
  try {
    await $fetch(`/api/admin/trips/${trip.id}`, {
      method: 'PUT',
      body: { statusPublish: nextStatus },
    })
    await refresh()
    showToast(`Status ${trip.judul} diubah ke ${nextStatus}.`)
  } catch (err: unknown) {
    showToast(
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ||
      'Gagal mengubah status trip.',
    )
  } finally {
    togglingId.value = null
  }
}

function askDelete(trip: TripRow) {
  deleteErr.value = ''
  deleteTarget.value = trip
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteErr.value = ''
  try {
    await $fetch(`/api/admin/trips/${deleteTarget.value.id}`, { method: 'DELETE' })
    const name = deleteTarget.value.judul
    deleteTarget.value = null
    await refresh()
    showToast(`Trip "${name}" dihapus.`)
  } catch (err: unknown) {
    deleteErr.value =
      (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage ||
      'Trip tidak dapat dihapus.'
  } finally {
    deleting.value = false
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (deleteTarget.value) {
    deleteTarget.value = null
  } else if (editForm.value) {
    closeModal()
  }
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
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">
          MANAJEMEN JADWAL OPEN TRIP
        </p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">Manajemen Trip Gunung</h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          {{ data?.kpis.publishedCount ?? 0 }} aktif dari {{ data?.trips.length ?? 0 }} total trip · kelola foto trip,
          Paket A/B/C, perbandingan fitur, harga MEPO, dan itinerary per jalur.
        </p>
      </div>
      <button type="button" class="ed-btn-primary" @click="openNew">
        + Tambah Trip Gunung
      </button>
    </div>

    <div v-if="data" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="ed-card p-4" style="border-color: var(--srf-accent)">
        <div class="text-xs font-medium" style="color: var(--srf-accent)">Trip Aktif (Published)</div>
        <div class="font-serif-display tabular mt-1 text-2xl font-bold">
          {{ data.kpis.publishedCount }} jadwal
        </div>
        <div class="mt-0.5 text-xs" style="color: var(--srf-ink-3)">Siap pendaftaran peserta</div>
      </div>
      <div class="ed-card p-4">
        <div class="text-xs font-medium" style="color: var(--srf-ink-2)">Total Peserta Terdaftar</div>
        <div class="font-serif-display tabular mt-1 text-2xl font-bold">
          {{ data.kpis.totalPeserta }} orang
        </div>
        <div class="mt-0.5 text-xs" style="color: var(--srf-ink-3)">
          Dari {{ data.kpis.totalKapasitas }} kapasitas total
        </div>
      </div>
      <div class="ed-card p-4">
        <div class="text-xs font-medium" style="color: var(--srf-ink-2)">Draft Belum Publish</div>
        <div class="font-serif-display tabular mt-1 text-2xl font-bold">
          {{ data.kpis.draftCount }} jadwal
        </div>
        <div class="mt-0.5 text-xs" style="color: var(--srf-ink-3)">Menunggu finalisasi paket</div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <input v-model="search" type="search" class="ed-input !w-72 !py-1.5 !text-xs"
        placeholder="Cari nama gunung, lokasi, atau kode trip..." />
      <div class="inline-flex rounded-md border p-0.5 text-xs"
        style="background-color: var(--srf-well); border-color: var(--srf-line)">
        <button v-for="tab in (['Semua', 'Published', 'Draft', 'Penuh'] as const)" :key="tab" type="button"
          class="cursor-pointer rounded px-3 py-1 font-medium" :style="statusTab === tab
            ? { backgroundColor: 'var(--srf-raised)', color: 'var(--srf-ink)' }
            : { color: 'var(--srf-ink-2)' }
            " @click="statusTab = tab">
          {{ tab }}
        </button>
      </div>
    </div>

    <div class="ed-card overflow-hidden">
      <div v-if="pending && !data" class="p-8 text-sm" style="color: var(--srf-ink-3)">
        Memuat daftar jadwal trip...
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-2)">
              <th class="px-4 py-3">Gunung / Trip</th>
              <th class="px-4 py-3">Lokasi</th>
              <th class="px-4 py-3">Harga Mulai</th>
              <th class="px-4 py-3">Kesulitan &amp; Kuota</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filtered.length">
              <td colspan="6" class="px-4 py-8 text-center text-xs" style="color: var(--srf-ink-3)">
                Belum ada trip yang cocok dengan filter saat ini. Klik "+ Tambah Trip Gunung" untuk membuat baru.
              </td>
            </tr>
            <tr v-for="trip in filtered" :key="trip.id" class="border-b last:border-b-0 transition-colors"
              style="border-color: var(--srf-line)">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <div class="h-9 w-12 shrink-0 overflow-hidden rounded border"
                    style="background-color: var(--srf-well); border-color: var(--srf-line)">
                    <img v-if="trip.foto" :src="trip.foto" :alt="trip.judul" class="h-full w-full object-cover" />
                    <GearArtThumb v-else kind="trip" />
                  </div>
                  <div>
                    <div class="font-semibold">{{ trip.judul }}</div>
                    <div class="text-xs" style="color: var(--srf-ink-3)">
                      {{ trip.detail?.elevation ? `${trip.detail.elevation} · ` : '' }}{{ trip.tanggalBerangkat }} · {{
                        trip.durasi }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-xs">
                <div class="font-medium">{{ trip.lokasi }}</div>
                <div style="color: var(--srf-ink-3)">{{ trip.meetingPoints.length }} titik MEPO</div>
              </td>
              <td class="px-4 py-3">
                <div class="tabular text-xs font-semibold">{{ formatRupiah(trip.hargaMulai) }}</div>
                <div class="text-[11px]" style="color: var(--srf-ink-3)">
                  {{trip.pakets.map((p) => p.kodePaket.replace('Paket ', '')).join(' · ')}}
                </div>
              </td>
              <td class="px-4 py-3 text-xs">
                <span class="inline-block rounded border px-2 py-0.5 text-[11px] font-medium"
                  style="background-color: var(--srf-well); border-color: var(--srf-line)">
                  {{ trip.detail?.difficulty || 'Menengah' }}
                </span>
                <div class="tabular mt-1" style="color: var(--srf-ink-3)">
                  {{ trip.pesertaCount }} / {{ trip.kuota }} peserta
                </div>
              </td>
              <td class="px-4 py-3">
                <button type="button"
                  class="cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--srf-accent)]"
                  :disabled="togglingId === trip.id" title="Klik untuk toggle Published / Draft"
                  @click="toggleStatus(trip)">
                  <StatusBadge :label="trip.statusPublish" :tone="trip.statusPublish === 'Published'
                    ? 'good'
                    : trip.statusPublish === 'Draft'
                      ? 'warn'
                      : 'accent'
                    " />
                </button>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <NuxtLink
                    v-if="trip.statusPublish !== 'Draft'"
                    :to="`/trip/${trip.id}`"
                    target="_blank"
                    class="ed-btn-secondary !px-2.5 !py-1.5 !text-xs"
                    title="Lihat halaman booking publik"
                  >
                    Preview ↗
                  </NuxtLink>
                  <button type="button" class="ed-btn-secondary !px-3 !py-1.5 !text-xs" @click="openEdit(trip)">
                    Edit
                  </button>
                  <button type="button" class="ed-btn-secondary !px-3 !py-1.5 !text-xs" style="color: var(--srf-bad)"
                    @click="askDelete(trip)">
                    Hapus
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="editForm" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
      @click.self="closeModal">
      <div class="ed-card my-6 w-full max-w-3xl overflow-hidden shadow-xl" style="border-color: var(--srf-line-strong)">
        <div class="flex items-center justify-between border-b px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)">
          <div>
            <p class="ed-label" style="color: var(--srf-accent)">
              {{ isNew ? 'JADWAL TRIP BARU' : `EDITOR TRIP · ${editForm.kodeTrip}` }}
            </p>
            <h2 class="font-serif-display text-lg font-bold">
              {{ isNew ? 'Form Tambah Trip Gunung' : `Form Edit Trip: ${editForm.judul}` }}
            </h2>
          </div>
          <button type="button" class="ed-btn-ghost !px-2.5 !py-1 text-sm font-bold" aria-label="Tutup modal"
            @click="closeModal">
            X
          </button>
        </div>

        <div class="flex flex-wrap gap-1.5 border-b px-5 py-2.5 text-xs"
          style="background-color: var(--srf-surface); border-color: var(--srf-line)">
          <button v-for="tab in ([
            { key: 'info', label: '1. Informasi & Foto' },
            { key: 'packages', label: '2. Paket & Include' },
            { key: 'mepo', label: `3. Harga MEPO (${editForm.mepoPrices.length})` },
            { key: 'itinerary', label: '4. Itinerary & Jalur' },
            { key: 'all', label: 'Semua' },
          ] as const)" :key="tab.key" type="button"
            class="cursor-pointer rounded border px-3 py-1.5 font-semibold transition-colors" :style="activeSection === tab.key
              ? {
                backgroundColor: 'var(--srf-accent)',
                borderColor: 'var(--srf-accent)',
                color: 'var(--srf-btn-ink)',
              }
              : {
                backgroundColor: 'var(--srf-raised)',
                borderColor: 'var(--srf-line)',
                color: 'var(--srf-ink-2)',
              }
              " @click="activeSection = tab.key">
            {{ tab.label }}
          </button>
        </div>

        <div class="max-h-[70vh] space-y-6 overflow-y-auto p-5">
          <section v-if="activeSection === 'info' || activeSection === 'all'" class="space-y-4">
            <div class="rounded border px-3 py-1.5 text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-accent)">
              SECTION 1: INFORMASI UTAMA &amp; FOTO TRIP
            </div>

            <AdminImageUpload v-model="editForm.foto" folder="trip"
              label="FOTO UTAMA GUNUNG (JPG / PNG / WEBP · MAKS 2MB)" fallback-kind="trip" />

            <div class="space-y-2.5 rounded-md border p-3"
              style="background-color: var(--srf-well); border-color: var(--srf-line)">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span class="ed-label">GALERI DOKUMENTASI TRIP (MAKS 5 FOTO)</span>
                  <p class="mt-0.5 text-[11px]" style="color: var(--srf-ink-3)">
                    Ditampilkan sebagai 5 foto di Galeri Kipas halaman utama saat gunung ini dipilih.
                  </p>
                </div>
                <button
                  v-if="editForm.gallery.length < 5"
                  type="button"
                  class="ed-btn-secondary !px-2.5 !py-1 !text-xs"
                  @click="addGallerySlot"
                >
                  + Tambah Foto Galeri
                </button>
              </div>

              <div v-if="!editForm.gallery.length" class="text-xs" style="color: var(--srf-ink-3)">
                Belum ada foto galeri tambahan (halaman utama akan memakai foto preset gunung terkait).
              </div>

              <div v-else class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div
                  v-for="(_, gIdx) in editForm.gallery"
                  :key="`gal-${gIdx}`"
                  class="space-y-1.5 rounded border p-2"
                  style="background-color: var(--srf-raised); border-color: var(--srf-line)"
                >
                  <div class="flex items-center justify-between">
                    <span class="ed-label">FOTO GALERI {{ gIdx + 1 }}</span>
                    <button
                      type="button"
                      class="cursor-pointer text-[11px] font-semibold hover:underline"
                      style="color: var(--srf-bad)"
                      @click="removeGallerySlot(gIdx)"
                    >
                      Hapus Slot
                    </button>
                  </div>
                  <AdminImageUpload
                    v-model="editForm.gallery[gIdx]"
                    folder="trip"
                    label="UPLOAD FOTO DOKUMENTASI"
                    fallback-kind="trip"
                  />
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">NAMA GUNUNG / JUDUL TRIP *</label>
                <input v-model="editForm.judul" type="text" class="ed-input"
                  placeholder="cth: Gunung Prau via Patak Banteng" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">LOKASI *</label>
                <input v-model="editForm.lokasi" type="text" class="ed-input" placeholder="cth: Dieng, Jawa Tengah" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">ELEVASI</label>
                <input v-model="editForm.elevation" type="text" class="ed-input" placeholder="cth: 2.565 mdpl" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">DURASI</label>
                <input v-model="editForm.durasi" type="text" class="ed-input" placeholder="cth: 2D1N" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">TANGGAL BERANGKAT</label>
                <input v-model="editForm.tanggalBerangkat" type="text" class="ed-input"
                  placeholder="cth: 12-14 Des 2026" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">KUOTA PESERTA</label>
                <input v-model.number="editForm.kuota" type="number" min="1" class="ed-input tabular" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">TINGKAT KESULITAN</label>
                <select v-model="editForm.difficulty" class="ed-select">
                  <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">TIPE TRIP</label>
                <input v-model="editForm.tipeTrip" type="text" class="ed-input"
                  placeholder="cth: OPEN TRIP · 2D1N (START JAKARTA)" />
              </div>
            </div>

            <div class="space-y-1">
              <label class="ed-label">DESKRIPSI SINGKAT</label>
              <textarea v-model="editForm.deskripsi" rows="3" class="ed-textarea"
                placeholder="Ceritakan highlight dan rute singkat gunung ini..." />
            </div>
          </section>

          <section v-if="activeSection === 'packages' || activeSection === 'all'" class="space-y-4"
            :class="activeSection === 'all' ? 'border-t pt-5' : ''" style="border-color: var(--srf-line)">
            <div class="rounded border px-3 py-1.5 text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-accent)">
              SECTION 2: PENGATURAN HARGA PAKET (PAKET A, B, C) &amp; FITUR INCLUDE
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div v-for="(pkg, idx) in editForm.packageCards" :key="pkg.kodePaket" class="ed-well space-y-2.5 p-3">
                <div class="flex items-center justify-between">
                  <span class="rounded px-2 py-0.5 text-[11px] font-semibold"
                    style="background-color: var(--srf-accent); color: var(--srf-btn-ink)">
                    {{ pkg.kodePaket }}
                  </span>
                  <input v-model="pkg.tag" type="text" class="ed-input !w-24 !px-2 !py-0.5 !text-[10px]"
                    placeholder="Tag (POPULER)" :aria-label="`Tag ${pkg.kodePaket}`" />
                </div>
                <div class="space-y-1">
                  <label class="ed-label">NAMA PAKET</label>
                  <input v-model="pkg.namaPaket" type="text" class="ed-input !py-1.5 !text-xs" />
                </div>
                <div class="space-y-1">
                  <label class="ed-label">KETERANGAN / DURASI</label>
                  <input v-model="pkg.durasiKeterangan" type="text" class="ed-input !py-1.5 !text-xs" />
                </div>
                <div class="space-y-1">
                  <label class="ed-label">HARGA DASAR (RP)</label>
                  <input v-model.number="pkg.harga" type="number" min="1000"
                    class="ed-input tabular !py-1.5 !text-xs font-semibold" />
                </div>
              </div>
            </div>

            <div class="space-y-3 border-t pt-4" style="border-color: var(--srf-line)">
              <div class="flex items-center justify-between gap-2">
                <span class="ed-label">
                  PERBANDINGAN FITUR PAKET ({{ editForm.comparisons.length }})
                </span>
                <button type="button" class="ed-btn-secondary !px-3 !py-1 !text-xs" @click="addComparisonRow">
                  + Tambah Fitur
                </button>
              </div>

              <div v-if="!editForm.comparisons.length" class="ed-well p-4 text-center text-xs"
                style="color: var(--srf-ink-3)">
                Belum ada perbandingan fitur. Klik "+ Tambah Fitur" untuk menambah baris baru.
              </div>

              <div v-else class="space-y-2.5">
                <div v-for="(comp, compIdx) in editForm.comparisons" :key="`comp-${compIdx}`"
                  class="ed-well space-y-2 p-3">
                  <div class="flex items-center gap-2">
                    <div class="inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[10px]"
                      style="background-color: var(--srf-raised); border-color: var(--srf-line)">
                      <button type="button" :disabled="compIdx === 0"
                        class="cursor-pointer font-bold disabled:opacity-30" title="Geser ke atas"
                        @click="moveComparisonRow(compIdx, 'up')">
                        ▲
                      </button>
                      <span style="color: var(--srf-line-strong)">|</span>
                      <button type="button" :disabled="compIdx === editForm.comparisons.length - 1"
                        class="cursor-pointer font-bold disabled:opacity-30" title="Geser ke bawah"
                        @click="moveComparisonRow(compIdx, 'down')">
                        ▼
                      </button>
                    </div>
                    <input v-model="comp.feature" type="text" class="ed-input !py-1 !text-xs font-semibold flex-1"
                      placeholder="Nama fitur (cth: Transportasi & Meeting Point)" />
                    <button type="button" class="cursor-pointer px-2 text-xs font-semibold hover:underline"
                      style="color: var(--srf-bad)" @click="removeComparisonRow(compIdx)">
                      Hapus
                    </button>
                  </div>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <span class="ed-label mb-1">PAKET A</span>
                      <input v-model="comp.pkgA" type="text" class="ed-input !py-1 !text-xs" placeholder="-" />
                    </div>
                    <div>
                      <span class="ed-label mb-1">PAKET B</span>
                      <input v-model="comp.pkgB" type="text" class="ed-input !py-1 !text-xs"
                        placeholder="Bus AC / Transport PP" />
                    </div>
                    <div>
                      <span class="ed-label mb-1">PAKET C</span>
                      <input v-model="comp.pkgC" type="text" class="ed-input !py-1 !text-xs"
                        placeholder="AC Eksekutif Class VIP" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="activeSection === 'mepo' || activeSection === 'all'" class="space-y-4"
            :class="activeSection === 'all' ? 'border-t pt-5' : ''" style="border-color: var(--srf-line)">
            <div class="flex items-center justify-between rounded border px-3 py-1.5 text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-accent)">
              <span>SECTION 3: HARGA PER MEETING POINT ({{ editForm.mepoPrices.length }} MEPO)</span>
              <button type="button" class="ed-btn-secondary !px-2.5 !py-0.5 !text-[11px]" @click="addMepoRow">
                + Tambah Mepo
              </button>
            </div>

            <div v-if="!editForm.mepoPrices.length" class="ed-well p-4 text-center text-xs"
              style="color: var(--srf-ink-3)">
              Belum ada daftar meeting point. Klik "+ Tambah Mepo" untuk menambah lokasi titik kumpul.
            </div>

            <div v-else class="space-y-2.5">
              <div v-for="(mepoRow, mepoIdx) in editForm.mepoPrices" :key="`mepo-${mepoIdx}`"
                class="ed-well space-y-2 p-3">
                <div class="flex flex-wrap items-center gap-2">
                  <input v-model="mepoRow.mepo" type="text"
                    class="ed-input !py-1.5 !text-xs font-semibold flex-1 min-w-[200px]"
                    placeholder="Nama Meeting Point (cth: Basecamp Patak Banteng)" />
                  <label
                    class="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] whitespace-nowrap"
                    style="background-color: var(--srf-raised); border-color: var(--srf-line)"
                    title="Aktifkan input lokasi bebas saat peserta memilih opsi ini">
                    <input v-model="mepoRow.isCustom" type="checkbox" class="accent-[#2b4e9b]" />
                    Input bebas
                  </label>
                  <button type="button" class="cursor-pointer px-2 text-xs font-semibold hover:underline"
                    style="color: var(--srf-bad)" @click="removeMepoRow(mepoIdx)">
                    Hapus
                  </button>
                </div>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <span class="ed-label mb-1">PAKET A</span>
                    <input v-model="mepoRow.pkgA" type="text" class="ed-input !py-1 !text-xs"
                      placeholder="Rp 550.000 atau -" />
                  </div>
                  <div>
                    <span class="ed-label mb-1">PAKET B</span>
                    <input v-model="mepoRow.pkgB" type="text" class="ed-input !py-1 !text-xs"
                      placeholder="Rp 850.000 atau -" />
                  </div>
                  <div>
                    <span class="ed-label mb-1">PAKET C</span>
                    <input v-model="mepoRow.pkgC" type="text" class="ed-input !py-1 !text-xs"
                      placeholder="Rp 1.450.000 atau -" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section v-if="activeSection === 'itinerary' || activeSection === 'all'" class="space-y-4"
            :class="activeSection === 'all' ? 'border-t pt-5' : ''" style="border-color: var(--srf-line)">
            <div class="rounded border px-3 py-1.5 text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-accent)">
              SECTION 4: MANAJEMEN ITINERARY &amp; JALUR START
            </div>

            <div class="ed-well space-y-3 p-3.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div class="ed-label">PILIH JALUR / ROUTE UNTUK ITINERARY</div>
                  <p class="mt-0.5 text-xs" style="color: var(--srf-ink-3)">
                    Atur itinerary utama atau buat jadwal spesifik per jalur pendakian.
                  </p>
                </div>
                <button type="button" class="ed-btn-secondary !px-3 !py-1.5 !text-xs" @click="addRouteFilter">
                  + Tambah Jalur / Route
                </button>
              </div>

              <select v-model="activeRouteId" class="ed-select !text-xs font-semibold">
                <option value="default">Default Itinerary (Semua Jalur / Utama)</option>
                <option v-for="rf in editForm.routeFilters" :key="rf.id" :value="rf.id">
                  Jalur: {{ rf.label }}
                </option>
              </select>

              <div v-if="activeRouteId !== 'default'" class="flex flex-wrap items-center gap-2 border-t pt-2.5"
                style="border-color: var(--srf-line)">
                <span class="ed-label shrink-0">LABEL JALUR:</span>
                <input v-model="activeRouteLabel" type="text" class="ed-input !py-1 !text-xs flex-1 min-w-[180px]"
                  placeholder="cth: Via Patak Banteng · 2D1N" />
                <button type="button" class="cursor-pointer px-2 text-xs font-semibold hover:underline"
                  style="color: var(--srf-bad)" @click="removeRouteFilter(activeRouteId)">
                  Hapus Jalur Ini
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2">
              <span class="ed-label">
                SUSUNAN HARI &amp; JADWAL ({{ getActiveItineraryList().length }} HARI)
              </span>
              <button type="button" class="ed-btn-secondary !px-3 !py-1 !text-xs" @click="addItineraryDay">
                + Tambah Hari
              </button>
            </div>

            <div v-if="!getActiveItineraryList().length" class="ed-well p-4 text-center text-xs"
              style="color: var(--srf-ink-3)">
              Belum ada susunan itinerary untuk jalur ini. Klik "+ Tambah Hari" untuk menambahkan rencana perjalanan.
            </div>

            <div v-else class="space-y-3">
              <div v-for="(dayItem, dayIdx) in getActiveItineraryList()" :key="`day-${activeRouteId}-${dayIdx}`"
                class="ed-well space-y-3 p-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="rounded px-2 py-0.5 text-[11px] font-semibold"
                      style="background-color: var(--srf-accent); color: var(--srf-btn-ink)">
                      {{ dayItem.day || `Hari ${dayIdx + 1}` }}
                    </span>
                    <div class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]"
                      style="background-color: var(--srf-raised); border-color: var(--srf-line)">
                      <button type="button" :disabled="dayIdx === 0"
                        class="cursor-pointer font-bold disabled:opacity-30" title="Geser Hari ke Atas"
                        @click="moveItineraryDay(dayIdx, 'up')">
                        ▲
                      </button>
                      <span style="color: var(--srf-line-strong)">|</span>
                      <button type="button" :disabled="dayIdx === getActiveItineraryList().length - 1"
                        class="cursor-pointer font-bold disabled:opacity-30" title="Geser Hari ke Bawah"
                        @click="moveItineraryDay(dayIdx, 'down')">
                        ▼
                      </button>
                    </div>
                  </div>

                  <button type="button" class="cursor-pointer text-xs font-semibold hover:underline"
                    style="color: var(--srf-bad)" @click="removeItineraryDay(dayIdx)">
                    Hapus Hari Ini
                  </button>
                </div>

                <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input v-model="dayItem.day" type="text" class="ed-input !py-1.5 !text-xs font-semibold"
                    placeholder="Label (cth: Hari 1)" />
                  <input v-model="dayItem.title" type="text"
                    class="ed-input !py-1.5 !text-xs font-semibold sm:col-span-2"
                    placeholder="Judul agenda (cth: Meeting Point & Camp)" />
                </div>

                <textarea v-model="dayItem.desc" rows="2" class="ed-textarea !py-1.5 !text-xs"
                  placeholder="Ringkasan atau deskripsi umum hari ini..." />

                <div class="space-y-2 border-t pt-2.5" style="border-color: var(--srf-line)">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="ed-label">
                      RINCIAN JAM &amp; KEGIATAN ({{ dayItem.schedules.length }}) · TARIK ⋮⋮ ATAU GUNAKAN PANAH
                    </span>
                    <button type="button" class="ed-btn-secondary !px-2.5 !py-1 !text-[11px]"
                      @click="addItinerarySchedule(dayIdx)">
                      + Tambah Jam / Kegiatan
                    </button>
                  </div>

                  <div v-if="dayItem.schedules.length" class="space-y-1.5">
                    <div v-for="(sched, schedIdx) in dayItem.schedules" :key="`sched-${dayIdx}-${schedIdx}`"
                      draggable="true" class="flex flex-wrap items-center gap-1.5 rounded border p-1.5"
                      style="background-color: var(--srf-raised); border-color: var(--srf-line)"
                      @dragstart="draggedSched = { dayIdx, schedIdx }" @dragover.prevent
                      @drop="onDropSchedule(dayIdx, schedIdx)">
                      <span class="cursor-grab select-none px-1 text-sm font-bold active:cursor-grabbing"
                        style="color: var(--srf-ink-3)" title="Tarik untuk menggeser posisi">
                        ⋮⋮
                      </span>
                      <div class="flex flex-col text-[9px] leading-none shrink-0">
                        <button type="button" :disabled="schedIdx === 0"
                          class="cursor-pointer font-bold disabled:opacity-25" title="Geser ke atas"
                          @click="moveItinerarySchedule(dayIdx, schedIdx, 'up')">
                          ▲
                        </button>
                        <button type="button" :disabled="schedIdx === dayItem.schedules.length - 1"
                          class="cursor-pointer font-bold disabled:opacity-25" title="Geser ke bawah"
                          @click="moveItinerarySchedule(dayIdx, schedIdx, 'down')">
                          ▼
                        </button>
                      </div>
                      <input v-model="sched.time" type="text"
                        class="ed-input !w-32 shrink-0 !px-2 !py-1 !text-xs font-semibold"
                        placeholder="08:00 - 10:00" />
                      <input v-model="sched.event" type="text"
                        class="ed-input !px-2 !py-1 !text-xs flex-1 min-w-[160px]"
                        placeholder="Keterangan kegiatan..." />
                      <button type="button" class="cursor-pointer px-1.5 text-xs font-bold"
                        style="color: var(--srf-bad)" title="Hapus jam ini"
                        @click="removeItinerarySchedule(dayIdx, schedIdx)">
                        X
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
            style="border-color: var(--srf-line)">
            <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <input type="checkbox" class="h-4 w-4 accent-[#2b4e9b]" :checked="editForm.statusPublish === 'Published'"
                @change="
                  editForm.statusPublish = ($event.target as HTMLInputElement).checked
                    ? 'Published'
                    : 'Draft'
                  " />
              <span>Tampilkan sebagai Published (siap pendaftaran)</span>
            </label>
            <div class="flex items-center gap-2">
              <span class="ed-label">STATUS:</span>
              <select v-model="editForm.statusPublish" class="ed-select !w-36 !py-1 !text-xs">
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Penuh">Penuh</option>
              </select>
            </div>
          </div>

          <div v-if="modalErr" class="rounded-md border px-3 py-2 text-xs font-medium" style="
              background-color: var(--srf-well);
              border-color: var(--srf-bad);
              color: var(--srf-bad);
            ">
            {{ modalErr }}
          </div>
        </div>

        <div class="flex justify-end gap-2.5 border-t px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)">
          <button type="button" class="ed-btn-secondary !text-xs" @click="closeModal">
            Batal
          </button>
          <button type="button" class="ed-btn-primary !text-xs"
            :disabled="saving || !editForm.judul.trim() || !editForm.lokasi.trim()" @click="handleSave">
            {{ saving ? 'Menyimpan...' : isNew ? 'Tambahkan Trip' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      @click.self="deleteTarget = null">
      <div class="ed-card w-full max-w-sm space-y-4 p-5 text-center shadow-xl"
        style="border-color: var(--srf-line-strong)">
        <div>
          <p class="ed-label" style="color: var(--srf-bad)">KONFIRMASI HAPUS</p>
          <h3 class="font-serif-display mt-1 text-lg font-bold">{{ deleteTarget.judul }}</h3>
          <p class="mt-1 text-xs" style="color: var(--srf-ink-2)">
            Apakah Anda yakin ingin menghapus data jadwal trip ini?
          </p>
        </div>
        <div v-if="deleteErr" class="rounded-md border px-3 py-2 text-xs font-medium" style="
            background-color: var(--srf-well);
            border-color: var(--srf-bad);
            color: var(--srf-bad);
          ">
          {{ deleteErr }}
        </div>
        <div class="flex justify-center gap-2.5">
          <button type="button" class="ed-btn-secondary !text-xs" @click="deleteTarget = null">
            Batal
          </button>
          <button type="button" class="ed-btn-primary !text-xs" style="background-color: var(--srf-bad)"
            :disabled="deleting" @click="confirmDelete">
            {{ deleting ? 'Menghapus...' : 'Ya, Hapus' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toastMsg"
      class="fixed bottom-5 right-5 z-50 rounded-md border px-4 py-2.5 text-xs font-semibold shadow-lg" style="
        background-color: var(--srf-ink);
        border-color: var(--srf-line-strong);
        color: var(--srf-bg);
      ">
      {{ toastMsg }}
    </div>
  </div>
</template>
