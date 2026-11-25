<script setup lang="ts">
export interface PublicTripPaket {
  id: number
  kodePaket: string
  deskripsiFasilitas: string | null
  harga: number
}

export interface PublicTripMepo {
  id: number
  namaLokasi: string
  isCustom: boolean
}

export interface PublicTripItem {
  id: number
  judul: string
  lokasi: string
  tanggalBerangkat: string
  durasi: string
  kuota: number
  pesertaCount: number
  sisaKuota: number
  hargaMulai: number
  itinerary: string
  statusPublish: string
  fotoUrl: string
  detail?: {
    elevation?: string
    difficulty?: string
    tipeTrip?: string
    deskripsi?: string
    gallery?: string[]
    packageCards?: Array<{
      kodePaket: string
      namaPaket: string
      durasiKeterangan: string
      harga: number
      tag?: string
    }>
    comparisons?: Array<{ feature: string; pkgA: string; pkgB: string; pkgC: string }>
    mepoPrices?: Array<{ mepo: string; isCustom?: boolean; pkgA: string; pkgB: string; pkgC: string }>
    routeFilters?: Array<{ id: string; label: string }>
    itineraryDays?: Array<{
      day: string
      title: string
      desc?: string
      schedules?: Array<{ time: string; event: string }>
    }>
    routeItineraries?: Record<
      string,
      Array<{
        day: string
        title: string
        desc?: string
        schedules?: Array<{ time: string; event: string }>
      }>
    >
  }
  pakets: PublicTripPaket[]
  meetingPoints: PublicTripMepo[]
}

const props = defineProps<{
  trip: PublicTripItem | null
  whatsapp: string
}>()

const emit = defineEmits<{
  close: []
}>()

const selectedPaketId = ref<number | null>(null)
const selectedMepo = ref<string>('')
const customMepoText = ref('')
const jumlahPeserta = ref(1)

watch(
  () => props.trip,
  (t) => {
    if (!t) return
    selectedPaketId.value = t.pakets[0]?.id ?? null
    selectedMepo.value = t.meetingPoints[0]?.namaLokasi ?? 'Basecamp Pontianak / Konfirmasi Admin'
    customMepoText.value = ''
    jumlahPeserta.value = 1
  },
  { immediate: true },
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.trip) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

const selectedPaket = computed(() =>
  props.trip?.pakets.find((p) => p.id === selectedPaketId.value) ?? props.trip?.pakets[0] ?? null,
)

const isCustomMepoSelected = computed(() => {
  const found = props.trip?.meetingPoints.find((m) => m.namaLokasi === selectedMepo.value)
  return Boolean(found?.isCustom)
})

const totalHarga = computed(() => (selectedPaket.value?.harga ?? props.trip?.hargaMulai ?? 0) * jumlahPeserta.value)
const nominalDp50 = computed(() => Math.round(totalHarga.value * 0.5))

const waBookingUrl = computed(() => {
  if (!props.trip) return '#'
  const mepoFinal = isCustomMepoSelected.value && customMepoText.value.trim()
    ? `${selectedMepo.value} (${customMepoText.value.trim()})`
    : selectedMepo.value

  const lines = [
    `Halo Admin Merayau Adventure, saya mau booking Open Trip:`,
    `*Trip:* ${props.trip.judul} (${props.trip.tanggalBerangkat})`,
    `*Paket:* ${selectedPaket.value?.kodePaket || 'Paket A'} (${formatRupiah(selectedPaket.value?.harga ?? props.trip.hargaMulai)}/org)`,
    `*Meeting Point:* ${mepoFinal}`,
    `*Jumlah Peserta:* ${jumlahPeserta.value} orang`,
    `*Total Biaya:* ${formatRupiah(totalHarga.value)}`,
    `*DP 50%:* ${formatRupiah(nominalDp50.value)}`,
    '',
    'Mohon info slot kuota dan rekening konfirmasi DP ya Admin!',
  ]
  return buildWaLink(props.whatsapp, lines.join('\n'))
})
</script>

<template>
  <Teleport to="body">
    <Transition name="mry-modal">
      <div
        v-if="trip"
        class="mry-public fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs sm:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="`Detail Open Trip ${trip.judul}`"
        @click.self="emit('close')"
      >
        <div class="mry-modal-panel relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#D6D0C4] bg-[#FDFCFA] shadow-2xl">
        <div class="flex items-center justify-between gap-4 border-b border-[#EAE5DA] bg-white px-5 py-4 sm:px-7">
          <div class="min-w-0">
            <div class="mry-mono text-[11px] font-medium tracking-[0.12em] text-[#1E4D36] uppercase">
              {{ trip.statusPublish }} · {{ trip.tanggalBerangkat }} · {{ trip.durasi }}
            </div>
            <h3 class="mry-serif truncate text-xl font-semibold text-[#121613] sm:text-2xl">
              {{ trip.judul }}
            </h3>
          </div>
          <button
            type="button"
            class="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] hover:bg-[#F5F2EB]"
            aria-label="Tutup detail trip"
            @click="emit('close')"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="flex-1 space-y-6 overflow-y-auto p-5 sm:p-7">
          <div class="grid gap-5 md:grid-cols-5">
            <div class="min-w-0 overflow-hidden rounded-xl border border-[#EAE5DA] bg-[#EAE5DA] md:col-span-2">
              <img :src="trip.fotoUrl" :alt="trip.judul" class="h-56 w-full object-cover md:h-full" />
            </div>

            <div class="min-w-0 space-y-4 md:col-span-3">
              <div class="flex flex-wrap gap-2">
                <span class="mry-mono rounded-full border border-[#D6D0C4] bg-white px-3 py-1 text-xs font-medium text-[#2E3530]">
                  Lokasi: {{ trip.lokasi }}
                </span>
                <span
                  v-if="trip.detail?.elevation"
                  class="mry-mono rounded-full border border-[#D6D0C4] bg-white px-3 py-1 text-xs font-medium text-[#2E3530]"
                >
                  {{ trip.detail.elevation }}
                </span>
                <span
                  v-if="trip.detail?.difficulty"
                  class="mry-mono rounded-full border border-[#D6D0C4] bg-white px-3 py-1 text-xs font-medium text-[#2E3530]"
                >
                  Level: {{ trip.detail.difficulty }}
                </span>
                <span
                  class="mry-mono rounded-full px-3 py-1 text-xs font-semibold"
                  :class="trip.sisaKuota > 0 ? 'bg-[#E6F0EA] text-[#1E4D36]' : 'bg-red-50 text-red-700'"
                >
                  Sisa Kuota: {{ trip.sisaKuota }} / {{ trip.kuota }}
                </span>
              </div>

              <p class="text-sm leading-relaxed text-[#2E3530]">
                {{ trip.detail?.deskripsi || 'Pendakian terjadwal bersama tim lapangan Merayau Adventure. Tersedia pilihan Paket A, B, atau C sesuai kebutuhan perlengkapan dan logistik.' }}
              </p>

              <div v-if="trip.pakets.length" class="space-y-2">
                <div class="mry-mono text-xs font-semibold tracking-wider text-[#5C645E] uppercase">
                  1. Pilih Paket Fasilitas
                </div>
                <div class="grid gap-2.5 sm:grid-cols-3">
                  <button
                    v-for="pkg in trip.pakets"
                    :key="pkg.id"
                    type="button"
                    class="flex cursor-pointer flex-col justify-between rounded-xl border p-3 text-left transition-all"
                    :class="
                      selectedPaket?.id === pkg.id
                        ? 'border-[#1E4D36] bg-[#E6F0EA]/60 ring-1 ring-[#1E4D36]'
                        : 'border-[#D6D0C4] bg-white hover:border-[#1E4D36]/60'
                    "
                    @click="selectedPaketId = pkg.id"
                  >
                    <div>
                      <div class="text-xs font-bold text-[#121613]">{{ pkg.kodePaket }}</div>
                      <div class="mt-1 text-xs leading-snug text-[#5C645E]">
                        {{ pkg.deskripsiFasilitas || 'Fasilitas standar open trip' }}
                      </div>
                    </div>
                    <div class="mry-mono mt-2.5 text-sm font-semibold text-[#1E4D36]">
                      {{ formatRupiah(pkg.harga) }}
                    </div>
                  </button>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div>
                  <label class="mry-mono mb-1.5 block text-xs font-semibold tracking-wider text-[#5C645E] uppercase">
                    2. Meeting Point (MEPO)
                  </label>
                  <select
                    v-model="selectedMepo"
                    class="min-h-[44px] w-full rounded-xl border border-[#D6D0C4] bg-white px-3 text-sm text-[#121613]"
                  >
                    <option
                      v-for="m in trip.meetingPoints"
                      :key="m.id"
                      :value="m.namaLokasi"
                    >
                      {{ m.namaLokasi }}
                    </option>
                    <option v-if="!trip.meetingPoints.length" value="Basecamp / Konfirmasi Admin">
                      Basecamp / Konfirmasi Admin
                    </option>
                  </select>
                  <input
                    v-if="isCustomMepoSelected"
                    v-model="customMepoText"
                    type="text"
                    placeholder="Tulis lokasi penjemputan kamu"
                    class="mt-2 min-h-[42px] w-full rounded-xl border border-[#D6D0C4] bg-white px-3 text-sm text-[#121613]"
                  />
                </div>

                <div>
                  <label class="mry-mono mb-1.5 block text-xs font-semibold tracking-wider text-[#5C645E] uppercase">
                    3. Jumlah Peserta
                  </label>
                  <div class="flex h-[44px] items-center justify-between rounded-xl border border-[#D6D0C4] bg-white px-2">
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-base font-bold text-[#121613] hover:bg-[#F5F2EB]"
                      aria-label="Kurangi peserta"
                      @click="jumlahPeserta = Math.max(1, jumlahPeserta - 1)"
                    >
                      -
                    </button>
                    <span class="mry-mono text-sm font-semibold text-[#121613]">
                      {{ jumlahPeserta }} orang
                    </span>
                    <button
                      type="button"
                      class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-base font-bold text-[#121613] hover:bg-[#F5F2EB]"
                      aria-label="Tambah peserta"
                      @click="jumlahPeserta = Math.min(Math.max(1, trip.sisaKuota || 10), jumlahPeserta + 1)"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="trip.detail?.comparisons?.length"
            class="overflow-hidden rounded-xl border border-[#EAE5DA] bg-white"
          >
            <div class="border-b border-[#EAE5DA] bg-[#F5F2EB] px-4 py-2.5 text-xs font-bold tracking-wider text-[#121613] uppercase">
              Perbandingan Fasilitas Paket
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[520px] text-left text-xs">
                <thead class="border-b border-[#EAE5DA] bg-[#FDFCFA] text-[#5C645E]">
                  <tr>
                    <th class="px-4 py-2.5 font-semibold">Fasilitas</th>
                    <th class="px-4 py-2.5 font-semibold">Paket A</th>
                    <th class="px-4 py-2.5 font-semibold">Paket B</th>
                    <th class="px-4 py-2.5 font-semibold">Paket C</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#EAE5DA] text-[#2E3530]">
                  <tr v-for="(row, idx) in trip.detail.comparisons" :key="idx">
                    <td class="px-4 py-2.5 font-medium text-[#121613]">{{ row.feature }}</td>
                    <td class="px-4 py-2.5">{{ row.pkgA }}</td>
                    <td class="px-4 py-2.5">{{ row.pkgB }}</td>
                    <td class="px-4 py-2.5">{{ row.pkgC }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-xl border border-[#EAE5DA] bg-white p-4 sm:p-5">
            <div class="mry-mono text-xs font-semibold tracking-wider text-[#1E4D36] uppercase">
              Ringkasan Itinerary
            </div>
            <div v-if="trip.detail?.itineraryDays?.length" class="mt-3 grid gap-3 sm:grid-cols-2">
              <div
                v-for="(day, dIdx) in trip.detail.itineraryDays"
                :key="dIdx"
                class="rounded-xl border border-[#EAE5DA] bg-[#FDFCFA] p-3.5"
              >
                <div class="text-xs font-bold text-[#121613]">
                  {{ day.day }} · {{ day.title }}
                </div>
                <p v-if="day.desc" class="mt-1 text-xs text-[#5C645E]">{{ day.desc }}</p>
                <ul v-if="day.schedules?.length" class="mt-2 space-y-1 text-xs text-[#2E3530]">
                  <li v-for="(s, sIdx) in day.schedules" :key="sIdx" class="flex gap-2">
                    <span class="mry-mono shrink-0 font-medium text-[#1E4D36]">{{ s.time }}</span>
                    <span>{{ s.event }}</span>
                  </li>
                </ul>
              </div>
            </div>
            <p v-else class="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#2E3530]">
              {{ trip.itinerary }}
            </p>
          </div>
        </div>

        <div class="flex flex-col justify-between gap-3 border-t border-[#EAE5DA] bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-7">
          <div>
            <div class="text-xs text-[#5C645E]">
              Estimasi Total ({{ jumlahPeserta }} peserta) · Booking bisa DP 50%
            </div>
            <div class="flex items-baseline gap-3">
              <span class="mry-mono text-xl font-bold text-[#121613]">
                {{ formatRupiah(totalHarga) }}
              </span>
              <span class="mry-mono text-xs font-medium text-[#1E4D36]">
                DP 50%: {{ formatRupiah(nominalDp50) }}
              </span>
            </div>
          </div>

          <div class="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center">
            <button
              type="button"
              class="min-h-[44px] w-full cursor-pointer rounded-full border border-[#D6D0C4] bg-white px-4 text-sm font-semibold text-[#121613] hover:bg-[#F5F2EB] sm:w-auto"
              @click="emit('close')"
            >
              Tutup
            </button>
            <a
              :href="waBookingUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#1E4D36] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#163B29] sm:w-auto"
            >
              <WaIcon :size="16" />
              <span>Booking Kursi via WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>

