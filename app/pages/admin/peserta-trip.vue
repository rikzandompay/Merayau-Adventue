<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface TripMeta {
  id: number
  judul: string
  tanggalBerangkat: string
  kuota: number
  pesertaCount: number
  pakets: Array<{ id: number; kodePaket: string; deskripsiFasilitas: string; harga: number }>
  meetingPoints: Array<{ id: number; namaLokasi: string; isCustom: boolean }>
}

interface PesertaRow {
  id: number
  idTrip: number
  judulTrip: string
  kodePaket: string | null
  hargaPaket: number | null
  lokasiMepoFinal: string
  nama: string
  noIdentitas: string
  noWa: string
  kontakDarurat: string
  statusBayar: 'Lunas' | 'DP 50%' | 'Belum Bayar'
  nominalBayar: number
  sewaAlatTambahan: string | null
}

interface PesertaResponse {
  items: PesertaRow[]
  trips: TripMeta[]
  countsByStatus: { semua: number; lunas: number; dp50: number; belumBayar: number }
  kpis: {
    terdaftar: number
    kuotaTotal: number
    lunas: number
    lunasNominal: number
    dp50: number
    dp50Nominal: number
    kurangDpNominal: number
    sewaTambahan: number
  }
}

const activeTripId = ref<number | null>(null)
const statusFilter = ref<'Semua' | 'Lunas' | 'DP 50%' | 'Belum Bayar'>('Semua')
const search = ref('')

const { data, refresh } = await useFetch<PesertaResponse>('/api/admin/peserta-trip', {
  query: computed(() => ({
    idTrip: activeTripId.value || undefined,
    statusBayar: statusFilter.value,
    search: search.value || undefined,
  })),
})

const showAddModal = ref(false)
const form = reactive({
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

const modalTrip = computed(() => (data.value?.trips ?? []).find((t) => t.id === form.idTrip) ?? null)
const selectedModalMepo = computed(
  () => modalTrip.value?.meetingPoints.find((m) => m.id === form.idMeetingPoint) ?? null,
)
const selectedModalPaket = computed(
  () => modalTrip.value?.pakets.find((p) => p.id === form.idTripPaket) ?? null,
)

function openAddModal() {
  const targetTrip =
    (activeTripId.value && data.value?.trips.find((t) => t.id === activeTripId.value)) ||
    data.value?.trips?.[0]
  if (!targetTrip) return
  form.idTrip = targetTrip.id
  form.idTripPaket = targetTrip.pakets[0]?.id ?? 0
  form.idMeetingPoint = targetTrip.meetingPoints[0]?.id ?? 0
  form.mepoCustom = ''
  form.nama = ''
  form.noIdentitas = ''
  form.noWa = ''
  form.kontakDarurat = ''
  form.statusBayar = 'DP 50%'
  form.nominalBayar = Math.round((targetTrip.pakets[0]?.harga ?? 0) * 0.5)
  form.sewaAlatTambahan = ''
  showAddModal.value = true
}

watch(
  () => form.idTrip,
  (newId) => {
    const t = data.value?.trips.find((tr) => tr.id === newId)
    if (!t) return
    form.idTripPaket = t.pakets[0]?.id ?? 0
    form.idMeetingPoint = t.meetingPoints[0]?.id ?? 0
  },
)

watch([() => form.idTripPaket, () => form.statusBayar], () => {
  const price = selectedModalPaket.value?.harga ?? 0
  if (form.statusBayar === 'Lunas') form.nominalBayar = price
  else if (form.statusBayar === 'DP 50%') form.nominalBayar = Math.round(price * 0.5)
  else form.nominalBayar = 0
})

const saving = ref(false)
const modalErr = ref('')

async function submitPeserta() {
  modalErr.value = ''
  saving.value = true
  try {
    await $fetch('/api/admin/peserta-trip', {
      method: 'POST',
      body: {
        ...form,
        idTripPaket: form.idTripPaket || null,
        idMeetingPoint: form.idMeetingPoint || null,
        mepoCustom: selectedModalMepo.value?.isCustom ? form.mepoCustom : null,
        sewaAlatTambahan: form.sewaAlatTambahan || null,
      },
    })
    showAddModal.value = false
    await refresh()
  } catch (err: unknown) {
    modalErr.value =
      (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data?.statusMessage ||
      'Gagal mendaftarkan peserta.'
  } finally {
    saving.value = false
  }
}

async function markStatus(row: PesertaRow, nextStatus: 'Lunas' | 'DP 50%' | 'Belum Bayar') {
  const full = row.hargaPaket ?? Math.max(row.nominalBayar, 450000)
  const nextNominal = nextStatus === 'Lunas' ? full : nextStatus === 'DP 50%' ? Math.round(full * 0.5) : 0
  await $fetch(`/api/admin/peserta-trip/${row.id}`, {
    method: 'PUT',
    body: { statusBayar: nextStatus, nominalBayar: nextNominal },
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">MANAJEMEN PESERTA OPEN TRIP</p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">Data Peserta Open Trip</h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Pantau peserta terdaftar per jadwal trip, status pelunasan DP 50%, pilihan Paket A/B/C, meeting point, dan sewa alat tambahan.
        </p>
      </div>
      <button type="button" class="ed-btn-primary" @click="openAddModal">+ Tambah Peserta</button>
    </div>

    <div v-if="data" class="flex flex-wrap items-center gap-2">
      <label for="peserta-trip-filter" class="sr-only">Filter Jadwal Trip</label>
      <select
        id="peserta-trip-filter"
        v-model="activeTripId"
        class="ed-select !min-h-[44px] sm:!min-h-[38px] sm:!w-80 !py-1.5 !text-xs font-medium"
      >
        <option :value="null">
          Semua Trip ({{ data.trips.reduce((acc, t) => acc + t.pesertaCount, 0) }})
        </option>
        <option v-for="t in data.trips" :key="t.id" :value="t.id">
          {{ t.judul }} · {{ t.tanggalBerangkat }} ({{ t.pesertaCount }})
        </option>
      </select>
      <button
        v-if="activeTripId !== null"
        type="button"
        class="ed-btn-ghost !min-h-[44px] sm:!min-h-[38px] !px-3 !text-xs"
        @click="activeTripId = null"
      >
        Reset
      </button>
    </div>

    <div v-if="data" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="ed-card p-4" style="border-color: var(--srf-accent)">
        <div class="text-xs font-medium" style="color: var(--srf-accent)">Peserta Terdaftar</div>
        <div class="font-serif-display tabular mt-1.5 text-2xl font-bold">
          {{ data.kpis.terdaftar }} / {{ data.kpis.kuotaTotal }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-good)">
          sisa {{ Math.max(0, data.kpis.kuotaTotal - data.kpis.terdaftar) }} kursi tersedia
        </div>
      </div>

      <div class="ed-card p-4">
        <div class="text-xs font-medium" style="color: var(--srf-ink-2)">Pembayaran Lunas</div>
        <div class="font-serif-display tabular mt-1.5 text-2xl font-bold">
          {{ data.kpis.lunas }} orang
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-good)">
          {{ formatCompactRupiah(data.kpis.lunasNominal) }} lunas penuh
        </div>
      </div>

      <div class="ed-card p-4">
        <div class="text-xs font-medium" style="color: var(--srf-ink-2)">Baru Bayar DP (50%)</div>
        <div class="font-serif-display tabular mt-1.5 text-2xl font-bold">
          {{ data.kpis.dp50 }} orang
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-warn)">
          {{ formatCompactRupiah(data.kpis.dp50Nominal) }} · kurang
          {{ formatCompactRupiah(data.kpis.kurangDpNominal) }}
        </div>
      </div>

      <div class="ed-card p-4">
        <div class="text-xs font-medium" style="color: var(--srf-ink-2)">Sewa Alat Tambahan</div>
        <div class="font-serif-display tabular mt-1.5 text-2xl font-bold">
          {{ data.kpis.sewaTambahan }} peserta
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3)">Sinkron ke kebutuhan alat basecamp</div>
      </div>
    </div>

    <section class="ed-card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 p-4">
        <input
          v-model="search"
          type="search"
          class="ed-input !w-64 !py-1.5 !text-xs"
          placeholder="Cari nama peserta, WA, atau KTP..."
        />
        <div
          v-if="data"
          class="inline-flex rounded-md border p-0.5 text-xs"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <button
            v-for="st in (['Semua', 'Lunas', 'DP 50%', 'Belum Bayar'] as const)"
            :key="st"
            type="button"
            class="cursor-pointer rounded px-2.5 py-1 font-medium"
            :style="
              statusFilter === st
                ? { backgroundColor: 'var(--srf-raised)', color: 'var(--srf-ink)' }
                : { color: 'var(--srf-ink-2)' }
            "
            @click="statusFilter = st"
          >
            {{ st }}
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr
              class="border-y text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-2)"
            >
              <th class="px-4 py-2.5">Peserta &amp; Identitas</th>
              <th class="px-4 py-2.5">WhatsApp &amp; Darurat</th>
              <th class="px-4 py-2.5">Paket &amp; Titik Kumpul (Mepo)</th>
              <th class="px-4 py-2.5">Pembayaran</th>
              <th class="px-4 py-2.5">Status</th>
              <th class="px-4 py-2.5">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!data?.items.length">
              <td colspan="6" class="px-4 py-8 text-center text-xs" style="color: var(--srf-ink-3)">
                Belum ada peserta terdaftar untuk filter ini.
              </td>
            </tr>
            <tr
              v-for="row in data?.items"
              :key="row.id"
              class="border-b last:border-b-0"
              style="border-color: var(--srf-line)"
            >
              <td class="px-4 py-3">
                <div class="font-semibold">{{ row.nama }}</div>
                <div class="tabular text-xs" style="color: var(--srf-ink-3)">
                  ID {{ row.noIdentitas }}
                </div>
              </td>
              <td class="px-4 py-3 text-xs">
                <div class="tabular font-medium">{{ row.noWa }}</div>
                <div style="color: var(--srf-ink-3)">Darurat: {{ row.kontakDarurat }}</div>
              </td>
              <td class="px-4 py-3 text-xs">
                <div class="font-medium" style="color: var(--srf-accent)">
                  {{ row.kodePaket || 'Reguler' }} · {{ row.lokasiMepoFinal }}
                </div>
                <div style="color: var(--srf-ink-2)">
                  {{ row.sewaAlatTambahan ? `Sewa: ${row.sewaAlatTambahan}` : 'Bawa alat pribadi' }}
                </div>
              </td>
              <td class="px-4 py-3 tabular font-semibold">
                {{ formatRupiah(row.nominalBayar) }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge
                  :label="row.statusBayar"
                  :tone="
                    row.statusBayar === 'Lunas'
                      ? 'good'
                      : row.statusBayar === 'DP 50%'
                        ? 'warn'
                        : 'bad'
                  "
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-if="row.statusBayar !== 'Lunas'"
                    type="button"
                    class="ed-btn-secondary !px-2.5 !py-1 !text-xs"
                    @click="markStatus(row, 'Lunas')"
                  >
                    Tandai Lunas
                  </button>
                  <a
                    :href="buildWaLink(row.noWa, `Halo ${row.nama}, info Open Trip Merayau Outdoor (${row.judulTrip}).`)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                    style="color: var(--srf-good)"
                    title="Hubungi via WhatsApp"
                    :aria-label="`Hubungi ${row.nama} via WhatsApp`"
                  >
                    <WaIcon :size="16" />
                  </a>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div class="ed-card max-h-[92vh] w-full max-w-lg overflow-y-auto p-6 space-y-4">
        <div class="flex items-start justify-between">
          <div>
            <p class="ed-label" style="color: var(--srf-accent)">PENDAFTARAN PESERTA TRIP</p>
            <h2 class="font-serif-display text-xl font-bold">Tambah Peserta Open Trip</h2>
          </div>
          <button type="button" class="ed-btn-ghost !text-xs" @click="showAddModal = false">
            Tutup
          </button>
        </div>

        <form class="space-y-3.5 text-xs" @submit.prevent="submitPeserta">
          <div>
            <label class="ed-label mb-1">JADWAL OPEN TRIP</label>
            <select v-model="form.idTrip" class="ed-select">
              <option v-for="t in data?.trips" :key="t.id" :value="t.id">
                {{ t.judul }} · {{ t.tanggalBerangkat }} ({{ t.pesertaCount }}/{{ t.kuota }})
              </option>
            </select>
          </div>

          <div v-if="modalTrip?.pakets.length" class="space-y-1.5">
            <span class="ed-label">PILIH PAKET TRIP</span>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="p in modalTrip.pakets"
                :key="p.id"
                type="button"
                class="cursor-pointer rounded-md border p-2.5 text-center transition-colors"
                :style="
                  form.idTripPaket === p.id
                    ? {
                        backgroundColor: 'var(--srf-ink)',
                        color: 'var(--srf-bg)',
                        borderColor: 'var(--srf-ink)',
                      }
                    : {
                        backgroundColor: 'var(--srf-raised)',
                        borderColor: 'var(--srf-line-strong)',
                        color: 'var(--srf-ink)',
                      }
                "
                @click="form.idTripPaket = p.id"
              >
                <div class="font-semibold">{{ p.kodePaket }}</div>
                <div class="tabular text-[11px] opacity-85">{{ formatCompactRupiah(p.harga) }}</div>
              </button>
            </div>
          </div>

          <div v-if="modalTrip?.meetingPoints.length" class="space-y-1.5">
            <span class="ed-label">PILIH MEETING POINT</span>
            <div class="space-y-1.5">
              <label
                v-for="m in modalTrip.meetingPoints"
                :key="m.id"
                class="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2"
                :style="{
                  backgroundColor: 'var(--srf-raised)',
                  borderColor:
                    form.idMeetingPoint === m.id ? 'var(--srf-ink)' : 'var(--srf-line-strong)',
                }"
              >
                <input
                  v-model="form.idMeetingPoint"
                  type="radio"
                  :value="m.id"
                  class="accent-[#2563eb]"
                />
                <span class="font-medium">{{ m.namaLokasi }}</span>
              </label>
            </div>
            <input
              v-if="selectedModalMepo?.isCustom"
              v-model="form.mepoCustom"
              type="text"
              class="ed-input mt-1.5"
              placeholder="Tuliskan lokasi titik kumpul sendiri..."
              required
            />
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="ed-label mb-1">NAMA PESERTA</label>
              <input v-model="form.nama" type="text" class="ed-input" required />
            </div>
            <div>
              <label class="ed-label mb-1">NIK / KTP / SIM</label>
              <input v-model="form.noIdentitas" type="text" class="ed-input tabular" required />
            </div>
            <div>
              <label class="ed-label mb-1">NO. WHATSAPP</label>
              <input v-model="form.noWa" type="text" class="ed-input tabular" required />
            </div>
            <div>
              <label class="ed-label mb-1">KONTAK DARURAT</label>
              <input v-model="form.kontakDarurat" type="text" class="ed-input" required />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="ed-label mb-1">STATUS PEMBAYARAN</label>
              <select v-model="form.statusBayar" class="ed-select">
                <option value="Lunas">Lunas</option>
                <option value="DP 50%">DP 50%</option>
                <option value="Belum Bayar">Belum Bayar</option>
              </select>
            </div>
            <div>
              <label class="ed-label mb-1">NOMINAL BAYAR</label>
              <input v-model.number="form.nominalBayar" type="number" min="0" class="ed-input tabular" />
            </div>
          </div>

          <div>
            <label class="ed-label mb-1">SEWA ALAT TAMBAHAN (OPSIONAL)</label>
            <input
              v-model="form.sewaAlatTambahan"
              type="text"
              class="ed-input"
              placeholder="Mis. SB Polar, Trekking Pole"
            />
          </div>

          <div
            v-if="modalErr"
            class="rounded-md border px-3 py-2 font-medium"
            style="
              background-color: var(--srf-well);
              border-color: var(--srf-bad);
              color: var(--srf-bad);
            "
          >
            {{ modalErr }}
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="ed-btn-secondary" @click="showAddModal = false">
              Batal
            </button>
            <button type="submit" class="ed-btn-primary" :disabled="saving">
              {{ saving ? 'Mendaftarkan...' : 'Simpan Peserta Trip' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

