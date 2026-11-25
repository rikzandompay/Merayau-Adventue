<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface RiwayatRow {
  id: number
  idSewa: number | null
  idPenyewa: number | null
  kodeSewa: string
  namaPenyewa: string
  noIdentitas: string
  noWa: string
  jenisJaminan: string
  tanggalPinjam: string
  tanggalKembaliRencana: string
  tanggalKembaliAktual: string
  durasiHari: number
  ringkasanAlat: string
  totalUnit: number
  totalBiayaSewa: number
  dendaTelat: number
  dendaRusak: number
  totalAkhir: number
  kondisiKembali: string
  statusKetepatan: 'Tepat Waktu' | 'Terlambat'
  catatan: string | null
  createdAt: string
}

interface RiwayatResponse {
  items: RiwayatRow[]
  kpis: {
    totalRiwayat: number
    totalNominal: number
    tepatWaktu: number
    terlambat: number
  }
}

const { data, pending, refresh } = await useFetch<RiwayatResponse>('/api/admin/riwayat-penyewa')

type PeriodPreset = 'all' | 'today' | '7d' | '30d' | 'this_month' | 'custom'

const periodPreset = ref<PeriodPreset>('all')
const periodStart = ref('')
const periodEnd = ref('')
const ketepatanFilter = ref<'Semua' | 'Tepat Waktu' | 'Terlambat'>('Semua')
const search = ref('')

watch(periodPreset, (val) => {
  if (val === 'custom' && !periodStart.value && !periodEnd.value) {
    const now = new Date()
    periodStart.value = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
    periodEnd.value = toLocalDateKey(now)
  }
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
  return { start: periodStart.value || null, end: periodEnd.value || null }
})

const invalidCustomRange = computed(
  () =>
    periodPreset.value === 'custom' &&
    Boolean(periodStart.value && periodEnd.value && periodStart.value > periodEnd.value),
)

const periodLabel = computed(() => {
  if (periodPreset.value === 'all') return 'Semua Periode'
  if (periodPreset.value === 'today') return 'Hari Ini'
  if (periodPreset.value === '7d') return '7 Hari Terakhir'
  if (periodPreset.value === '30d') return '30 Hari Terakhir'
  if (periodPreset.value === 'this_month') return 'Bulan Ini'
  if (periodStart.value && periodEnd.value) {
    return `${formatDateShort(periodStart.value)} - ${formatDateShort(periodEnd.value)}`
  }
  if (periodStart.value) return `Mulai ${formatDateShort(periodStart.value)}`
  if (periodEnd.value) return `Sampai ${formatDateShort(periodEnd.value)}`
  return 'Rentang Tanggal'
})

const allRows = computed(() => data.value?.items ?? [])

const periodSearchRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const { start, end } = periodBounds.value
  if (invalidCustomRange.value) return []

  return allRows.value.filter((row) => {
    if (start || end) {
      const key = rowDateKey(row.tanggalKembaliAktual)
      if (!key) return false
      if (start && key < start) return false
      if (end && key > end) return false
    }

    if (q) {
      const haystack = `${row.kodeSewa} ${row.namaPenyewa} ${row.noIdentitas} ${row.noWa} ${row.ringkasanAlat}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })
})

const filteredRows = computed(() => {
  if (ketepatanFilter.value === 'Semua') return periodSearchRows.value
  return periodSearchRows.value.filter((row) => row.statusKetepatan === ketepatanFilter.value)
})

const filteredNominalSum = computed(() =>
  filteredRows.value.reduce((acc, r) => acc + r.totalAkhir, 0),
)
const filteredTepatCount = computed(
  () => periodSearchRows.value.filter((r) => r.statusKetepatan === 'Tepat Waktu').length,
)
const filteredTelatCount = computed(
  () => periodSearchRows.value.filter((r) => r.statusKetepatan === 'Terlambat').length,
)

const hasActiveFilters = computed(
  () =>
    periodPreset.value !== 'all' ||
    ketepatanFilter.value !== 'Semua' ||
    search.value.trim().length > 0,
)

function resetFilters() {
  periodPreset.value = 'all'
  periodStart.value = ''
  periodEnd.value = ''
  ketepatanFilter.value = 'Semua'
  search.value = ''
}

const detailTarget = ref<RiwayatRow | null>(null)
const deleteTarget = ref<RiwayatRow | null>(null)
const deletingId = ref<number | null>(null)
const toastMsg = ref<{ text: string; tone: 'good' | 'bad' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(text: string, tone: 'good' | 'bad' = 'good') {
  toastMsg.value = { text, tone }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = null
  }, 3000)
}

function openDeleteFromDetail() {
  if (!detailTarget.value) return
  deleteTarget.value = detailTarget.value
  detailTarget.value = null
}

function closeDeleteModal() {
  if (deletingId.value) return
  deleteTarget.value = null
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deletingId.value = target.id
  try {
    await $fetch(`/api/admin/riwayat-penyewa/${target.id}`, { method: 'DELETE' })
    deleteTarget.value = null
    if (detailTarget.value?.id === target.id) {
      detailTarget.value = null
    }
    await refresh()
    showToast(`Riwayat ${target.kodeSewa} (${target.namaPenyewa}) berhasil dihapus.`)
  } catch (err: unknown) {
    showToast(extractErrorMessage(err, 'Gagal menghapus data riwayat.'), 'bad')
  } finally {
    deletingId.value = null
  }
}

function exportCsv() {
  downloadCsv(
    `merayau-riwayat-penyewa-${periodPreset.value}.csv`,
    [
      'Kode Sewa',
      'Nama Penyewa',
      'NIK / SIM',
      'WhatsApp',
      'Jaminan',
      'Tanggal Pinjam',
      'Rencana Kembali',
      'Aktual Kembali',
      'Durasi (Hari)',
      'Ringkasan Alat',
      'Total Unit',
      'Biaya Sewa',
      'Denda Telat',
      'Denda Rusak',
      'Total Akhir',
      'Kondisi Kembali',
      'Ketepatan',
    ],
    filteredRows.value.map((r) => [
      r.kodeSewa,
      r.namaPenyewa,
      r.noIdentitas,
      r.noWa,
      r.jenisJaminan,
      r.tanggalPinjam,
      r.tanggalKembaliRencana,
      r.tanggalKembaliAktual,
      r.durasiHari,
      r.ringkasanAlat,
      r.totalUnit,
      r.totalBiayaSewa,
      r.dendaTelat,
      r.dendaRusak,
      r.totalAkhir,
      r.kondisiKembali,
      r.statusKetepatan,
    ]),
  )
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (deleteTarget.value && !deletingId.value) {
    deleteTarget.value = null
  } else if (detailTarget.value) {
    detailTarget.value = null
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="space-y-5 sm:space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <span class="ed-label" style="color: var(--srf-accent);">ARSIP SEWA SELESAI</span>
        <h1 class="mt-0.5 text-2xl font-bold tracking-tight" style="color: var(--srf-ink);">
          Riwayat Penyewa
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2);">
          Catatan otomatis penyewa yang sudah menyelesaikan pengembalian alat.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="ed-btn-secondary !text-xs"
          :disabled="!filteredRows.length"
          @click="exportCsv"
        >
          Export CSV
        </button>
        <button
          type="button"
          class="ed-btn-secondary !text-xs"
          @click="refresh()"
        >
          Segarkan
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      <div class="ed-card p-4 sm:p-5">
        <div class="text-xs font-semibold" style="color: var(--srf-ink-2);">Total Riwayat</div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink);">
          {{ filteredRows.length }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3);">
          Filter aktif · {{ periodLabel }}
        </div>
      </div>

      <div class="ed-card p-4 sm:p-5">
        <div class="text-xs font-semibold" style="color: var(--srf-ink-2);">Total Nominal</div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink);">
          {{ formatRupiah(filteredNominalSum) }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3);">
          Akumulasi biaya sewa + denda
        </div>
      </div>

      <button
        type="button"
        class="ed-card ed-card-hover cursor-pointer p-4 text-left sm:p-5"
        :style="ketepatanFilter === 'Tepat Waktu' ? { borderColor: 'var(--srf-good-border)' } : {}"
        @click="ketepatanFilter = ketepatanFilter === 'Tepat Waktu' ? 'Semua' : 'Tepat Waktu'"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold" style="color: var(--srf-ink-2);">Tepat Waktu</span>
          <StatusBadge variant="light" tone="good" label="Tepat" />
        </div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink);">
          {{ filteredTepatCount }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3);">
          Pengembalian sesuai jadwal
        </div>
      </button>

      <button
        type="button"
        class="ed-card ed-card-hover cursor-pointer p-4 text-left sm:p-5"
        :style="ketepatanFilter === 'Terlambat' ? { borderColor: 'var(--srf-warn-border)' } : {}"
        @click="ketepatanFilter = ketepatanFilter === 'Terlambat' ? 'Semua' : 'Terlambat'"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold" style="color: var(--srf-ink-2);">Terlambat</span>
          <StatusBadge variant="light" tone="warn" label="Telat" />
        </div>
        <div class="tabular mt-1.5 text-xl font-bold sm:text-2xl" style="color: var(--srf-ink);">
          {{ filteredTelatCount }}
        </div>
        <div class="mt-1 text-xs" style="color: var(--srf-ink-3);">
          Pengembalian lewat jadwal
        </div>
      </button>
    </div>

    <div class="ed-card overflow-hidden">
      <div
        class="flex flex-col gap-3 border-b p-4 sm:p-5"
        style="border-color: var(--srf-line);"
      >
        <div class="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div class="grid grid-cols-2 gap-2.5 lg:flex lg:items-center">
            <select
              v-model="periodPreset"
              class="ed-select !min-h-[44px] lg:!min-h-[40px] lg:!w-44 !py-2 !text-xs font-medium"
              aria-label="Filter periode riwayat"
            >
              <option value="all">Semua Periode</option>
              <option value="today">Hari Ini</option>
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
              <option value="this_month">Bulan Ini</option>
              <option value="custom">Pilih Tanggal...</option>
            </select>

            <select
              v-model="ketepatanFilter"
              class="ed-select !min-h-[44px] lg:!min-h-[40px] lg:!w-44 !py-2 !text-xs font-medium"
              aria-label="Filter ketepatan pengembalian"
            >
              <option value="Semua">Semua Status</option>
              <option value="Tepat Waktu">Tepat Waktu</option>
              <option value="Terlambat">Terlambat</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <div class="relative flex-1 lg:w-64 lg:flex-initial">
              <svg
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style="color: var(--srf-ink-3);"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                v-model="search"
                type="search"
                placeholder="Cari kode, nama, NIK, WA, atau alat..."
                class="ed-input !min-h-[44px] lg:!min-h-[40px] !pl-9 !pr-3 !py-1.5 !text-xs"
              />
            </div>

            <button
              v-if="hasActiveFilters"
              type="button"
              class="ed-btn-ghost shrink-0 !min-h-[44px] lg:!min-h-[38px] !px-3 !text-xs"
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
          <span class="text-xs font-medium" style="color: var(--srf-ink-3);">Periode:</span>
          <input
            v-model="periodStart"
            type="date"
            aria-label="Tanggal mulai riwayat"
            class="ed-input !min-h-[44px] sm:!min-h-[38px] sm:!w-44 !py-1.5 !text-xs tabular"
          />
          <span class="text-xs" style="color: var(--srf-ink-3);">s/d</span>
          <input
            v-model="periodEnd"
            type="date"
            aria-label="Tanggal selesai riwayat"
            class="ed-input !min-h-[44px] sm:!min-h-[38px] sm:!w-44 !py-1.5 !text-xs tabular"
          />
          <span v-if="invalidCustomRange" class="text-xs font-medium" style="color: var(--srf-warn-ink);">
            Tanggal mulai melewati tanggal selesai.
          </span>
        </div>
      </div>

      <div
        v-if="pending && !allRows.length"
        class="p-10 text-center text-sm"
        style="color: var(--srf-ink-3);"
      >
        Memuat data riwayat penyewa...
      </div>

      <div v-else-if="!filteredRows.length" class="p-12 text-center">
        <p class="text-sm font-medium" style="color: var(--srf-ink-2);">
          Belum ada riwayat sewa selesai yang cocok dengan filter ini.
        </p>
        <div v-if="hasActiveFilters" class="mt-4">
          <button type="button" class="ed-btn-secondary !text-xs" @click="resetFilters">
            Reset Filter
          </button>
        </div>
      </div>

      <template v-else>
        <!-- Desktop Table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr
                class="border-b text-[11px] font-semibold uppercase tracking-wider"
                style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-3);"
              >
                <th class="px-4 py-3 whitespace-nowrap">Kode &amp; Selesai</th>
                <th class="px-4 py-3 whitespace-nowrap">Penyewa</th>
                <th class="px-4 py-3 whitespace-nowrap">Ringkasan Alat</th>
                <th class="px-4 py-3 whitespace-nowrap">Periode Sewa</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Total Akhir</th>
                <th class="px-4 py-3 whitespace-nowrap">Ketepatan</th>
                <th class="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in filteredRows"
                :key="row.id"
                class="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-[var(--srf-hover)]"
                :style="{
                  borderColor: 'var(--srf-line)',
                  backgroundColor: detailTarget?.id === row.id ? 'var(--srf-accent-soft)' : undefined,
                }"
                @click="detailTarget = row"
              >
                <td class="px-4 py-3.5 align-middle whitespace-nowrap">
                  <div class="tabular text-xs font-semibold" style="color: var(--srf-ink);">
                    {{ row.kodeSewa }}
                  </div>
                  <div class="tabular mt-0.5 text-[11px]" style="color: var(--srf-ink-3);">
                    {{ formatDateShort(row.tanggalKembaliAktual) }}
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle whitespace-nowrap">
                  <div class="text-xs font-semibold" style="color: var(--srf-ink);">
                    {{ row.namaPenyewa }}
                  </div>
                  <div class="tabular mt-0.5 text-[11px]" style="color: var(--srf-ink-3);">
                    {{ row.noWa }}
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle min-w-[220px]">
                  <div class="text-xs font-medium" style="color: var(--srf-ink);">
                    {{ row.totalUnit }} unit · {{ row.kondisiKembali }}
                  </div>
                  <p class="mt-0.5 line-clamp-2 text-xs leading-relaxed" style="color: var(--srf-ink-3);">
                    {{ row.ringkasanAlat }}
                  </p>
                </td>
                <td class="px-4 py-3.5 align-middle whitespace-nowrap tabular">
                  <div class="text-xs font-medium" style="color: var(--srf-ink);">
                    {{ formatDateShort(row.tanggalPinjam) }} - {{ formatDateShort(row.tanggalKembaliRencana) }}
                  </div>
                  <div class="mt-0.5 text-[11px]" style="color: var(--srf-ink-3);">
                    {{ row.durasiHari }} hari · {{ row.jenisJaminan }}
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap tabular">
                  <div class="text-sm font-semibold" style="color: var(--srf-ink);">
                    {{ formatRupiah(row.totalAkhir) }}
                  </div>
                  <div
                    v-if="row.dendaTelat + row.dendaRusak > 0"
                    class="mt-0.5 text-[11px]"
                    style="color: var(--srf-warn-ink);"
                  >
                    Termasuk denda {{ formatRupiah(row.dendaTelat + row.dendaRusak) }}
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle whitespace-nowrap">
                  <StatusBadge
                    variant="outline"
                    :label="row.statusKetepatan"
                    :tone="row.statusKetepatan === 'Tepat Waktu' ? 'good' : 'warn'"
                  />
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                  <div class="inline-flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      title="Lihat detail riwayat"
                      aria-label="Lihat detail riwayat"
                      @click.stop="detailTarget = row"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <a
                      :href="buildWaLink(row.noWa, `Halo ${row.namaPenyewa}, terima kasih telah menyewa alat (${row.kodeSewa}) di Merayau Outdoor.`)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      style="color: var(--srf-good);"
                      title="Hubungi via WhatsApp"
                      :aria-label="`Hubungi ${row.namaPenyewa} via WhatsApp`"
                      @click.stop
                    >
                      <WaIcon :size="16" />
                    </a>
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
                      style="color: var(--srf-bad-ink); border-color: var(--srf-bad-border); background-color: var(--srf-bad-soft);"
                      :disabled="deletingId === row.id"
                      title="Hapus riwayat"
                      aria-label="Hapus riwayat"
                      @click.stop="deleteTarget = row"
                    >
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile Cards -->
        <div class="divide-y md:hidden" style="border-color: var(--srf-line);">
          <div
            v-for="row in filteredRows"
            :key="`mob-${row.id}`"
            class="space-y-3 p-4"
            @click="detailTarget = row"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="tabular text-xs font-semibold" style="color: var(--srf-ink);">
                  {{ row.kodeSewa }}
                </div>
                <div class="tabular text-[11px]" style="color: var(--srf-ink-3);">
                  Selesai {{ formatDateShort(row.tanggalKembaliAktual) }}
                </div>
              </div>
              <StatusBadge
                variant="outline"
                :label="row.statusKetepatan"
                :tone="row.statusKetepatan === 'Tepat Waktu' ? 'good' : 'warn'"
              />
            </div>

            <div class="space-y-1">
              <div class="text-sm font-semibold" style="color: var(--srf-ink);">
                {{ row.namaPenyewa }}
                <span class="tabular text-xs font-normal" style="color: var(--srf-ink-3);">
                  · {{ row.noWa }}
                </span>
              </div>
              <p class="line-clamp-2 text-xs" style="color: var(--srf-ink-2);">
                {{ row.ringkasanAlat }}
              </p>
              <div class="text-[11px]" style="color: var(--srf-ink-3);">
                {{ formatDateShort(row.tanggalPinjam) }} - {{ formatDateShort(row.tanggalKembaliRencana) }} · {{ row.durasiHari }} hari
              </div>
            </div>

            <div class="flex items-center justify-between gap-3 pt-1">
              <div>
                <div class="tabular text-sm font-bold" style="color: var(--srf-ink);">
                  {{ formatRupiah(row.totalAkhir) }}
                </div>
                <div v-if="row.dendaTelat + row.dendaRusak > 0" class="tabular text-[11px]" style="color: var(--srf-warn-ink);">
                  Denda {{ formatRupiah(row.dendaTelat + row.dendaRusak) }}
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="ed-btn-secondary h-11 px-3 text-xs"
                  @click.stop="detailTarget = row"
                >
                  Detail
                </button>
                <a
                  :href="buildWaLink(row.noWa, `Halo ${row.namaPenyewa}, info riwayat sewa ${row.kodeSewa} di Merayau Outdoor.`)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="ed-btn-secondary h-11 w-11 !p-0"
                  style="color: var(--srf-good);"
                  aria-label="Hubungi WhatsApp"
                  @click.stop
                >
                  <WaIcon :size="16" />
                </a>
                <button
                  type="button"
                  class="ed-btn-secondary h-11 w-11 !p-0"
                  style="color: var(--srf-bad-ink); border-color: var(--srf-bad-border); background-color: var(--srf-bad-soft);"
                  :disabled="deletingId === row.id"
                  aria-label="Hapus riwayat"
                  @click.stop="deleteTarget = row"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Table Footer -->
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs"
          style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-3);"
        >
          <span>Menampilkan {{ filteredRows.length }} dari {{ allRows.length }} riwayat</span>
          <span>Masuk otomatis saat sewa selesai</span>
        </div>
      </template>
    </div>

    <!-- Modal Detail Riwayat -->
    <div
      v-if="detailTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="detailTarget = null"
    >
      <div
        class="ed-card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-detail-riwayat-title"
      >
        <div
          class="flex items-start justify-between gap-3 px-5 py-4"
          style="border-bottom: 1px solid var(--srf-line);"
        >
          <div class="min-w-0">
            <span class="ed-label" style="color: var(--srf-accent);">
              DETAIL RIWAYAT · {{ detailTarget.kodeSewa }}
            </span>
            <h2 id="modal-detail-riwayat-title" class="mt-0.5 text-lg font-bold" style="color: var(--srf-ink);">
              {{ detailTarget.namaPenyewa }}
            </h2>
          </div>
          <button
            type="button"
            class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px]"
            aria-label="Tutup modal detail"
            @click="detailTarget = null"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4 p-5 text-xs">
          <div class="ed-well grid grid-cols-2 gap-3 p-3">
            <div>
              <span class="ed-label">NIK / SIM</span>
              <div class="mt-0.5 font-medium tabular" style="color: var(--srf-ink);">
                {{ detailTarget.noIdentitas }}
              </div>
            </div>
            <div>
              <span class="ed-label">WHATSAPP &amp; JAMINAN</span>
              <div class="mt-0.5 font-medium tabular" style="color: var(--srf-ink);">
                {{ detailTarget.noWa }} · {{ detailTarget.jenisJaminan }}
              </div>
            </div>
            <div>
              <span class="ed-label">TANGGAL PINJAM</span>
              <div class="mt-0.5 font-medium tabular" style="color: var(--srf-ink);">
                {{ formatDateTimeShort(detailTarget.tanggalPinjam) }}
              </div>
            </div>
            <div>
              <span class="ed-label">RENCANA KEMBALI</span>
              <div class="mt-0.5 font-medium tabular" style="color: var(--srf-ink);">
                {{ formatDateTimeShort(detailTarget.tanggalKembaliRencana) }}
              </div>
            </div>
            <div>
              <span class="ed-label">AKTUAL KEMBALI</span>
              <div class="mt-0.5 font-semibold tabular" style="color: var(--srf-ink);">
                {{ formatDateTimeShort(detailTarget.tanggalKembaliAktual) }}
              </div>
            </div>
            <div>
              <span class="ed-label">KETEPATAN &amp; KONDISI</span>
              <div class="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  variant="outline"
                  :label="detailTarget.statusKetepatan"
                  :tone="detailTarget.statusKetepatan === 'Tepat Waktu' ? 'good' : 'warn'"
                />
                <span style="color: var(--srf-ink-2);">{{ detailTarget.kondisiKembali }}</span>
              </div>
            </div>
          </div>

          <div>
            <span class="ed-label">ALAT YANG DISEWA ({{ detailTarget.totalUnit }} UNIT · {{ detailTarget.durasiHari }} HARI)</span>
            <div
              class="mt-1.5 rounded-[10px] p-3 leading-relaxed"
              style="background-color: var(--srf-well); border: 1px solid var(--srf-line); color: var(--srf-ink);"
            >
              {{ detailTarget.ringkasanAlat }}
            </div>
          </div>

          <div
            v-if="detailTarget.catatan"
            class="rounded-[10px] p-3"
            style="background-color: var(--srf-well); border: 1px solid var(--srf-line);"
          >
            <span class="ed-label">CATATAN</span>
            <p class="mt-1" style="color: var(--srf-ink-2);">{{ detailTarget.catatan }}</p>
          </div>

          <div class="space-y-1.5 border-t pt-3 tabular" style="border-color: var(--srf-line);">
            <div class="flex justify-between" style="color: var(--srf-ink-2);">
              <span>Biaya sewa</span>
              <span>{{ formatRupiah(detailTarget.totalBiayaSewa) }}</span>
            </div>
            <div class="flex justify-between" style="color: var(--srf-ink-2);">
              <span>Denda keterlambatan</span>
              <span>{{ formatRupiah(detailTarget.dendaTelat) }}</span>
            </div>
            <div class="flex justify-between" style="color: var(--srf-ink-2);">
              <span>Denda kerusakan</span>
              <span>{{ formatRupiah(detailTarget.dendaRusak) }}</span>
            </div>
            <div class="flex justify-between pt-1 text-base font-bold" style="color: var(--srf-ink);">
              <span>Total Akhir</span>
              <span>{{ formatRupiah(detailTarget.totalAkhir) }}</span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2 border-t pt-3" style="border-color: var(--srf-line);">
            <a
              :href="buildWaLink(detailTarget.noWa, `Halo ${detailTarget.namaPenyewa}, terima kasih telah menyelesaikan sewa (${detailTarget.kodeSewa}) di Merayau Outdoor.`)"
              target="_blank"
              rel="noopener noreferrer"
              class="ed-btn-wa flex-1 justify-center"
            >
              <WaIcon :size="16" />
              <span>Hubungi WhatsApp</span>
            </a>
            <button
              type="button"
              class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] px-3.5 text-sm font-medium transition-colors"
              style="border: 1px solid var(--srf-bad-border); background-color: var(--srf-bad-soft); color: var(--srf-bad-ink);"
              @click="openDeleteFromDetail"
            >
              Hapus
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Konfirmasi Hapus -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="closeDeleteModal"
    >
      <div
        class="ed-card w-full max-w-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-hapus-riwayat-title"
      >
        <div class="p-5">
          <span class="ed-label" style="color: var(--srf-bad);">KONFIRMASI HAPUS</span>
          <h2 id="modal-hapus-riwayat-title" class="mt-1 text-lg font-bold" style="color: var(--srf-ink);">
            Hapus riwayat "{{ deleteTarget.kodeSewa }}"?
          </h2>
          <p class="mt-2 text-sm leading-relaxed" style="color: var(--srf-ink-2);">
            Menghapus catatan arsip ini tidak mengubah data pelanggan di Data Penyewa maupun transaksi historis di Transaksi.
          </p>
        </div>
        <div
          class="flex justify-end gap-2 px-5 py-3.5"
          style="background-color: var(--srf-well); border-top: 1px solid var(--srf-line);"
        >
          <button
            type="button"
            class="ed-btn-secondary"
            :disabled="Boolean(deletingId)"
            @click="closeDeleteModal"
          >
            Batal
          </button>
          <button
            type="button"
            class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            style="background-color: var(--srf-bad);"
            :disabled="Boolean(deletingId)"
            @click="confirmDelete"
          >
            {{ deletingId ? 'Menghapus...' : 'Hapus Riwayat' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div
      v-if="toastMsg"
      class="fixed bottom-5 right-5 z-50 rounded-[12px] px-4 py-3 text-xs font-medium shadow-lg"
      :style="
        toastMsg.tone === 'bad'
          ? { backgroundColor: 'var(--srf-bad-soft)', border: '1px solid var(--srf-bad-border)', color: 'var(--srf-bad-ink)' }
          : { backgroundColor: 'var(--srf-good-soft)', border: '1px solid var(--srf-good-border)', color: 'var(--srf-good-ink)' }
      "
    >
      {{ toastMsg.text }}
    </div>
  </div>
</template>

