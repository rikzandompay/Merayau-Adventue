<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface RentedItem {
  idDetail: number
  kodeAlat: string
  namaAlat: string
  jumlah: number
  hargaSatuan: number
}

interface RentedTransactionRow {
  idSewa: number
  kodeSewa: string
  namaPenyewa: string
  kontakWa: string
  jenisJaminan: string
  tanggalKembaliRencana: string
  totalUnit: number
  items: RentedItem[]
  estimasiDenda: number
  displayStatus: 'Terlambat' | 'Jatuh Tempo' | 'Disewa'
  waLink: string
}

const search = ref('')
const statusTab = ref<'Semua' | 'Terlambat' | 'Jatuh Tempo' | 'Disewa'>('Semua')
const expandedIds = ref<number[]>([])

const { data, pending, refresh } = await useFetch<RentedTransactionRow[]>('/api/admin/alat-disewa')

function toggleDetail(idSewa: number) {
  const idx = expandedIds.value.indexOf(idSewa)
  if (idx >= 0) expandedIds.value.splice(idx, 1)
  else expandedIds.value.push(idSewa)
}

const filtered = computed(() => {
  const list = data.value ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter((row) => {
    if (statusTab.value !== 'Semua' && row.displayStatus !== statusTab.value) return false
    if (
      q &&
      !row.kodeSewa.toLowerCase().includes(q) &&
      !row.namaPenyewa.toLowerCase().includes(q) &&
      !row.kontakWa.includes(q) &&
      !row.items.some(
        (it) => it.namaAlat.toLowerCase().includes(q) || it.kodeAlat.toLowerCase().includes(q),
      )
    ) {
      return false
    }
    return true
  })
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">
          MONITORING BARANG KELUAR
        </p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">
          Data Alat yang Sedang Disewa
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Ringkasan per transaksi dan penyewa yang masih membawa alat; klik Detail untuk melihat seluruh daftar alatnya.
        </p>
      </div>
      <button type="button" class="ed-btn-secondary !text-xs" @click="refresh()">
        Segarkan Status
      </button>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2">
        <button v-for="tab in (['Semua', 'Terlambat', 'Jatuh Tempo', 'Disewa'] as const)" :key="tab" type="button"
          class="ed-chip" :data-selected="statusTab === tab" @click="statusTab = tab">
          {{ tab }}
          <span class="tabular text-xs" style="color: var(--srf-ink-3)">
            {{
              tab === 'Semua'
                ? (data?.length ?? 0)
                : (data ?? []).filter((r) => r.displayStatus === tab).length
            }}
          </span>
        </button>
      </div>
      <input v-model="search" type="search" class="ed-input !w-64 !py-1.5 !text-xs"
        placeholder="Cari alat, kode sewa, atau WA..." />
    </div>

    <div class="ed-card overflow-hidden">
      <div v-if="pending && !data" class="p-8 text-sm" style="color: var(--srf-ink-3)">
        Memuat data unit yang sedang disewa...
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-2)">
              <th class="px-4 py-3">Nama Penyewa</th>
              <th class="px-4 py-3">Alat &amp; Kode Sewa</th>
              <th class="px-4 py-3">Total Unit</th>
              <th class="px-4 py-3">Kontak (WA)</th>
              <th class="px-4 py-3">Tenggat Kembali</th>
              <th class="px-4 py-3">Estimasi Denda</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Aksi Basecamp</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filtered.length">
              <td colspan="8" class="px-4 py-8 text-center text-xs" style="color: var(--srf-ink-3)">
                Tidak ada transaksi sewa aktif sesuai filter saat ini.
              </td>
            </tr>
            <template v-for="row in filtered" :key="row.idSewa">
              <tr class="border-b" style="border-color: var(--srf-line)">
                <td class="px-4 py-3 font-semibold">{{ row.namaPenyewa }}</td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="font-medium">{{ row.items[0]?.namaAlat }}</span>
                    <button v-if="row.items.length > 1" type="button"
                      class="cursor-pointer rounded border px-1.5 py-0.5 text-[11px] font-medium" style="
                        background-color: var(--srf-well);
                        border-color: var(--srf-line-strong);
                        color: var(--srf-accent);
                      " @click="toggleDetail(row.idSewa)">
                      {{
                        expandedIds.includes(row.idSewa)
                          ? 'Sembunyikan'
                          : `+${row.items.length - 1} alat lainnya`
                      }}
                    </button>
                  </div>
                  <div class="tabular text-xs" style="color: var(--srf-ink-3)">
                    {{ row.kodeSewa }} · Jaminan {{ row.jenisJaminan }}
                  </div>
                </td>
                <td class="px-4 py-3 tabular">
                  <div class="font-medium">{{ row.totalUnit }} unit</div>
                  <div v-if="row.items.length > 1" class="text-xs" style="color: var(--srf-ink-3)">
                    {{ row.items.length }} jenis
                  </div>
                </td>
                <td class="px-4 py-3 tabular" style="color: var(--srf-ink-2)">{{ row.kontakWa }}</td>
                <td class="px-4 py-3 tabular text-xs">
                  {{ formatDateTimeShort(row.tanggalKembaliRencana) }}
                </td>
                <td class="px-4 py-3 tabular font-semibold"
                  :style="{ color: row.estimasiDenda > 0 ? 'var(--srf-bad)' : 'var(--srf-ink-3)' }">
                  {{ formatRupiah(row.estimasiDenda) }}
                </td>
                <td class="px-4 py-3">
                  <StatusBadge :label="row.displayStatus" :tone="row.displayStatus === 'Terlambat'
                    ? 'bad'
                    : row.displayStatus === 'Jatuh Tempo'
                      ? 'warn'
                      : 'accent'
                    " />
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5 whitespace-nowrap">
                    <button type="button"
                      class="ed-btn-secondary h-9 w-9 !p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--srf-accent)]"
                      :style="expandedIds.includes(row.idSewa)
                          ? {
                            borderColor: 'var(--srf-accent)',
                            color: 'var(--srf-accent)',
                            backgroundColor: 'var(--srf-well)',
                          }
                          : undefined
                        " :title="expandedIds.includes(row.idSewa) ? 'Tutup detail alat' : 'Lihat detail alat'"
                      :aria-label="expandedIds.includes(row.idSewa)
                          ? `Tutup detail alat ${row.kodeSewa}`
                          : `Lihat detail alat ${row.kodeSewa}`
                        " :aria-expanded="expandedIds.includes(row.idSewa)" @click="toggleDetail(row.idSewa)">
                      <svg v-if="!expandedIds.includes(row.idSewa)" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" aria-hidden="true">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor"
                          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                        <circle cx="12" cy="12" r="2.75" stroke="currentColor" stroke-width="1.8" />
                      </svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 14.5 12 8.5l6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
                          stroke-linejoin="round" />
                      </svg>
                    </button>
                    <a :href="row.waLink" target="_blank" rel="noopener noreferrer"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--srf-accent)]"
                      style="color: var(--srf-good)" title="Hubungi via WhatsApp"
                      :aria-label="`Hubungi ${row.namaPenyewa} via WhatsApp`">
                      <WaIcon :size="16" />
                    </a>
                  </div>
                </td>
              </tr>
              <tr v-if="expandedIds.includes(row.idSewa)" class="border-b"
                style="background-color: var(--srf-well); border-color: var(--srf-line)">
                <td colspan="8" class="px-4 py-3">
                  <div class="ed-label mb-2">
                    RINCIAN ALAT DISEWA · {{ row.kodeSewa }} ({{ row.namaPenyewa }})
                  </div>
                  <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    <div v-for="item in row.items" :key="item.idDetail"
                      class="flex items-center justify-between gap-2 rounded border px-3 py-1.5 text-xs"
                      style="background-color: var(--srf-raised); border-color: var(--srf-line)">
                      <span class="truncate">
                        <span class="tabular font-semibold" style="color: var(--srf-accent)">
                          {{ item.kodeAlat }}
                        </span>
                        · {{ item.namaAlat }}
                      </span>
                      <span class="tabular shrink-0 font-semibold">
                        {{ item.jumlah }} unit · {{ formatRupiah(item.hargaSatuan) }}/24j
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
