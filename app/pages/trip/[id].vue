<script setup lang="ts">
import type { PublicTripItem, PublicTripPaket } from '~/composables/useTripGallery'

const route = useRoute()
const cart = usePublicCart()

const { data, pending, error, refresh } = await useFetch('/api/public/landing')

const bookingPanelRef = ref<HTMLElement | null>(null)
const isBookingPanelVisible = ref(false)
let bookingIo: IntersectionObserver | null = null

function scrollToBookingPanel() {
  bookingPanelRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  cart.initClientCart()
  if (data.value) {
    cart.setCatalogPromos(data.value.promos ?? [])
    cart.syncCatalogPrices(data.value.alat ?? [], data.value.packages ?? [])
  }
  watch(
    bookingPanelRef,
    (el) => {
      bookingIo?.disconnect()
      bookingIo = null
      if (!el || typeof IntersectionObserver === 'undefined') return
      bookingIo = new IntersectionObserver(
        (entries) => {
          isBookingPanelVisible.value = Boolean(entries[0]?.isIntersecting)
        },
        { threshold: 0.12 },
      )
      bookingIo.observe(el)
    },
    { immediate: true },
  )
})

onBeforeUnmount(() => {
  bookingIo?.disconnect()
  bookingIo = null
})

const trips = computed<PublicTripItem[]>(() => (data.value?.trips ?? []) as PublicTripItem[])
const tripId = computed(() => Number(route.params.id))
const trip = computed<PublicTripItem | null>(() => {
  if (!trips.value.length) return null
  return trips.value.find((t) => t.id === tripId.value) ?? null
})

const aturan = computed(
  () =>
    data.value?.aturan ?? {
      durasiMinimalJam: 24,
      toleransiTelatJam: 2,
      dendaPersenHarian: 30,
      minHariPromo: 3,
      diskonPersen: 10,
    },
)

const kontak = computed(
  () =>
    data.value?.kontak ?? {
      whatsapp: '6285156549003',
      whatsappDisplay: '+62 851-5654-9003',
      email: 'admin@merayau.id',
      alamat:
        'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b (gang tepat di samping Mr. DIY Tanray 2), Pontianak, Kalimantan Barat',
      alamatSingkat: 'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b, Pontianak',
      mapsUrl:
        'https://www.google.com/maps/search/?api=1&query=Jl.+Tanjung+Raya+2+Gg.+Nusa+Abadi+No.+22b+Pontianak',
      jamBuka: 'Setiap Hari · 08.00 - 21.00 WIB',
    },
)

useHead(() => ({
  title: trip.value
    ? `Booking ${trip.value.judul} · Merayau Adventure`
    : 'Booking Open Trip · Merayau Adventure',
  meta: [
    {
      name: 'description',
      content: trip.value
        ? `Booking kursi Open Trip ${trip.value.judul} (${trip.value.tanggalBerangkat}). Bandingkan Paket A/B/C, pilih meeting point, dan cek itinerary lengkap.`
        : 'Halaman booking Open Trip Merayau Adventure Pontianak.',
    },
  ],
}))

const selectedPaketId = ref<number | null>(null)
const selectedMepo = ref<string>('')
const customMepoText = ref('')
const jumlahPeserta = ref(1)
const activeRouteId = ref<string>('default')

watch(
  trip,
  (t) => {
    if (!t) return
    selectedPaketId.value = t.pakets[0]?.id ?? null
    selectedMepo.value = t.meetingPoints[0]?.namaLokasi ?? 'Basecamp / Konfirmasi Admin'
    customMepoText.value = ''
    jumlahPeserta.value = 1
    activeRouteId.value = 'default'
  },
  { immediate: true },
)

const activeItineraryDays = computed(() => {
  if (!trip.value) return []
  if (activeRouteId.value !== 'default') {
    const routeList = trip.value.detail?.routeItineraries?.[activeRouteId.value]
    if (routeList?.length) return routeList
  }
  return trip.value.detail?.itineraryDays ?? []
})

const selectedPaket = computed(
  () => trip.value?.pakets.find((p) => p.id === selectedPaketId.value) ?? trip.value?.pakets[0] ?? null,
)

const isCustomMepoSelected = computed(() => {
  const found = trip.value?.meetingPoints.find((m) => m.namaLokasi === selectedMepo.value)
  return Boolean(found?.isCustom)
})

function parseRupiahNumber(val: string | undefined): number | null {
  if (!val) return null
  const clean = val.trim()
  if (!clean || clean === '-' || !/\d/.test(clean)) return null
  const digits = clean.replace(/[^\d]/g, '')
  const num = Number(digits)
  return Number.isFinite(num) && num > 0 ? num : null
}

const activeTier = computed<'pkgA' | 'pkgB' | 'pkgC'>(() => {
  if (!selectedPaket.value) return 'pkgA'
  const idx = trip.value?.pakets.findIndex((p) => p.id === selectedPaket.value?.id) ?? 0
  return paketTierKey(selectedPaket.value.kodePaket, idx)
})

const mepoPriceRows = computed(() => {
  const saved = trip.value?.detail?.mepoPrices ?? []
  if (saved.length) return saved
  const pakets = trip.value?.pakets ?? []
  const pA = pakets[0]?.harga ? formatRupiah(pakets[0].harga) : '-'
  const pB = pakets[1]?.harga ? formatRupiah(pakets[1].harga) : '-'
  const pC = pakets[2]?.harga ? formatRupiah(pakets[2].harga) : '-'
  return (trip.value?.meetingPoints ?? []).map((m) => ({
    mepo: m.namaLokasi,
    isCustom: m.isCustom,
    pkgA: m.isCustom ? 'Konfirmasi Admin' : pA,
    pkgB: m.isCustom ? 'Konfirmasi Admin' : pB,
    pkgC: m.isCustom ? 'Konfirmasi Admin' : pC,
  }))
})

const activeUnitPrice = computed(() => {
  const row = mepoPriceRows.value.find((r) => r.mepo === selectedMepo.value)
  const parsed = row ? parseRupiahNumber(row[activeTier.value]) : null
  if (parsed !== null) return parsed
  return selectedPaket.value?.harga ?? trip.value?.hargaMulai ?? 0
})

const totalHarga = computed(() => activeUnitPrice.value * jumlahPeserta.value)
const nominalDp50 = computed(() => Math.round(totalHarga.value * 0.5))

function selectMepoAndTier(mepoName: string, tier?: 'pkgA' | 'pkgB' | 'pkgC') {
  selectedMepo.value = mepoName
  if (tier && trip.value?.pakets.length) {
    const matchIdx = trip.value.pakets.findIndex((p, idx) => paketTierKey(p.kodePaket, idx) === tier)
    if (matchIdx !== -1) {
      selectedPaketId.value = trip.value.pakets[matchIdx]!.id
    }
  } else {
    // If current tier is '-' for this mepo, auto-switch to first available tier with a price
    const row = mepoPriceRows.value.find((r) => r.mepo === mepoName)
    if (row && row[activeTier.value]?.trim() === '-') {
      const avail = (['pkgA', 'pkgB', 'pkgC'] as const).find(
        (t) => row[t] && row[t].trim() !== '-',
      )
      if (avail && trip.value?.pakets.length) {
        const matchIdx = trip.value.pakets.findIndex((p, idx) => paketTierKey(p.kodePaket, idx) === avail)
        if (matchIdx !== -1) {
          selectedPaketId.value = trip.value.pakets[matchIdx]!.id
        }
      }
    }
  }
}

function shortPaketCode(kodePaket: string): string {
  return kodePaket.replace(/^Paket\s+/i, '').trim() || kodePaket
}

function splitPaketTitle(pkg: PublicTripPaket, pkgIndex = 0): { title: string; subtitle: string; tag?: string } {
  const cardMatch =
    trip.value?.detail?.packageCards?.find((c) => c.kodePaket === pkg.kodePaket) ??
    trip.value?.detail?.packageCards?.[pkgIndex]
  if (cardMatch?.namaPaket?.trim()) {
    return {
      title: cardMatch.namaPaket.trim(),
      subtitle: cardMatch.durasiKeterangan?.trim() || 'Fasilitas sesuai paket terpilih',
      tag: cardMatch.tag?.trim() || undefined,
    }
  }
  const raw = (pkg.deskripsiFasilitas ?? '').trim()
  if (!raw) return { title: pkg.kodePaket, subtitle: 'Fasilitas standar open trip' }
  const match = /^([^(]+)\(([^)]+)\)/.exec(raw)
  if (match) {
    return { title: match[1]!.trim(), subtitle: match[2]!.trim() }
  }
  const parts = raw.split(' · ')
  if (parts.length >= 2) {
    return { title: parts[0]!.trim(), subtitle: parts.slice(1).join(' · ').trim() }
  }
  return { title: raw, subtitle: 'Fasilitas sesuai paket terpilih' }
}

function paketTierKey(kodePaket: string, pkgIndex = 0): 'pkgA' | 'pkgB' | 'pkgC' {
  const norm = (kodePaket ?? '').trim().toUpperCase()
  if (/\bA$/.test(norm) || norm === 'A') return 'pkgA'
  if (/\bB$/.test(norm) || norm === 'B') return 'pkgB'
  if (/\bC$/.test(norm) || norm === 'C') return 'pkgC'
  if (pkgIndex === 0) return 'pkgA'
  if (pkgIndex === 1) return 'pkgB'
  return 'pkgC'
}

function getPaketInclusions(pkg: PublicTripPaket, pkgIndex: number): string[] {
  const comparisons = trip.value?.detail?.comparisons ?? []
  if (!comparisons.length) {
    return [
      pkg.deskripsiFasilitas || 'Fasilitas standar open trip',
      'Guide & koordinasi tim lapangan',
      'Jadwal keberangkatan sesuai kuota',
    ]
  }
  const key = paketTierKey(pkg.kodePaket, pkgIndex)

  const items: string[] = []
  for (const row of comparisons) {
    const val = (row[key] ?? '').trim()
    const lower = val.toLowerCase()
    if (!val || lower === '-' || lower.includes('bawa sendiri') || lower.includes('opsional') || lower === 'tidak') {
      continue
    }
    if (lower === 'termasuk') {
      items.push(row.feature)
    } else {
      items.push(`${row.feature} (${val})`)
    }
  }
  return items
}

function isIncludedValue(val: string): boolean {
  const lower = (val ?? '').trim().toLowerCase()
  return Boolean(lower) && lower !== '-' && !lower.includes('bawa sendiri') && !lower.includes('opsional') && lower !== 'tidak'
}

function formatComparisonCell(val: string): string {
  const clean = (val ?? '').trim()
  if (!clean || clean === '-' || clean.toLowerCase().includes('bawa sendiri')) return '-'
  return clean
}

function isActiveTierColumn(tier: 'pkgA' | 'pkgB' | 'pkgC'): boolean {
  if (!selectedPaket.value) return false
  const idx = trip.value?.pakets.findIndex((p) => p.id === selectedPaket.value?.id) ?? 0
  return paketTierKey(selectedPaket.value.kodePaket, idx) === tier
}

const waBookingUrl = computed(() => {
  if (!trip.value) return '#'
  const mepoFinal =
    isCustomMepoSelected.value && customMepoText.value.trim()
      ? `${selectedMepo.value} (${customMepoText.value.trim()})`
      : selectedMepo.value

  const lines = [
    'Halo Admin Merayau Adventure, saya mau booking Open Trip:',
    `*Trip:* ${trip.value.judul} (${trip.value.tanggalBerangkat})`,
    `*Paket:* ${selectedPaket.value?.kodePaket || 'Paket A'} (${formatRupiah(activeUnitPrice.value)}/org)`,
    `*Meeting Point:* ${mepoFinal}`,
    `*Jumlah Peserta:* ${jumlahPeserta.value} orang`,
    `*Total Biaya:* ${formatRupiah(totalHarga.value)}`,
    `*DP 50%:* ${formatRupiah(nominalDp50.value)}`,
    '',
    'Mohon info slot kuota dan rekening konfirmasi DP ya Admin!',
  ]
  return buildWaLink(kontak.value.whatsapp, lines.join('\n'))
})
</script>

<template>
  <div class="mry-public min-h-screen bg-[#FDFCFA] text-[#121613]">
    <PublicNavbar
      :total-alat="data?.stats?.totalAlatAktif ?? 58"
      :whatsapp="kontak.whatsapp"
    />

    <main class="mx-auto max-w-[1280px] overflow-x-clip px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <!-- Top Bar & Trip Switcher -->
      <div class="flex flex-col gap-2.5 border-b border-[#EAE5DA] pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:pb-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <NuxtLink
            to="/#open-trip"
            class="inline-flex min-h-[44px] w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-[#D6D0C4] bg-white px-4 text-xs font-semibold text-[#121613] hover:bg-[#F5F2EB]"
          >
            ← Kembali ke Beranda
          </NuxtLink>
          <div class="mry-no-scrollbar flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <NuxtLink
              v-for="other in trips"
              :key="other.id"
              :to="`/trip/${other.id}`"
              class="mry-mono inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-xs font-semibold transition-colors"
              :class="
                other.id === trip?.id
                  ? 'border-[#1E4D36] bg-[#1E4D36] text-white'
                  : 'border-[#D6D0C4] bg-white text-[#2E3530] hover:bg-[#F5F2EB]'
              "
            >
              {{ other.judul }}
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="pending && !data" class="mt-8 grid gap-8 lg:grid-cols-12">
        <div class="h-96 animate-pulse rounded-2xl bg-[#EAE5DA] lg:col-span-8" />
        <div class="h-96 animate-pulse rounded-2xl bg-[#EAE5DA] lg:col-span-4" />
      </div>

      <!-- Error -->
      <div
        v-else-if="error && !data"
        class="my-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
      >
        <div class="text-base font-semibold text-red-800">Gagal memuat data Open Trip</div>
        <button
          type="button"
          class="mt-4 min-h-[44px] cursor-pointer rounded-full bg-[#1E4D36] px-5 text-xs font-semibold text-white"
          @click="refresh()"
        >
          Coba Lagi
        </button>
      </div>

      <!-- Not Found -->
      <div
        v-else-if="!trip"
        class="my-10 rounded-2xl border border-dashed border-[#D6D0C4] bg-white p-10 text-center"
      >
        <div class="mry-serif text-2xl font-semibold text-[#121613]">Jadwal Open Trip tidak ditemukan</div>
        <p class="mt-2 text-sm text-[#5C645E]">
          Jadwal mungkin sudah selesai atau belum dipublikasikan. Silakan pilih jadwal aktif lainnya.
        </p>
        <NuxtLink
          to="/#open-trip"
          class="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-[#1E4D36] px-6 text-xs font-semibold text-white hover:bg-[#163B29]"
        >
          Lihat Semua Open Trip
        </NuxtLink>
      </div>

      <!-- Main 2-Column Booking Layout -->
      <div v-else class="mt-6 grid items-start gap-6 sm:mt-8 sm:gap-8 lg:grid-cols-12">
        <!-- LEFT COLUMN: Hero + 3-Column Package Comparison + Comparison Table + Itinerary -->
        <div class="min-w-0 space-y-6 sm:space-y-8 lg:col-span-8">
          <!-- Trip Hero Summary -->
          <div class="grid gap-4 rounded-2xl border border-[#EAE5DA] bg-white p-4 sm:grid-cols-12 sm:gap-5 sm:p-6">
            <div class="min-w-0 overflow-hidden rounded-xl border border-[#EAE5DA] bg-[#EAE5DA] sm:col-span-5">
              <img :src="trip.fotoUrl" :alt="trip.judul" class="aspect-[4/3] h-full w-full object-cover" />
            </div>
            <div class="flex min-w-0 flex-col justify-between space-y-3 sm:col-span-7">
              <div>
                <div class="mry-mono text-[11px] leading-relaxed font-semibold tracking-[0.12em] text-[#1E4D36] uppercase">
                  {{ trip.statusPublish }} · {{ trip.tanggalBerangkat }} · {{ trip.durasi }}
                </div>
                <h1 class="mry-serif mt-1.5 text-2xl font-semibold text-[#121613] sm:text-3xl">
                  {{ trip.judul }}
                </h1>
                <p class="mt-2 text-sm leading-relaxed text-[#2E3530]">
                  {{
                    trip.detail?.deskripsi ||
                    'Pendakian terjadwal bersama tim lapangan Merayau Adventure. Tersedia pilihan Paket A, B, atau C sesuai kebutuhan perlengkapan dan logistik.'
                  }}
                </p>
              </div>

              <div class="flex flex-wrap gap-2 pt-1">
                <span class="mry-mono rounded-full border border-[#D6D0C4] bg-[#FDFCFA] px-3 py-1 text-xs font-medium text-[#2E3530]">
                  {{ trip.lokasi }}
                </span>
                <span
                  v-if="trip.detail?.elevation"
                  class="mry-mono rounded-full border border-[#D6D0C4] bg-[#FDFCFA] px-3 py-1 text-xs font-medium text-[#2E3530]"
                >
                  {{ trip.detail.elevation }}
                </span>
                <span
                  v-if="trip.detail?.difficulty"
                  class="mry-mono rounded-full border border-[#D6D0C4] bg-[#FDFCFA] px-3 py-1 text-xs font-medium text-[#2E3530]"
                >
                  {{ trip.detail.difficulty }}
                </span>
                <span
                  class="mry-mono rounded-full px-3 py-1 text-xs font-semibold"
                  :class="trip.sisaKuota > 0 ? 'bg-[#E6F0EA] text-[#1E4D36]' : 'bg-red-50 text-red-700'"
                >
                  Sisa Kuota: {{ trip.sisaKuota }} / {{ trip.kuota }}
                </span>
              </div>
            </div>
          </div>

          <!-- PILIH PAKET TRIP (3-Column Side-by-Side Comparison Cards) -->
          <section v-if="trip.pakets.length" aria-labelledby="heading-paket-trip">
            <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="heading-paket-trip" class="mry-serif text-2xl font-semibold text-[#121613]">
                  Pilih Paket Trip
                </h2>
                <p class="mt-0.5 text-xs text-[#5C645E]">
                  Klik salah satu kartu paket untuk membandingkan fasilitas dan memilih paket booking.
                </p>
              </div>
            </div>

            <div
              class="grid gap-4"
              :class="trip.pakets.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'"
            >
              <button
                v-for="(pkg, pkgIdx) in trip.pakets"
                :key="pkg.id"
                type="button"
                class="flex h-full min-w-0 cursor-pointer flex-col justify-start rounded-2xl bg-white p-4 text-left transition-all sm:p-5"
                :class="
                  selectedPaket?.id === pkg.id
                    ? 'border-2 border-[#121613] shadow-sm ring-1 ring-[#121613]/10'
                    : 'border border-[#D6D0C4] hover:border-[#1E4D36]/60'
                "
                @click="selectedPaketId = pkg.id"
              >
                <div class="w-full">
                  <div class="flex items-center justify-between gap-2">
                    <span class="mry-mono text-[11px] font-semibold tracking-wider text-[#5C645E] uppercase">
                      {{ pkg.kodePaket }}
                    </span>
                    <div class="flex items-center gap-1.5">
                      <span
                        v-if="splitPaketTitle(pkg, pkgIdx).tag"
                        class="mry-mono rounded bg-[#F5F2EB] px-2 py-0.5 text-[10px] font-semibold text-[#121613]"
                      >
                        {{ splitPaketTitle(pkg, pkgIdx).tag }}
                      </span>
                      <span
                        v-if="selectedPaket?.id === pkg.id"
                        class="mry-mono rounded bg-[#E6F0EA] px-2 py-0.5 text-[10px] font-semibold text-[#1E4D36]"
                      >
                        Dipilih
                      </span>
                    </div>
                  </div>

                  <div class="mt-1 text-lg font-bold text-[#121613]">
                    {{ splitPaketTitle(pkg, pkgIdx).title }}
                  </div>
                  <p class="mt-0.5 min-h-[32px] text-xs leading-snug text-[#5C645E]">
                    {{ splitPaketTitle(pkg, pkgIdx).subtitle }}
                  </p>

                  <div class="mt-3 border-b border-[#EAE5DA] pb-3.5">
                    <span class="text-xs font-medium text-[#5C645E]">Mulai </span>
                    <span class="mry-mono text-lg font-bold text-[#1E4D36]">
                      {{ formatRupiah(pkg.harga) }}
                    </span>
                  </div>

                  <ul class="mt-4 space-y-2.5">
                    <li
                      v-for="(inc, incIdx) in getPaketInclusions(pkg, pkgIdx)"
                      :key="incIdx"
                      class="flex items-start gap-2 text-xs leading-snug text-[#2E3530]"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        class="mt-0.5 shrink-0 text-[#1E4D36]"
                        aria-hidden="true"
                      >
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="currentColor"
                          stroke-width="2.2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                      <span>{{ inc }}</span>
                    </li>
                  </ul>
                </div>
              </button>
            </div>
          </section>

          <!-- HARGA PER MEETING POINT -->
          <section
            v-if="mepoPriceRows.length"
            class="min-w-0"
            aria-labelledby="heading-harga-mepo"
          >
            <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="heading-harga-mepo" class="mry-serif text-2xl font-semibold text-[#121613]">
                  Harga per Meeting Point
                </h2>
                <p class="mt-0.5 text-xs text-[#5C645E]">
                  Klik lokasi atau nominal harga di tabel untuk langsung memilih titik kumpul dan paket.
                </p>
                <p class="mt-1 text-[11px] font-medium text-[#1E4D36] sm:hidden">
                  Geser tabel ke samping untuk melihat semua kolom.
                </p>
              </div>
            </div>

            <div class="overflow-hidden rounded-2xl border border-[#EAE5DA] bg-white">
              <div class="overflow-x-auto">
                <table class="w-full min-w-[460px] text-left text-xs sm:text-sm">
                  <thead class="border-b border-[#EAE5DA] bg-[#F5F2EB] text-xs text-[#5C645E]">
                    <tr>
                      <th class="px-3.5 py-3 font-semibold text-[#121613] sm:px-5 sm:py-3.5">Meeting point</th>
                      <th class="px-3 py-3 text-right font-semibold text-[#121613] sm:px-4 sm:py-3.5">Paket A</th>
                      <th class="px-3 py-3 text-right font-semibold text-[#121613] sm:px-4 sm:py-3.5">Paket B</th>
                      <th
                        v-if="trip.pakets.length >= 3 || mepoPriceRows.some((r) => r.pkgC && r.pkgC !== '-')"
                        class="px-3.5 py-3 text-right font-semibold text-[#121613] sm:px-5 sm:py-3.5"
                      >
                        Paket C
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#EAE5DA]">
                    <tr
                      v-for="(row, rIdx) in mepoPriceRows"
                      :key="rIdx"
                      class="transition-colors hover:bg-[#FDFCFA]"
                    >
                      <td class="px-3.5 py-3 font-medium text-[#121613] sm:px-5 sm:py-3.5">
                        <button
                          type="button"
                          class="inline-flex min-h-[36px] cursor-pointer items-center text-left hover:text-[#1E4D36] hover:underline"
                          @click="selectMepoAndTier(row.mepo)"
                        >
                          {{ row.mepo }}
                        </button>
                      </td>
                      <td
                        class="mry-mono px-3 py-3 text-right sm:px-4 sm:py-3.5"
                        :class="
                          selectedMepo === row.mepo && activeTier === 'pkgA'
                            ? 'bg-[#E6F0EA]/75 font-bold text-[#1E4D36]'
                            : row.pkgA === '-'
                              ? 'text-[#5C645E]'
                              : 'text-[#121613]'
                        "
                      >
                        <button
                          v-if="row.pkgA !== '-'"
                          type="button"
                          class="inline-flex min-h-[36px] cursor-pointer items-center justify-end hover:underline"
                          @click="selectMepoAndTier(row.mepo, 'pkgA')"
                        >
                          {{ row.pkgA }}
                        </button>
                        <span v-else>-</span>
                      </td>
                      <td
                        class="mry-mono px-3 py-3 text-right sm:px-4 sm:py-3.5"
                        :class="
                          selectedMepo === row.mepo && activeTier === 'pkgB'
                            ? 'bg-[#E6F0EA]/75 font-bold text-[#1E4D36]'
                            : row.pkgB === '-'
                              ? 'text-[#5C645E]'
                              : 'text-[#121613]'
                        "
                      >
                        <button
                          v-if="row.pkgB !== '-'"
                          type="button"
                          class="inline-flex min-h-[36px] cursor-pointer items-center justify-end hover:underline"
                          @click="selectMepoAndTier(row.mepo, 'pkgB')"
                        >
                          {{ row.pkgB }}
                        </button>
                        <span v-else>-</span>
                      </td>
                      <td
                        v-if="trip.pakets.length >= 3 || mepoPriceRows.some((r) => r.pkgC && r.pkgC !== '-')"
                        class="mry-mono px-3.5 py-3 text-right sm:px-5 sm:py-3.5"
                        :class="
                          selectedMepo === row.mepo && activeTier === 'pkgC'
                            ? 'bg-[#E6F0EA]/75 font-bold text-[#1E4D36]'
                            : row.pkgC === '-'
                              ? 'text-[#5C645E]'
                              : 'text-[#121613]'
                        "
                      >
                        <button
                          v-if="row.pkgC !== '-'"
                          type="button"
                          class="inline-flex min-h-[36px] cursor-pointer items-center justify-end hover:underline"
                          @click="selectMepoAndTier(row.mepo, 'pkgC')"
                        >
                          {{ row.pkgC }}
                        </button>
                        <span v-else>-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <!-- TABEL PERBANDINGAN FASILITAS LENGKAP -->
          <section
            v-if="trip.detail?.comparisons?.length"
            class="min-w-0 overflow-hidden rounded-2xl border border-[#EAE5DA] bg-white"
            aria-labelledby="heading-tabel-perbandingan"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE5DA] bg-[#F5F2EB] px-4 py-3 sm:px-5 sm:py-3.5">
              <h2 id="heading-tabel-perbandingan" class="mry-mono text-xs font-bold tracking-wider text-[#121613] uppercase">
                Tabel Perbandingan Fasilitas Paket
              </h2>
              <span class="text-[11px] font-medium text-[#5C645E] sm:hidden">Geser ↔</span>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[460px] text-left text-xs">
                <thead class="border-b border-[#EAE5DA] bg-[#FDFCFA] text-[#5C645E]">
                  <tr>
                    <th class="px-3.5 py-3 font-semibold sm:px-5">Fasilitas &amp; Layanan</th>
                    <th
                      class="px-3 py-3 font-semibold sm:px-4"
                      :class="isActiveTierColumn('pkgA') ? 'bg-[#E6F0EA]/40 text-[#1E4D36]' : ''"
                    >
                      Paket A
                    </th>
                    <th
                      class="px-3 py-3 font-semibold sm:px-4"
                      :class="isActiveTierColumn('pkgB') ? 'bg-[#E6F0EA]/40 text-[#1E4D36]' : ''"
                    >
                      Paket B
                    </th>
                    <th
                      class="px-3.5 py-3 font-semibold sm:px-4"
                      :class="isActiveTierColumn('pkgC') ? 'bg-[#E6F0EA]/40 text-[#1E4D36]' : ''"
                    >
                      Paket C
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#EAE5DA] text-[#2E3530]">
                  <tr v-for="(row, idx) in trip.detail.comparisons" :key="idx">
                    <td class="px-3.5 py-3 font-medium text-[#121613] sm:px-5">{{ row.feature }}</td>
                    <td
                      class="px-3 py-3 sm:px-4"
                      :class="[
                        isActiveTierColumn('pkgA') ? 'bg-[#E6F0EA]/20' : '',
                        isIncludedValue(row.pkgA) ? 'font-medium text-[#1E4D36]' : 'text-[#5C645E]',
                      ]"
                    >
                      {{ formatComparisonCell(row.pkgA) }}
                    </td>
                    <td
                      class="px-3 py-3 sm:px-4"
                      :class="[
                        isActiveTierColumn('pkgB') ? 'bg-[#E6F0EA]/20' : '',
                        isIncludedValue(row.pkgB) ? 'font-medium text-[#1E4D36]' : 'text-[#5C645E]',
                      ]"
                    >
                      {{ formatComparisonCell(row.pkgB) }}
                    </td>
                    <td
                      class="px-3.5 py-3 sm:px-4"
                      :class="[
                        isActiveTierColumn('pkgC') ? 'bg-[#E6F0EA]/20' : '',
                        isIncludedValue(row.pkgC) ? 'font-medium text-[#1E4D36]' : 'text-[#5C645E]',
                      ]"
                    >
                      {{ formatComparisonCell(row.pkgC) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- RINGKASAN ITINERARY -->
          <section
            class="min-w-0 rounded-2xl border border-[#EAE5DA] bg-white p-4 sm:p-6"
            aria-labelledby="heading-itinerary"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h2 id="heading-itinerary" class="mry-mono text-xs font-semibold tracking-wider text-[#1E4D36] uppercase">
                Ringkasan Itinerary
              </h2>
              <span
                v-if="selectedPaket"
                class="mry-mono rounded-full bg-[#E6F0EA] px-3 py-1 text-[11px] font-semibold text-[#1E4D36]"
              >
                Aktif: {{ selectedPaket.kodePaket }} · {{ splitPaketTitle(selectedPaket).title }}
              </span>
            </div>

            <div
              v-if="trip.detail?.routeFilters?.length"
              class="mt-3 flex flex-wrap gap-2"
            >
              <button
                type="button"
                class="mry-mono min-h-[44px] cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors"
                :class="
                  activeRouteId === 'default'
                    ? 'border-[#1E4D36] bg-[#1E4D36] text-white'
                    : 'border-[#D6D0C4] bg-[#FDFCFA] text-[#2E3530] hover:bg-[#F5F2EB]'
                "
                @click="activeRouteId = 'default'"
              >
                Jalur Utama
              </button>
              <button
                v-for="rf in trip.detail.routeFilters"
                :key="rf.id"
                type="button"
                class="mry-mono min-h-[44px] cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors"
                :class="
                  activeRouteId === rf.id
                    ? 'border-[#1E4D36] bg-[#1E4D36] text-white'
                    : 'border-[#D6D0C4] bg-[#FDFCFA] text-[#2E3530] hover:bg-[#F5F2EB]'
                "
                @click="activeRouteId = rf.id"
              >
                {{ rf.label }}
              </button>
            </div>

            <div v-if="activeItineraryDays.length" class="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                v-for="(day, dIdx) in activeItineraryDays"
                :key="dIdx"
                class="rounded-xl border border-[#EAE5DA] bg-[#FDFCFA] p-4"
              >
                <div class="text-xs font-bold text-[#121613]">
                  {{ day.day }} · {{ day.title }}
                </div>
                <p v-if="day.desc" class="mt-1 text-xs text-[#5C645E]">{{ day.desc }}</p>
                <ul v-if="day.schedules?.length" class="mt-2.5 space-y-1.5 text-xs text-[#2E3530]">
                  <li v-for="(s, sIdx) in day.schedules" :key="sIdx" class="flex gap-2">
                    <span class="mry-mono shrink-0 font-medium text-[#1E4D36]">{{ s.time }}</span>
                    <span>{{ s.event }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <p v-else class="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-[#2E3530]">
              {{ trip.itinerary }}
            </p>
          </section>
        </div>

        <!-- RIGHT STICKY BOOKING CARD -->
        <aside id="booking-panel" ref="bookingPanelRef" class="min-w-0 lg:sticky lg:top-24 lg:col-span-4">
          <div class="rounded-2xl border border-[#D6D0C4] bg-white p-4 shadow-xs sm:p-6">
            <div class="border-b border-[#EAE5DA] pb-4">
              <div class="text-xs font-medium text-[#5C645E]">Harga per peserta</div>
              <div class="mry-mono mt-0.5 text-2xl font-bold text-[#1E4D36]">
                {{ formatRupiah(activeUnitPrice) }}
              </div>
            </div>

            <div class="mt-5 space-y-5">
              <!-- Paket Selector [A] [B] [C] -->
              <div v-if="trip.pakets.length">
                <div class="mb-2 text-xs font-semibold text-[#121613]">Paket</div>
                <div
                  class="grid gap-2"
                  :class="trip.pakets.length === 2 ? 'grid-cols-2' : 'grid-cols-3'"
                >
                  <button
                    v-for="pkg in trip.pakets"
                    :key="pkg.id"
                    type="button"
                    class="mry-mono min-h-[44px] cursor-pointer rounded-xl border text-sm font-bold transition-colors"
                    :class="
                      selectedPaket?.id === pkg.id
                        ? 'border-[#121613] bg-[#121613] text-white'
                        : 'border-[#D6D0C4] bg-white text-[#121613] hover:bg-[#F5F2EB]'
                    "
                    @click="selectedPaketId = pkg.id"
                  >
                    {{ shortPaketCode(pkg.kodePaket) }}
                  </button>
                </div>
              </div>

              <!-- Meeting Point Radio Cards -->
              <div>
                <div class="mb-2 text-xs font-semibold text-[#121613]">Meeting point</div>
                <div class="space-y-2">
                  <button
                    v-for="m in trip.meetingPoints"
                    :key="m.id"
                    type="button"
                    class="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-colors"
                    :class="
                      selectedMepo === m.namaLokasi
                        ? 'border-[#121613] bg-[#FDFCFA] text-[#121613]'
                        : 'border-[#EAE5DA] bg-white text-[#2E3530] hover:border-[#D6D0C4]'
                    "
                    @click="selectMepoAndTier(m.namaLokasi)"
                  >
                    <span
                      class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                      :class="selectedMepo === m.namaLokasi ? 'border-[#121613]' : 'border-[#D6D0C4]'"
                    >
                      <span
                        v-if="selectedMepo === m.namaLokasi"
                        class="h-2 w-2 rounded-full bg-[#121613]"
                      />
                    </span>
                    <span class="leading-snug">{{ m.namaLokasi }}</span>
                  </button>

                  <div
                    v-if="!trip.meetingPoints.length"
                    class="rounded-xl border border-[#EAE5DA] bg-[#FDFCFA] px-3.5 py-2.5 text-xs text-[#2E3530]"
                  >
                    Basecamp / Konfirmasi Admin
                  </div>
                </div>

                <input
                  v-if="isCustomMepoSelected"
                  v-model="customMepoText"
                  type="text"
                  placeholder="Tulis lokasi penjemputan kamu"
                  class="mt-2 min-h-[44px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3 text-sm text-[#121613]"
                />
              </div>

              <!-- Tanggal -->
              <div>
                <div class="mb-1.5 text-xs font-semibold text-[#121613]">Tanggal</div>
                <div class="flex min-h-[44px] items-center justify-between rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3.5 text-xs font-medium text-[#121613]">
                  <span>{{ trip.tanggalBerangkat }}</span>
                  <span class="mry-mono text-[#1E4D36]">({{ trip.sisaKuota }} kuota)</span>
                </div>
              </div>

              <!-- Peserta -->
              <div>
                <label class="mb-1.5 block text-xs font-semibold text-[#121613]">Peserta</label>
                <div class="flex h-[46px] items-center justify-between rounded-xl border border-[#D6D0C4] bg-white px-1.5">
                  <button
                    type="button"
                    class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-base font-bold text-[#121613] hover:bg-[#F5F2EB]"
                    aria-label="Kurangi peserta"
                    @click="jumlahPeserta = Math.max(1, jumlahPeserta - 1)"
                  >
                    -
                  </button>
                  <span class="mry-mono text-sm font-semibold text-[#121613]">
                    {{ jumlahPeserta }}
                  </span>
                  <button
                    type="button"
                    class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-base font-bold text-[#121613] hover:bg-[#F5F2EB]"
                    aria-label="Tambah peserta"
                    @click="jumlahPeserta = Math.min(Math.max(1, trip.sisaKuota || 10), jumlahPeserta + 1)"
                  >
                    +
                  </button>
                </div>
              </div>

              <!-- Info DP & Tambahan Sewa Alat -->
              <div class="space-y-2 rounded-xl border border-[#EAE5DA] bg-[#FDFCFA] p-3.5 text-xs">
                <div class="font-semibold text-[#121613]">Info Pembayaran &amp; Tambahan</div>
                <div class="flex items-center justify-between text-[#2E3530]">
                  <span>DP Booking (50%)</span>
                  <span class="mry-mono font-semibold text-[#1E4D36]">{{ formatRupiah(nominalDp50) }}</span>
                </div>
                <div class="flex items-center justify-between text-[#2E3530]">
                  <span>Persewaan Alat Tambahan</span>
                  <NuxtLink to="/katalog" class="font-semibold text-[#1E4D36] hover:underline">
                    Katalog Alat →
                  </NuxtLink>
                </div>
              </div>

              <!-- Total & Booking CTA -->
              <div class="space-y-3 border-t border-[#EAE5DA] pt-4">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-[#121613]">Total</span>
                  <span class="mry-mono text-xl font-bold text-[#1E4D36]">
                    {{ formatRupiah(totalHarga) }}
                  </span>
                </div>

                <a
                  :href="waBookingUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1E4D36] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#163B29]"
                >
                  <WaIcon :size="16" />
                  <span>Booking Kursi via WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <PublicFooter
      :total-alat="data?.stats?.totalAlatAktif ?? 58"
      :whatsapp="kontak.whatsapp"
      :whatsapp-display="kontak.whatsappDisplay"
      :email="kontak.email"
      :alamat="kontak.alamat"
      :maps-url="kontak.mapsUrl"
    />

    <PublicRentalCartDrawer :aturan="aturan" :whatsapp="kontak.whatsapp" :promos="data?.promos" />

    <PublicMerayauChatbot
      :aturan="aturan"
      :whatsapp="kontak.whatsapp"
      :promos="data?.promos"
      bottom-offset-mode="trip-bar"
      :hide-when-trip-bar-visible="Boolean(trip && !isBookingPanelVisible)"
    />

    <!-- Mobile Quick Booking Bar (hidden when #booking-panel is visible) -->
    <div
      v-if="trip && !isBookingPanelVisible"
      class="fixed inset-x-0 bottom-0 z-30 border-t border-[#EAE5DA] bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(18,22,19,0.08)] backdrop-blur-md lg:hidden"
    >
      <div class="mx-auto flex max-w-[1280px] items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="mry-mono truncate text-[10px] font-semibold tracking-wider text-[#5C645E] uppercase">
            {{ selectedPaket?.kodePaket || 'Paket A' }} · per peserta
          </div>
          <div class="mry-mono text-base font-bold text-[#1E4D36]">
            {{ formatRupiah(activeUnitPrice) }}
          </div>
        </div>
        <button
          type="button"
          class="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#1E4D36] px-5 text-xs font-semibold text-white transition-colors hover:bg-[#163B29]"
          @click="scrollToBookingPanel"
        >
          Pilih &amp; Booking ↓
        </button>
      </div>
    </div>
  </div>
</template>
