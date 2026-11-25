<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface TopItemRow {
  idAlat?: number
  kodeAlat?: string
  namaAlat: string
  foto?: string | null
  units: number
  revenue?: number
  stokTersedia?: number
  stokTotal?: number
  statusStok?: 'Aman' | 'Menipis' | 'Kritis'
}

interface DashboardResponse {
  period: string
  days: number
  kpis: {
    pendapatanSewa: number
    revDeltaPct: number | null
    transaksiCount: number
    unitSedangDisewa: number
    activeTransaksiCount: number
    stokTersedia: number
    stokTotalSemua: number
    transaksiTerlambat: number
  }
  trendSeries: Array<{ label: string; current: number; previous: number }>
  revenueSources: Array<{ label: string; amount: number }>
  categoryBreakdown: Array<{ namaKategori: string; units: number }>
  topItems: TopItemRow[]
  weekdayActivity?: Array<{ label: string; count: number }>
  serviceDistribution?: Array<{
    key: string
    label: string
    count: number
    amount: number
    color: 'blue' | 'green' | 'orange'
  }>
  readiness?: {
    stockReadyPct: number
    repeatCustomerPct: number
    repeatCustomerCount: number
    totalCustomerCount: number
  }
  stokAlatPanel: Array<{
    id: number
    kodeAlat: string
    namaAlat: string
    namaKategori: string
    stokTotal: number
    stokDisewa: number
    stokTersedia: number
    pctTersedia: number
    statusStok: 'Aman' | 'Menipis' | 'Kritis'
  }>
  stokAlatTotalAktif?: number
  recentTransactions: Array<{
    id: number
    kodeSewa: string
    penyewaNama: string
    penyewaAlamat: string
    ringkasanItem: string
    durasiHari: number
    totalBiayaSewa: number
    tanggalKembaliRencana: string
    statusSewa: 'Disewa' | 'Terlambat' | 'Selesai'
  }>
}

const period = ref<'7d' | '30d' | '90d' | '1y'>('30d')
const search = ref('')
const statusFilter = ref<'Semua' | 'Disewa' | 'Terlambat' | 'Selesai'>('Semua')
const activeKpi = ref<'rev' | 'tx' | 'rented' | 'late'>('rev')
const gaugeMode = ref<'stock' | 'repeat'>('stock')
const hoveredTrendIdx = ref<number | null>(null)
const hoveredDayIdx = ref<number | null>(null)

const { data, pending, error, refresh } = await useFetch<DashboardResponse>('/api/admin/dashboard', {
  query: { period },
  watch: [period],
})

const periods = [
  { key: '7d' as const, label: '7 Hari' },
  { key: '30d' as const, label: '30 Hari' },
  { key: '90d' as const, label: '90 Hari' },
  { key: '1y' as const, label: '1 Tahun' },
]

const dateRangeLabel = computed(() => {
  const days = data.value?.days ?? 30
  const end = new Date()
  const start = new Date(end.getTime() - days * 86_400_000)
  const fmt = (d: Date) =>
    d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} - ${fmt(end)}`
})

function buildSmoothSvgPath(pts: ReadonlyArray<readonly [number, number]>): string {
  if (!pts.length) return ''
  if (pts.length === 1) return `M ${pts[0]![0]} ${pts[0]![1]}`
  let d = `M ${pts[0]![0]} ${pts[0]![1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]!
    const p1 = pts[i + 1]!
    const cx = Math.round((p0[0] + p1[0]) / 2)
    d += ` C ${cx} ${p0[1]}, ${cx} ${p1[1]}, ${p1[0]} ${p1[1]}`
  }
  return d
}

const chartGeometry = computed(() => {
  const series = data.value?.trendSeries ?? []
  const w = 520
  const h = 160
  const padX = 16
  const padY = 16
  if (!series.length) {
    return { currentPath: '', prevPath: '', areaPath: '', curCoords: [] as Array<readonly [number, number]>, yTicks: ['0', '0', '0'] }
  }
  const maxVal = Math.max(1, ...series.map((s) => Math.max(s.current, s.previous)))
  const stepX = series.length > 1 ? (w - padX * 2) / (series.length - 1) : 0

  const toCoords = (vals: number[]) =>
    vals.map((v, i) => {
      const x = Math.round(padX + i * stepX)
      const y = Math.round(h - padY - (v / maxVal) * (h - padY * 2))
      return [x, y] as const
    })

  const curCoords = toCoords(series.map((s) => s.current))
  const prevCoords = toCoords(series.map((s) => s.previous))
  const currentPath = buildSmoothSvgPath(curCoords)
  const prevPath = buildSmoothSvgPath(prevCoords)
  const first = curCoords[0]!
  const last = curCoords[curCoords.length - 1]!
  const areaPath = `${currentPath} L ${last[0]} ${h - padY} L ${first[0]} ${h - padY} Z`

  return {
    currentPath,
    prevPath,
    areaPath,
    curCoords,
    yTicks: [
      formatCompactRupiah(maxVal).replace('Rp ', ''),
      formatCompactRupiah(Math.round(maxVal / 2)).replace('Rp ', ''),
      '0',
    ],
  }
})

const serviceMaxCount = computed(() =>
  Math.max(1, ...(data.value?.serviceDistribution ?? []).map((s) => s.count)),
)

const weekdayBars = computed(() => {
  const raw = data.value?.weekdayActivity ?? [
    { label: 'Min', count: 0 },
    { label: 'Sen', count: 0 },
    { label: 'Sel', count: 0 },
    { label: 'Rab', count: 0 },
    { label: 'Kam', count: 0 },
    { label: 'Jum', count: 0 },
    { label: 'Sab', count: 0 },
  ]
  const max = Math.max(1, ...raw.map((r) => r.count))
  let peakIdx = 0
  let peakVal = -1
  raw.forEach((r, idx) => {
    if (r.count > peakVal) {
      peakVal = r.count
      peakIdx = idx
    }
  })
  return raw.map((r, idx) => ({
    ...r,
    heightPct: Math.max(14, Math.round((r.count / max) * 100)),
    isPeak: peakVal > 0 && idx === peakIdx,
  }))
})

const gaugePercent = computed(() => {
  if (gaugeMode.value === 'repeat') {
    return data.value?.readiness?.repeatCustomerPct ?? 0
  }
  return data.value?.readiness?.stockReadyPct ?? 0
})

const gaugeTicks = computed(() => {
  const total = 34
  const pct = Math.min(100, Math.max(0, gaugePercent.value))
  const filledCount = Math.round((pct / 100) * total)
  const cx = 120
  const cy = 114
  const rInner = 74
  const rOuter = 94
  return Array.from({ length: total }, (_, i) => {
    const angle = Math.PI - (i / (total - 1)) * Math.PI
    const x1 = cx + Math.cos(angle) * rInner
    const y1 = cy - Math.sin(angle) * rInner
    const x2 = cx + Math.cos(angle) * rOuter
    const y2 = cy - Math.sin(angle) * rOuter
    const filled = i < filledCount
    const ratio = total > 1 ? i / (total - 1) : 0
    const color = !filled
      ? 'var(--srf-line-strong)'
      : ratio < 0.45
        ? '#4ade80'
        : '#16a34a'
    return {
      x1: x1.toFixed(1),
      y1: y1.toFixed(1),
      x2: x2.toFixed(1),
      y2: y2.toFixed(1),
      color,
    }
  })
})

const filteredRecent = computed(() => {
  const list = data.value?.recentTransactions ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter((tx) => {
    if (statusFilter.value !== 'Semua' && tx.statusSewa !== statusFilter.value) return false
    if (
      q &&
      !tx.kodeSewa.toLowerCase().includes(q) &&
      !tx.penyewaNama.toLowerCase().includes(q) &&
      !tx.ringkasanItem.toLowerCase().includes(q)
    ) {
      return false
    }
    return true
  })
})

function txBadgeTone(status: string): 'good' | 'bad' | 'accent' | 'neutral' {
  if (status === 'Selesai') return 'good'
  if (status === 'Terlambat') return 'bad'
  if (status === 'Disewa') return 'accent'
  return 'neutral'
}

function exportCsv() {
  const rows = filteredRecent.value
  if (!rows.length || !import.meta.client) return
  const headers = ['Kode Sewa', 'Penyewa', 'Item', 'Durasi (Hari)', 'Total Biaya', 'Tenggat Kembali', 'Status']
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.map(escape).join(','),
    ...rows.map((r) =>
      [
        r.kodeSewa,
        r.penyewaNama,
        r.ringkasanItem,
        r.durasiHari,
        r.totalBiayaSewa,
        r.tanggalKembaliRencana,
        r.statusSewa,
      ]
        .map(escape)
        .join(','),
    ),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `merayau-transaksi-${period.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight" style="color: var(--srf-ink)">
          Dashboard
        </h1>
        <p class="mt-0.5 text-xs sm:text-sm" style="color: var(--srf-ink-3)">
          Ringkasan operasional Basecamp Merayau Outdoor ·
          <span v-if="data" style="color: var(--srf-ink-2)">
            {{ data.kpis.transaksiCount }} transaksi dalam {{ data.days }} hari terakhir
          </span>
          <span v-else>memuat metrik basecamp...</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="inline-flex min-h-[40px] items-center overflow-hidden rounded-[10px] border text-xs font-medium"
          style="
            background-color: var(--srf-surface);
            border-color: var(--srf-line-strong);
            color: var(--srf-ink-2);
          ">
          <span class="hidden items-center gap-1.5 px-3.5 py-2 sm:inline-flex">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="color: var(--srf-ink-3)"
              aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.8" />
              <path d="M8 3v4m8-4v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <span class="tabular">{{ dateRangeLabel }}</span>
          </span>
          <span class="hidden h-5 w-px sm:inline-block" style="background-color: var(--srf-line-strong)" />
          <select v-model="period"
            class="cursor-pointer bg-transparent px-3 py-2 text-xs font-semibold focus:outline-none"
            style="color: var(--srf-ink)" aria-label="Pilih periode dashboard">
            <option v-for="p in periods" :key="p.key" :value="p.key">{{ p.label }}</option>
          </select>
        </div>

        <NuxtLink to="/admin/sewa" class="ed-btn-secondary !py-2 !text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" stroke="currentColor"
              stroke-width="1.8" stroke-linejoin="round" />
          </svg>
          Catat Sewa
        </NuxtLink>

        <button type="button" class="ed-btn-primary !py-2 !text-xs" :disabled="!filteredRecent.length"
          @click="exportCsv">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4v11m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>

    <div v-if="error" class="ed-card p-5 text-sm"
      style="border-color: var(--srf-bad-border); color: var(--srf-bad-ink)">
      Gagal memuat dashboard: {{ error.statusMessage || error.message }}
    </div>

    <div v-else-if="pending && !data" class="ed-card p-8 text-sm" style="color: var(--srf-ink-3)">
      Memuat ringkasan dan daftar transaksi basecamp...
    </div>

    <template v-else-if="data">
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" class="ed-card ed-card-hover cursor-pointer p-5 text-left"
          :style="activeKpi === 'rev' ? { borderColor: 'var(--srf-accent-border)' } : {}" @click="activeKpi = 'rev'">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Pendapatan Sewa</span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl"
              style="background-color: var(--srf-well); color: var(--srf-ink-2)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3v18m4.5-14.5H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H7.5" stroke="currentColor"
                  stroke-width="1.9" stroke-linecap="round" />
              </svg>
            </span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="tabular text-2xl font-bold" style="color: var(--srf-ink)">
              {{ formatCompactRupiah(data.kpis.pendapatanSewa) }}
            </span>
            <StatusBadge variant="light"
              :tone="data.kpis.revDeltaPct !== null && data.kpis.revDeltaPct < 0 ? 'bad' : 'good'"
              :caret="data.kpis.revDeltaPct !== null ? (data.kpis.revDeltaPct < 0 ? 'down' : 'up') : null" :label="data.kpis.revDeltaPct !== null
                  ? `${data.kpis.revDeltaPct >= 0 ? '+' : ''}${data.kpis.revDeltaPct}%`
                  : `${data.kpis.transaksiCount} nota`
                " />
          </div>
          <div class="mt-2 text-xs" style="color: var(--srf-ink-3)">
            vs periode sebelumnya
          </div>
        </button>

        <button type="button" class="ed-card ed-card-hover cursor-pointer p-5 text-left"
          :style="activeKpi === 'tx' ? { borderColor: 'var(--srf-accent-border)' } : {}" @click="activeKpi = 'tx'">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Total Transaksi</span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl"
              style="background-color: var(--srf-well); color: var(--srf-ink-2)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7m-16 0v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5m-16 0h4l2 3h4l2-3h4"
                  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="tabular text-2xl font-bold" style="color: var(--srf-ink)">
              {{ data.kpis.transaksiCount }}
            </span>
            <StatusBadge variant="light" tone="accent" :label="`${data.kpis.activeTransaksiCount} aktif`" />
          </div>
          <div class="mt-2 text-xs" style="color: var(--srf-ink-3)">
            dalam {{ data.days }} hari terakhir
          </div>
        </button>

        <button type="button" class="ed-card ed-card-hover cursor-pointer p-5 text-left"
          :style="activeKpi === 'rented' ? { borderColor: 'var(--srf-accent-border)' } : {}"
          @click="activeKpi = 'rented'">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Unit Sedang Disewa</span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl"
              style="background-color: var(--srf-well); color: var(--srf-ink-2)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 9v9M4 7.5 12 12l8-4.5" stroke="currentColor"
                  stroke-width="1.8" stroke-linejoin="round" />
              </svg>
            </span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="tabular text-2xl font-bold" style="color: var(--srf-ink)">
              {{ data.kpis.unitSedangDisewa }} unit
            </span>
            <StatusBadge variant="light" tone="good" caret="up" :label="`${data.kpis.stokTersedia} siap`" />
          </div>
          <div class="mt-2 text-xs" style="color: var(--srf-ink-3)">
            dari {{ data.kpis.stokTotalSemua }} stok total
          </div>
        </button>

        <button type="button" class="ed-card ed-card-hover cursor-pointer p-5 text-left"
          :style="activeKpi === 'late' ? { borderColor: 'var(--srf-accent-border)' } : {}" @click="activeKpi = 'late'">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Transaksi Terlambat</span>
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl"
              style="background-color: var(--srf-well); color: var(--srf-ink-2)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
                <path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </span>
          </div>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="tabular text-2xl font-bold" style="color: var(--srf-ink)">
              {{ data.kpis.transaksiTerlambat }} sewa
            </span>
            <StatusBadge variant="light" :tone="data.kpis.transaksiTerlambat > 0 ? 'bad' : 'good'"
              :caret="data.kpis.transaksiTerlambat > 0 ? 'down' : 'up'"
              :label="data.kpis.transaksiTerlambat > 0 ? 'Perlu WA' : 'Tepat Waktu'" />
          </div>
          <div class="mt-2 text-xs" style="color: var(--srf-ink-3)">
            monitoring pengembalian alat
          </div>
        </button>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div class="space-y-6 xl:col-span-8">
          <div class="ed-card p-6 space-y-5">
            <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div class="space-y-1.5 lg:w-56 shrink-0">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-semibold" style="color: var(--srf-ink-2)">
                    Total Pendapatan Sewa
                  </h2>
                </div>
                <div class="tabular text-3xl font-bold tracking-tight" style="color: var(--srf-ink)">
                  {{ formatCompactRupiah(data.kpis.pendapatanSewa) }}
                </div>
                <div class="flex items-center gap-2 pt-0.5">
                  <StatusBadge variant="light"
                    :tone="data.kpis.revDeltaPct !== null && data.kpis.revDeltaPct < 0 ? 'bad' : 'good'"
                    :caret="data.kpis.revDeltaPct !== null ? (data.kpis.revDeltaPct < 0 ? 'down' : 'up') : 'up'" :label="data.kpis.revDeltaPct !== null
                        ? `${data.kpis.revDeltaPct >= 0 ? '+' : ''}${data.kpis.revDeltaPct}%`
                        : 'Aktif'
                      " />
                  <span class="text-xs" style="color: var(--srf-ink-3)">vs periode lalu</span>
                </div>
                <div class="flex items-center gap-4 pt-3 text-[11px]" style="color: var(--srf-ink-3)">
                  <span class="inline-flex items-center gap-1.5">
                    <span class="h-2 w-2 rounded-full" style="background-color: var(--srf-accent)" />
                    Periode ini
                  </span>
                  <span class="inline-flex items-center gap-1.5">
                    <span class="h-0.5 w-3 border-t border-dashed" style="border-color: var(--srf-ink-3)" />
                    Periode lalu
                  </span>
                </div>
              </div>

              <div class="min-w-0 flex-1">
                <div class="relative flex items-stretch gap-2">
                  <div class="flex flex-col justify-between py-2 text-right text-[10px] tabular"
                    style="color: var(--srf-ink-3)">
                    <span v-for="(yt, idx) in chartGeometry.yTicks" :key="idx">{{ yt }}</span>
                  </div>
                  <div class="relative flex-1">
                    <svg viewBox="0 0 520 160" class="h-[168px] w-full overflow-visible">
                      <defs>
                        <linearGradient id="merayauRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stop-color="#2563EB" stop-opacity="0.22" />
                          <stop offset="100%" stop-color="#2563EB" stop-opacity="0" />
                        </linearGradient>
                      </defs>
                      <line x1="16" y1="16" x2="504" y2="16" stroke="var(--srf-line)" stroke-dasharray="4 4" />
                      <line x1="16" y1="80" x2="504" y2="80" stroke="var(--srf-line)" stroke-dasharray="4 4" />
                      <line x1="16" y1="144" x2="504" y2="144" stroke="var(--srf-line)" stroke-dasharray="4 4" />
                      <path v-if="chartGeometry.areaPath" :d="chartGeometry.areaPath" fill="url(#merayauRevGrad)" />
                      <path v-if="chartGeometry.prevPath" :d="chartGeometry.prevPath" fill="none"
                        stroke="var(--srf-ink-3)" stroke-opacity="0.55" stroke-width="1.6" stroke-dasharray="4 4" />
                      <path v-if="chartGeometry.currentPath" :d="chartGeometry.currentPath" fill="none"
                        stroke="var(--srf-accent)" stroke-width="2.5" stroke-linecap="round" />
                      <g v-for="(pt, idx) in chartGeometry.curCoords" :key="`pt-${idx}`">
                        <circle :cx="pt[0]" :cy="pt[1]" :r="hoveredTrendIdx === idx ? 5 : 3"
                          :fill="hoveredTrendIdx === idx ? 'var(--srf-accent)' : 'var(--srf-surface)'"
                          stroke="var(--srf-accent)" stroke-width="2" />
                        <circle :cx="pt[0]" :cy="pt[1]" r="16" fill="transparent" class="cursor-pointer"
                          @mouseenter="hoveredTrendIdx = idx" @mouseleave="hoveredTrendIdx = null" />
                      </g>
                    </svg>

                    <div v-if="hoveredTrendIdx !== null && data.trendSeries[hoveredTrendIdx]"
                      class="pointer-events-none absolute right-2 top-0 rounded-xl border px-3 py-1.5 text-[11px] shadow-md"
                      style="
                        background-color: var(--srf-surface);
                        border-color: var(--srf-line-strong);
                        color: var(--srf-ink);
                      ">
                      <div class="font-semibold">{{ data.trendSeries[hoveredTrendIdx]!.label }}</div>
                      <div class="tabular" style="color: var(--srf-accent)">
                        {{ formatRupiah(data.trendSeries[hoveredTrendIdx]!.current) }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="mt-1 flex justify-between pl-8 text-[11px] tabular" style="color: var(--srf-ink-3)">
                  <span v-for="(pt, idx) in data.trendSeries" :key="idx">{{ pt.label }}</span>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border p-4 space-y-3"
              style="border-color: var(--srf-line); background-color: var(--srf-well)">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold" style="color: var(--srf-ink)">Distribusi Layanan</span>
                <NuxtLink to="/admin/sewa" class="text-xs font-semibold hover:underline"
                  style="color: var(--srf-accent)">
                  Lihat Transaksi
                </NuxtLink>
              </div>
              <div class="grid grid-cols-1 gap-4 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"
                style="border-color: var(--srf-line-strong)">
                <div v-for="(svc, idx) in (data.serviceDistribution ?? [])" :key="svc.key" class="space-y-2"
                  :class="idx > 0 ? 'pt-3 sm:pt-0 sm:pl-4' : ''">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex h-7 w-7 items-center justify-center rounded-lg" :style="{
                      backgroundColor:
                        svc.color === 'blue'
                          ? 'var(--srf-accent-soft)'
                          : svc.color === 'green'
                            ? 'var(--srf-good-soft)'
                            : 'var(--srf-orange-soft)',
                      color:
                        svc.color === 'blue'
                          ? 'var(--srf-accent)'
                          : svc.color === 'green'
                            ? 'var(--srf-good)'
                            : 'var(--srf-orange)',
                    }">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" />
                      </svg>
                    </span>
                    <div class="min-w-0">
                      <div class="tabular text-base font-bold leading-tight" style="color: var(--srf-ink)">
                        {{ svc.count }}
                      </div>
                      <div class="truncate text-[11px]" style="color: var(--srf-ink-3)">
                        {{ svc.label }}
                      </div>
                    </div>
                  </div>
                  <div class="h-2 w-full overflow-hidden rounded-full" :style="{
                    background:
                      svc.color === 'blue'
                        ? 'linear-gradient(90deg, var(--srf-accent-soft), transparent)'
                        : svc.color === 'green'
                          ? 'linear-gradient(90deg, var(--srf-good-soft), transparent)'
                          : 'linear-gradient(90deg, var(--srf-orange-soft), transparent)',
                  }">
                    <div class="h-full rounded-full transition-all duration-500" :style="{
                      width: `${Math.max(12, Math.round((svc.count / serviceMaxCount) * 100))}%`,
                      backgroundColor:
                        svc.color === 'blue'
                          ? 'var(--srf-accent)'
                          : svc.color === 'green'
                            ? 'var(--srf-good)'
                            : 'var(--srf-orange)',
                    }" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ed-card overflow-hidden">
            <div class="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
              <div>
                <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
                  Alat Paling Laris
                </h2>
                <p class="text-xs" style="color: var(--srf-ink-3)">
                  Unit paling sering disewa dalam periode terpilih
                </p>
              </div>
              <NuxtLink to="/admin/master-alat" class="ed-btn-ghost !text-xs">
                Kelola Alat
              </NuxtLink>
            </div>
            <div class="overflow-x-auto px-2 pb-2">
              <table class="ed-table-dashed w-full border-collapse text-left text-sm">
                <thead>
                  <tr class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--srf-ink-3)">
                    <th class="px-4 py-2.5">ID</th>
                    <th class="px-4 py-2.5">Nama Alat</th>
                    <th class="px-4 py-2.5">Disewa</th>
                    <th class="px-4 py-2.5">Pendapatan</th>
                    <th class="px-4 py-2.5 text-right">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!data.topItems.length">
                    <td colspan="5" class="px-4 py-8 text-center text-xs" style="color: var(--srf-ink-3)">
                      Belum ada data penyewaan alat pada periode ini.
                    </td>
                  </tr>
                  <tr v-for="item in data.topItems" :key="item.namaAlat">
                    <td class="px-4 py-3 tabular text-xs font-semibold" style="color: var(--srf-ink-3)">
                      #{{ item.kodeAlat || '-' }}
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2.5">
                        <div class="h-8 w-8 shrink-0 overflow-hidden rounded-lg border"
                          style="background-color: var(--srf-well); border-color: var(--srf-line)">
                          <img v-if="item.foto" :src="item.foto" :alt="item.namaAlat"
                            class="h-full w-full object-cover" />
                          <GearArtThumb v-else kind="tent" />
                        </div>
                        <span class="max-w-[240px] truncate text-xs font-semibold" style="color: var(--srf-ink)">
                          {{ item.namaAlat }}
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 tabular text-xs font-semibold" style="color: var(--srf-ink-2)">
                      {{ item.units }} unit
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center gap-1.5 tabular text-xs font-semibold"
                        style="color: var(--srf-good-ink)">
                        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full"
                          style="background-color: var(--srf-good-soft); color: var(--srf-good-ink)">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 19V5m0 0-5 5m5-5 5 5" stroke="currentColor" stroke-width="2.4"
                              stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </span>
                        {{ formatRupiah(item.revenue ?? 0) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <StatusBadge variant="outline" :tone="item.statusStok === 'Kritis'
                          ? 'bad'
                          : item.statusStok === 'Menipis'
                            ? 'warn'
                            : 'good'
                        " :label="`${item.stokTersedia ?? 0}/${item.stokTotal ?? 0}`" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <section class="ed-card overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4">
              <div>
                <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
                  Transaksi Sewa Terbaru
                </h2>
                <p class="text-xs" style="color: var(--srf-ink-3)">
                  Daftar penyewaan dan pengembalian alat basecamp terbaru.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <input v-model="search" type="search" class="ed-input !w-48 !py-1.5 !text-xs"
                  placeholder="Cari penyewa atau kode..." />
                <div class="inline-flex rounded-[10px] border p-0.5 text-xs"
                  style="background-color: var(--srf-well); border-color: var(--srf-line)">
                  <button v-for="tab in (['Semua', 'Disewa', 'Terlambat', 'Selesai'] as const)" :key="tab" type="button"
                    class="cursor-pointer rounded-[8px] px-3 py-1 font-medium transition-colors" :style="statusFilter === tab
                        ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-accent-ink)', fontWeight: 600 }
                        : { color: 'var(--srf-ink-2)' }
                      " @click="statusFilter = tab">
                    {{ tab }}
                  </button>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto px-2 pb-2">
              <table class="ed-table-dashed w-full border-collapse text-left text-sm">
                <thead>
                  <tr class="text-[11px] font-semibold uppercase tracking-wider" style="color: var(--srf-ink-3)">
                    <th class="px-4 py-2.5">Penyewa</th>
                    <th class="px-4 py-2.5">Kode</th>
                    <th class="px-4 py-2.5">Item Alat</th>
                    <th class="px-4 py-2.5">Durasi</th>
                    <th class="px-4 py-2.5">Total Biaya</th>
                    <th class="px-4 py-2.5">Tenggat</th>
                    <th class="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!filteredRecent.length">
                    <td colspan="7" class="px-4 py-8 text-center text-xs" style="color: var(--srf-ink-3)">
                      Tidak ada transaksi yang sesuai filter saat ini.
                    </td>
                  </tr>
                  <tr v-for="tx in filteredRecent" :key="tx.id">
                    <td class="px-4 py-3 text-xs font-semibold" style="color: var(--srf-ink)">
                      {{ tx.penyewaNama }}
                    </td>
                    <td class="px-4 py-3 tabular text-xs font-semibold">
                      <NuxtLink :to="`/admin/sewa?kode=${tx.kodeSewa}`" class="hover:underline"
                        style="color: var(--srf-accent)">
                        {{ tx.kodeSewa }}
                      </NuxtLink>
                    </td>
                    <td class="max-w-[200px] truncate px-4 py-3 text-xs" style="color: var(--srf-ink-2)">
                      {{ tx.ringkasanItem || '-' }}
                    </td>
                    <td class="px-4 py-3 tabular text-xs">{{ tx.durasiHari }} hr</td>
                    <td class="px-4 py-3 tabular text-xs font-semibold">
                      {{ formatRupiah(tx.totalBiayaSewa + tx.dendaTelat + tx.dendaRusak) }}
                    </td>
                    <td class="px-4 py-3 tabular text-xs" style="color: var(--srf-ink-3)">
                      {{ formatDateTimeShort(tx.tanggalKembaliRencana) }}
                    </td>
                    <td class="px-4 py-3">
                      <StatusBadge variant="outline" :label="tx.statusSewa" :tone="txBadgeTone(tx.statusSewa)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div class="space-y-6 xl:col-span-4">
          <div class="ed-card p-6 space-y-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
                  Hari Paling Aktif
                </h2>
                <p class="text-xs" style="color: var(--srf-ink-3)">
                  Volume penyewaan per hari dalam sepekan
                </p>
              </div>
              <button type="button" class="ed-btn-ghost !px-2 !py-1 !text-xs" title="Muat ulang" @click="refresh()">
                •••
              </button>
            </div>

            <div class="grid h-44 grid-cols-7 items-end gap-2.5 pt-6">
              <div v-for="(bar, idx) in weekdayBars" :key="bar.label"
                class="relative flex h-full flex-col items-center justify-end gap-2" @mouseenter="hoveredDayIdx = idx"
                @mouseleave="hoveredDayIdx = null">
                <span v-if="bar.isPeak || hoveredDayIdx === idx"
                  class="tabular rounded-full px-2 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  style="background-color: var(--srf-ink)">
                  {{ bar.count }}
                </span>
                <div class="w-full max-w-[28px] rounded-[8px] transition-all duration-500" :style="{
                  height: `${bar.heightPct}%`,
                  backgroundColor:
                    bar.isPeak || hoveredDayIdx === idx
                      ? 'var(--srf-accent)'
                      : 'var(--srf-line-strong)',
                }" />
                <span class="text-[11px]" :style="{
                  color: bar.isPeak ? 'var(--srf-accent)' : 'var(--srf-ink-3)',
                  fontWeight: bar.isPeak ? 700 : 500,
                }">
                  {{ bar.label }}
                </span>
              </div>
            </div>
          </div>

          <div class="ed-card p-6 space-y-4">
            <div class="flex items-center justify-between gap-2">
              <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
                {{ gaugeMode === 'stock' ? 'Kesiapan Stok Alat' : 'Repeat Customer Rate' }}
              </h2>
              <div class="inline-flex rounded-[10px] border p-0.5 text-[11px]"
                style="background-color: var(--srf-well); border-color: var(--srf-line)">
                <button type="button" class="cursor-pointer rounded-[8px] px-2.5 py-1 font-semibold" :style="gaugeMode === 'stock'
                    ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-accent-ink)' }
                    : { color: 'var(--srf-ink-3)' }
                  " @click="gaugeMode = 'stock'">
                  Stok
                </button>
                <button type="button" class="cursor-pointer rounded-[8px] px-2.5 py-1 font-semibold" :style="gaugeMode === 'repeat'
                    ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-accent-ink)' }
                    : { color: 'var(--srf-ink-3)' }
                  " @click="gaugeMode = 'repeat'">
                  Repeat
                </button>
              </div>
            </div>

            <div class="flex flex-col items-center">
              <div class="relative w-full max-w-[240px]">
                <svg viewBox="0 0 240 130" class="w-full">
                  <line v-for="(tick, idx) in gaugeTicks" :key="`tick-${idx}`" :x1="tick.x1" :y1="tick.y1" :x2="tick.x2"
                    :y2="tick.y2" :stroke="tick.color" stroke-width="4.5" stroke-linecap="round" />
                </svg>
                <div class="absolute inset-x-0 bottom-2 text-center">
                  <div class="tabular text-3xl font-bold" style="color: var(--srf-ink)">
                    {{ gaugePercent }}%
                  </div>
                </div>
              </div>
              <p class="mt-1 text-center text-xs" style="color: var(--srf-ink-3)">
                {{
                  gaugeMode === 'stock'
                    ? `${data.kpis.stokTersedia} dari ${data.kpis.stokTotalSemua} unit siap disewa (target 80%)`
                    : `${data.readiness?.repeatCustomerCount ?? 0} dari ${data.readiness?.totalCustomerCount ?? 0} penyewa
                repeat order`
                }}
              </p>
              <NuxtLink :to="gaugeMode === 'stock' ? '/admin/master-alat' : '/admin/penyewa'"
                class="ed-btn-secondary mt-4 !py-1.5 !text-xs">
                Lihat Detail
              </NuxtLink>
            </div>
          </div>

          <div class="ed-card p-6 space-y-4">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
                  Stok Prioritas
                </h2>
                <p class="text-xs" style="color: var(--srf-ink-3)">
                  {{ data.stokAlatPanel.length }} dari {{ data.stokAlatTotalAktif ?? data.stokAlatPanel.length }} alat
                  aktif
                </p>
              </div>
              <NuxtLink to="/admin/master-alat" class="text-xs font-semibold hover:underline"
                style="color: var(--srf-accent)">
                Kelola
              </NuxtLink>
            </div>

            <div class="space-y-3">
              <div v-for="item in data.stokAlatPanel.slice(0, 5)" :key="item.id" class="ed-well p-3 space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="truncate text-xs font-semibold" style="color: var(--srf-ink)">
                      {{ item.namaAlat }}
                    </div>
                    <div class="text-[11px]" style="color: var(--srf-ink-3)">
                      {{ item.namaKategori }} · {{ item.stokTersedia }}/{{ item.stokTotal }} unit
                    </div>
                  </div>
                  <StatusBadge variant="outline" :label="item.statusStok" :tone="item.statusStok === 'Aman'
                      ? 'good'
                      : item.statusStok === 'Menipis'
                        ? 'warn'
                        : 'bad'
                    " />
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full" style="background-color: var(--srf-line)">
                  <div class="h-full rounded-full" :style="{
                    width: `${item.pctTersedia}%`,
                    backgroundColor:
                      item.statusStok === 'Aman'
                        ? 'var(--srf-good)'
                        : item.statusStok === 'Menipis'
                          ? 'var(--srf-warn)'
                          : 'var(--srf-bad)',
                  }" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
