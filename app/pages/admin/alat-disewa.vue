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
  jenisJaminan: 'KTP' | 'SIM' | 'Kartu Pelajar'
  tanggalKembaliRencana: string
  statusSewa: 'Disewa' | 'Terlambat' | 'Selesai'
  dendaTelat: number
  dendaRusak: number
  catatan: string | null
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

const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = ''
  }, 3200)
}

// Unified modal for Return & Fine + Edit rental (opened from Edit icon)
const actionTarget = ref<RentedTransactionRow | null>(null)
const actionMode = ref<'return' | 'edit'>('return')
const modalErr = ref('')
const modalBusy = ref(false)

const returnForm = reactive({
  dendaRusak: 0,
  kondisiKembali: 'Baik & Lengkap',
  catatan: '',
})

const editForm = reactive({
  jenisJaminan: 'KTP' as 'KTP' | 'SIM' | 'Kartu Pelajar',
  tanggalKembaliRencana: '',
  statusSewa: 'Disewa' as 'Disewa' | 'Terlambat' | 'Selesai',
  dendaTelat: 0,
  dendaRusak: 0,
})

function openActionModal(row: RentedTransactionRow, mode: 'return' | 'edit' = 'return') {
  modalErr.value = ''
  actionTarget.value = row
  actionMode.value = mode

  returnForm.dendaRusak = row.dendaRusak || 0
  returnForm.kondisiKembali = 'Baik & Lengkap'
  returnForm.catatan = row.catatan ?? ''

  editForm.jenisJaminan = row.jenisJaminan
  editForm.tanggalKembaliRencana = toDatetimeLocalValue(new Date(row.tanggalKembaliRencana))
  editForm.statusSewa = row.statusSewa
  editForm.dendaTelat = row.dendaTelat || 0
  editForm.dendaRusak = row.dendaRusak || 0
}

async function submitReturn() {
  if (!actionTarget.value) return
  modalErr.value = ''
  modalBusy.value = true
  try {
    const code = actionTarget.value.kodeSewa
    await $fetch(`/api/admin/transaksi/${actionTarget.value.idSewa}/kembali`, {
      method: 'PATCH',
      body: {
        dendaRusak: Math.max(0, Number(returnForm.dendaRusak) || 0),
        kondisiKembali: returnForm.kondisiKembali.trim() || 'Baik & Lengkap',
        catatan: returnForm.catatan.trim() || null,
      },
    })
    actionTarget.value = null
    await Promise.all([refresh(), refreshNuxtData()])
    showToast(`Pengembalian ${code} selesai & stok alat kembali tersedia.`)
  } catch (err: unknown) {
    modalErr.value = extractErrorMessage(err, 'Gagal menyelesaikan pengembalian.')
  } finally {
    modalBusy.value = false
  }
}

async function submitEdit() {
  if (!actionTarget.value) return
  modalErr.value = ''
  modalBusy.value = true
  try {
    const code = actionTarget.value.kodeSewa
    await $fetch(`/api/admin/transaksi/${actionTarget.value.idSewa}`, {
      method: 'PUT',
      body: {
        jenisJaminan: editForm.jenisJaminan,
        tanggalKembaliRencana: new Date(editForm.tanggalKembaliRencana).toISOString(),
        statusSewa: editForm.statusSewa,
        dendaTelat: Math.max(0, Number(editForm.dendaTelat) || 0),
        dendaRusak: Math.max(0, Number(editForm.dendaRusak) || 0),
      },
    })
    actionTarget.value = null
    await Promise.all([refresh(), refreshNuxtData()])
    showToast(`Data sewa ${code} diperbarui.`)
  } catch (err: unknown) {
    modalErr.value = extractErrorMessage(err, 'Gagal memperbarui data sewa.')
  } finally {
    modalBusy.value = false
  }
}

// Delete rental modal
const deleteTarget = ref<RentedTransactionRow | null>(null)
const deleting = ref(false)
const deleteErr = ref('')

function openDeleteModal(row: RentedTransactionRow) {
  deleteErr.value = ''
  deleteTarget.value = row
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteErr.value = ''
  deleting.value = true
  try {
    const code = deleteTarget.value.kodeSewa
    await $fetch(`/api/admin/transaksi/${deleteTarget.value.idSewa}`, { method: 'DELETE' })
    deleteTarget.value = null
    await Promise.all([refresh(), refreshNuxtData()])
    showToast(`Transaksi ${code} dihapus & stok alat dipulihkan.`)
  } catch (err: unknown) {
    deleteErr.value = extractErrorMessage(err, 'Gagal menghapus transaksi sewa.')
  } finally {
    deleting.value = false
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (deleteTarget.value) deleteTarget.value = null
  else if (actionTarget.value) actionTarget.value = null
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (toastTimer) clearTimeout(toastTimer)
})

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
          MONITORING &amp; PENGEMBALIAN ALAT
        </p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">
          Data Alat yang Sedang Disewa
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Kelola alat aktif yang masih dibawa penyewa: proses pengembalian &amp; denda, edit tenggat/jaminan, atau hapus transaksi.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="ed-btn-secondary !text-xs" @click="refresh()">
          Segarkan Status
        </button>
        <NuxtLink to="/admin/sewa" class="ed-btn-primary !text-xs">
          + Catat Sewa
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="toastMsg"
      class="rounded-xl border px-4 py-2.5 text-xs font-semibold"
      style="background-color: var(--srf-good-soft); border-color: var(--srf-good-border); color: var(--srf-good-ink)"
    >
      {{ toastMsg }}
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
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0"
                      title="Pengembalian, denda & edit sewa"
                      :aria-label="`Pengembalian atau edit ${row.kodeSewa}`"
                      @click="openActionModal(row, 'return')"
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
                    <a :href="row.waLink" target="_blank" rel="noopener noreferrer"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0 !rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--srf-accent)]"
                      style="color: var(--srf-good)" title="Hubungi via WhatsApp"
                      :aria-label="`Hubungi ${row.namaPenyewa} via WhatsApp`">
                      <WaIcon :size="16" />
                    </a>
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0"
                      style="color: var(--srf-bad-ink)"
                      title="Hapus transaksi sewa"
                      :aria-label="`Hapus ${row.kodeSewa}`"
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

    <!-- Modal Pengembalian, Denda & Edit Sewa -->
    <div
      v-if="actionTarget"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4"
      @click.self="actionTarget = null"
    >
      <div
        class="ed-card my-6 w-full max-w-md overflow-hidden shadow-xl"
        style="border-color: var(--srf-line-strong)"
      >
        <div
          class="flex items-center justify-between border-b px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <div>
            <p
              class="ed-label"
              :style="{ color: actionMode === 'return' ? 'var(--srf-bad)' : 'var(--srf-accent)' }"
            >
              {{ actionMode === 'return' ? 'PROSES PENGEMBALIAN & DENDA' : 'EDIT SEWA AKTIF' }} · {{ actionTarget.kodeSewa }}
            </p>
            <h2 class="text-base font-bold">{{ actionTarget.namaPenyewa }}</h2>
          </div>
          <button
            type="button"
            class="ed-btn-ghost !px-2.5 !py-1 text-xs font-bold"
            aria-label="Tutup modal"
            @click="actionTarget = null"
          >
            X
          </button>
        </div>

        <div class="border-b px-5 py-2.5" style="border-color: var(--srf-line)">
          <div
            class="inline-flex rounded-[10px] border p-0.5 text-xs"
            style="background-color: var(--srf-well); border-color: var(--srf-line)"
          >
            <button
              type="button"
              class="min-h-[34px] cursor-pointer rounded-[8px] px-3.5 py-1 font-semibold"
              :style="
                actionMode === 'return'
                  ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-good-ink)' }
                  : { color: 'var(--srf-ink-2)' }
              "
              @click="actionMode = 'return'; modalErr = ''"
            >
              Pengembalian &amp; Denda
            </button>
            <button
              type="button"
              class="min-h-[34px] cursor-pointer rounded-[8px] px-3.5 py-1 font-semibold"
              :style="
                actionMode === 'edit'
                  ? { backgroundColor: 'var(--srf-surface)', color: 'var(--srf-accent-ink)' }
                  : { color: 'var(--srf-ink-2)' }
              "
              @click="actionMode = 'edit'; modalErr = ''"
            >
              Edit Data Sewa
            </button>
          </div>
        </div>

        <div class="space-y-3.5 p-5 text-xs">
          <template v-if="actionMode === 'return'">
            <div class="ed-well space-y-1.5 p-3">
              <div class="flex justify-between">
                <span style="color: var(--srf-ink-2)">Rencana kembali</span>
                <span class="tabular font-semibold">{{ formatDateTimeShort(actionTarget.tanggalKembaliRencana) }}</span>
              </div>
              <div class="flex justify-between">
                <span style="color: var(--srf-ink-2)">Estimasi denda telat</span>
                <span
                  class="tabular font-semibold"
                  :style="{ color: actionTarget.estimasiDenda > 0 ? 'var(--srf-bad)' : 'var(--srf-good)' }"
                >
                  {{ formatRupiah(actionTarget.estimasiDenda) }}
                </span>
              </div>
              <div class="flex justify-between border-t pt-1.5" style="border-color: var(--srf-line)">
                <span class="font-semibold">Total denda (telat + rusak)</span>
                <span class="tabular font-bold" style="color: var(--srf-ink)">
                  {{ formatRupiah(actionTarget.estimasiDenda + Math.max(0, Number(returnForm.dendaRusak) || 0)) }}
                </span>
              </div>
            </div>

            <div class="space-y-1">
              <label class="ed-label">DENDA KERUSAKAN FISIK (RP)</label>
              <input v-model.number="returnForm.dendaRusak" type="number" min="0" class="ed-input tabular !text-xs" />
            </div>

            <div class="space-y-1">
              <label class="ed-label">KONDISI BARANG KEMBALI</label>
              <input v-model="returnForm.kondisiKembali" type="text" class="ed-input !text-xs" />
            </div>

            <div class="space-y-1">
              <label class="ed-label">CATATAN (OPSIONAL)</label>
              <input
                v-model="returnForm.catatan"
                type="text"
                class="ed-input !text-xs"
                placeholder="Mis. pasak lengkap, tenda kering..."
              />
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="space-y-1">
                <label class="ed-label">STATUS SEWA</label>
                <select v-model="editForm.statusSewa" class="ed-select !text-xs">
                  <option value="Disewa">Disewa</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Selesai">Selesai</option>
                </select>
              </div>
              <div class="space-y-1">
                <label class="ed-label">JAMINAN FISIK</label>
                <select v-model="editForm.jenisJaminan" class="ed-select !text-xs">
                  <option value="KTP">KTP</option>
                  <option value="SIM">SIM</option>
                  <option value="Kartu Pelajar">Kartu Pelajar</option>
                </select>
              </div>
              <div class="space-y-1 sm:col-span-2">
                <label class="ed-label">TENGGAT RENCANA KEMBALI</label>
                <input v-model="editForm.tanggalKembaliRencana" type="datetime-local" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">DENDA TELAT (RP)</label>
                <input v-model.number="editForm.dendaTelat" type="number" min="0" class="ed-input tabular !text-xs" />
              </div>
              <div class="space-y-1">
                <label class="ed-label">DENDA RUSAK (RP)</label>
                <input v-model.number="editForm.dendaRusak" type="number" min="0" class="ed-input tabular !text-xs" />
              </div>
            </div>
          </template>

          <div
            v-if="modalErr"
            class="rounded-[10px] border px-3 py-2 text-xs font-medium"
            style="background-color: var(--srf-bad-soft); border-color: var(--srf-bad-border); color: var(--srf-bad-ink)"
          >
            {{ modalErr }}
          </div>
        </div>

        <div
          class="flex justify-end gap-2.5 border-t px-5 py-3.5"
          style="background-color: var(--srf-well); border-color: var(--srf-line)"
        >
          <button type="button" class="ed-btn-secondary !text-xs" @click="actionTarget = null">
            Batal
          </button>
          <button
            v-if="actionMode === 'return'"
            type="button"
            class="ed-btn-wa !text-xs"
            :disabled="modalBusy"
            @click="submitReturn"
          >
            {{ modalBusy ? 'Memproses...' : 'Selesaikan Pengembalian' }}
          </button>
          <button
            v-else
            type="button"
            class="ed-btn-primary !text-xs"
            :disabled="modalBusy"
            @click="submitEdit"
          >
            {{ modalBusy ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Hapus Transaksi Sewa -->
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
          <h3 class="mt-1 text-base font-bold">{{ deleteTarget.kodeSewa }} · {{ deleteTarget.namaPenyewa }}</h3>
          <p class="mt-1 text-xs" style="color: var(--srf-ink-2)">
            Yakin ingin menghapus transaksi sewa ini? Stok alat yang sedang disewa akan otomatis dikembalikan.
          </p>
        </div>
        <div
          v-if="deleteErr"
          class="rounded-[10px] border px-3 py-2 text-xs font-medium"
          style="background-color: var(--srf-bad-soft); border-color: var(--srf-bad-border); color: var(--srf-bad-ink)"
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
            {{ deleting ? 'Menghapus...' : 'Hapus Transaksi' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
