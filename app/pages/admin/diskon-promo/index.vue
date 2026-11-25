<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface SettingRow {
  id: number
  namaAturan: string
  durasiDasarJam: number
  minHariPromo: number
  diskonPersen: number
  toleransiTelatJam: number
  dendaPersenHarian: number
}

interface PromoRow {
  id: number
  namaPromo: string
  labelBadge: string | null
  targetTipe: 'semua_alat' | 'kategori' | 'alat' | 'paket'
  targetId: number | null
  targetNama: string
  tipePotongan: 'persen' | 'nominal'
  nilaiPotongan: number
  tanggalMulai: string | null
  tanggalSelesai: string | null
  statusAktif: boolean
  statusBerjalan: 'Aktif' | 'Terjadwal' | 'Berakhir' | 'Nonaktif'
}

interface AlatOption {
  id: number
  kodeAlat: string
  namaAlat: string
  hargaHarian: number
}

interface KategoriOption {
  id: number
  namaKategori: string
}

interface PaketOption {
  id: number
  kodePaket: string
  namaPaket: string
  tipePaket: 'paket' | 'bundle'
  tarifPaket: number
}

const [
  { data: settingRes, refresh: refreshSetting },
  { data: promoRes, pending: promoPending, error: promoErr, refresh: refreshPromos },
  { data: alatRes },
  { data: paketRes },
] = await Promise.all([
  useFetch<SettingRow>('/api/admin/pengaturan-sewa'),
  useFetch<PromoRow[]>('/api/admin/promo-diskon'),
  useFetch<{ items: AlatOption[]; categories: KategoriOption[] }>('/api/admin/alat'),
  useFetch<PaketOption[]>('/api/admin/paket-alat'),
])

const toastMsg = ref<{ text: string; tone: 'good' | 'bad' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(text: string, tone: 'good' | 'bad' = 'good') {
  toastMsg.value = { text, tone }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = null
  }, 3200)
}

// Section A: Promo Durasi Sewa
const ruleForm = reactive({
  namaAturan: settingRes.value?.namaAturan ?? 'Aturan Standar Basecamp',
  durasiDasarJam: settingRes.value?.durasiDasarJam ?? 24,
  minHariPromo: settingRes.value?.minHariPromo ?? 3,
  diskonPersen: settingRes.value?.diskonPersen ?? 10,
  toleransiTelatJam: settingRes.value?.toleransiTelatJam ?? 2,
  dendaPersenHarian: settingRes.value?.dendaPersenHarian ?? 30,
})
const savingRule = ref(false)

async function saveRule() {
  savingRule.value = true
  try {
    await $fetch('/api/admin/pengaturan-sewa', {
      method: 'PUT',
      body: ruleForm,
    })
    await refreshSetting()
    showToast('Aturan promo durasi & denda berhasil diperbarui.')
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    showToast(e?.data?.statusMessage || 'Gagal menyimpan pengaturan promo durasi.', 'bad')
  } finally {
    savingRule.value = false
  }
}

// Section B: Diskon Per Alat / Kategori / Paket
const promoList = computed(() => promoRes.value ?? [])
const statusTab = ref<'semua' | 'Aktif' | 'Terjadwal' | 'Berakhir' | 'Nonaktif'>('semua')
const search = ref('')

const filteredPromos = computed(() => {
  const q = search.value.trim().toLowerCase()
  return promoList.value.filter((p) => {
    if (statusTab.value !== 'semua' && p.statusBerjalan !== statusTab.value) return false
    if (!q) return true
    return (
      p.namaPromo.toLowerCase().includes(q) ||
      p.targetNama.toLowerCase().includes(q) ||
      (p.labelBadge ?? '').toLowerCase().includes(q)
    )
  })
})

const categories = computed(() => alatRes.value?.categories ?? [])
const tools = computed(() => alatRes.value?.items ?? [])
const packages = computed(() => paketRes.value ?? [])

const showModal = ref(false)
const editingId = ref<number | null>(null)
const savingPromo = ref(false)
const formErr = ref('')
const togglingId = ref<number | null>(null)
const deleteTarget = ref<PromoRow | null>(null)
const deletingId = ref<number | null>(null)

const promoForm = reactive({
  namaPromo: '',
  labelBadge: '',
  targetTipe: 'alat' as 'semua_alat' | 'kategori' | 'alat' | 'paket',
  targetId: null as number | null,
  tipePotongan: 'persen' as 'persen' | 'nominal',
  nilaiPotongan: 15,
  tanggalMulai: '',
  tanggalSelesai: '',
  statusAktif: true,
})

function toLocalDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultTargetIdFor(tipe: 'semua_alat' | 'kategori' | 'alat' | 'paket'): number | null {
  if (tipe === 'semua_alat') return null
  if (tipe === 'kategori') return categories.value[0]?.id ?? null
  if (tipe === 'alat') return tools.value[0]?.id ?? null
  return packages.value[0]?.id ?? null
}

function onTargetTypeChange() {
  promoForm.targetId = defaultTargetIdFor(promoForm.targetTipe)
}

function openCreateModal() {
  editingId.value = null
  formErr.value = ''
  promoForm.namaPromo = ''
  promoForm.labelBadge = ''
  promoForm.targetTipe = tools.value.length ? 'alat' : 'semua_alat'
  promoForm.targetId = defaultTargetIdFor(promoForm.targetTipe)
  promoForm.tipePotongan = 'persen'
  promoForm.nilaiPotongan = 15
  promoForm.tanggalMulai = ''
  promoForm.tanggalSelesai = ''
  promoForm.statusAktif = true
  showModal.value = true
}

function openEditModal(p: PromoRow) {
  editingId.value = p.id
  formErr.value = ''
  promoForm.namaPromo = p.namaPromo
  promoForm.labelBadge = p.labelBadge ?? ''
  promoForm.targetTipe = p.targetTipe
  promoForm.targetId = p.targetId
  promoForm.tipePotongan = p.tipePotongan
  promoForm.nilaiPotongan = p.nilaiPotongan
  promoForm.tanggalMulai = toLocalDateInput(p.tanggalMulai)
  promoForm.tanggalSelesai = toLocalDateInput(p.tanggalSelesai)
  promoForm.statusAktif = p.statusAktif
  showModal.value = true
}

async function submitPromo() {
  formErr.value = ''
  if (!promoForm.namaPromo.trim()) {
    formErr.value = 'Nama promo wajib diisi.'
    return
  }
  if (promoForm.targetTipe !== 'semua_alat' && !promoForm.targetId) {
    formErr.value = 'Pilih target yang ingin diberikan promo.'
    return
  }

  savingPromo.value = true
  try {
    const startIso = promoForm.tanggalMulai ? `${promoForm.tanggalMulai}T00:00:00` : null
    const endIso = promoForm.tanggalSelesai ? `${promoForm.tanggalSelesai}T23:59:59` : null
    const body = {
      namaPromo: promoForm.namaPromo.trim(),
      labelBadge: promoForm.labelBadge.trim() || null,
      targetTipe: promoForm.targetTipe,
      targetId: promoForm.targetTipe === 'semua_alat' ? null : promoForm.targetId,
      tipePotongan: promoForm.tipePotongan,
      nilaiPotongan: Number(promoForm.nilaiPotongan),
      tanggalMulai: startIso,
      tanggalSelesai: endIso,
      statusAktif: promoForm.statusAktif,
    }
    if (editingId.value) {
      await $fetch(`/api/admin/promo-diskon/${editingId.value}`, { method: 'PUT', body })
      showToast('Promo diskon berhasil diperbarui.')
    } else {
      await $fetch('/api/admin/promo-diskon', { method: 'POST', body })
      showToast('Promo diskon baru berhasil ditambahkan.')
    }
    showModal.value = false
    await refreshPromos()
  } catch (err: unknown) {
    formErr.value =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Gagal menyimpan promo diskon.'
  } finally {
    savingPromo.value = false
  }
}

async function togglePromoStatus(p: PromoRow) {
  togglingId.value = p.id
  try {
    await $fetch(`/api/admin/promo-diskon/${p.id}`, {
      method: 'PUT',
      body: { statusAktif: !p.statusAktif },
    })
    await refreshPromos()
    showToast(!p.statusAktif ? 'Promo diaktifkan.' : 'Promo dinonaktifkan.')
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    showToast(e?.data?.statusMessage || 'Gagal mengubah status promo.', 'bad')
  } finally {
    togglingId.value = null
  }
}

async function confirmDeletePromo() {
  if (!deleteTarget.value) return
  deletingId.value = deleteTarget.value.id
  try {
    await $fetch(`/api/admin/promo-diskon/${deleteTarget.value.id}`, { method: 'DELETE' })
    showToast(`Promo "${deleteTarget.value.namaPromo}" dihapus.`)
    deleteTarget.value = null
    await refreshPromos()
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string } }
    showToast(e?.data?.statusMessage || 'Gagal menghapus promo.', 'bad')
  } finally {
    deletingId.value = null
  }
}

function statusTone(status: PromoRow['statusBerjalan']) {
  if (status === 'Aktif') return 'good'
  if (status === 'Terjadwal') return 'warn'
  return 'bad'
}

function formatPeriod(p: PromoRow) {
  if (!p.tanggalMulai && !p.tanggalSelesai) return 'Berlaku terus (tanpa batas)'
  const s = p.tanggalMulai ? formatDateShort(p.tanggalMulai) : 'Sekarang'
  const e = p.tanggalSelesai ? formatDateShort(p.tanggalSelesai) : 'Seterusnya'
  return `${s} - ${e}`
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (deleteTarget.value && !deletingId.value) {
    deleteTarget.value = null
  } else if (showModal.value && !savingPromo.value) {
    showModal.value = false
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <span class="ed-label" style="color: var(--srf-accent);">PENGATURAN PROMO &amp; DISKON</span>
        <h1 class="mt-0.5 text-2xl font-bold tracking-tight" style="color: var(--srf-ink);">
          Diskon &amp; Promo Basecamp
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2);">
          Atur promo sewa multi-hari serta diskon khusus per alat, kategori, atau paket/bundle.
        </p>
      </div>
      <button type="button" class="ed-btn-primary" @click="openCreateModal">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>Buat Promo Diskon</span>
      </button>
    </div>

    <!-- Section A: Promo Durasi Sewa & Aturan Tarif -->
    <section class="ed-card p-5 space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span class="ed-label" style="color: var(--srf-accent);">PROMO DURASI SEWA &amp; TARIF DASAR</span>
          <h2 class="mt-0.5 text-base font-semibold" style="color: var(--srf-ink);">
            Skema Promo Sewa Multi-Hari &amp; Denda Basecamp
          </h2>
          <p class="mt-0.5 text-xs" style="color: var(--srf-ink-3);">
            Saat penyewa menyewa selama {{ ruleForm.minHariPromo }} hari atau lebih, sistem otomatis memberi diskon {{ ruleForm.diskonPersen }}%.
          </p>
        </div>
        <StatusBadge
          variant="light"
          :tone="ruleForm.diskonPersen > 0 && ruleForm.minHariPromo > 0 ? 'good' : 'warn'"
          :label="ruleForm.diskonPersen > 0 && ruleForm.minHariPromo > 0 ? `Promo ${ruleForm.minHariPromo}H -${ruleForm.diskonPersen}% Aktif` : 'Promo Durasi Nonaktif'"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div class="space-y-1 lg:col-span-2">
          <label class="ed-label" for="rule-nama">NAMA ATURAN</label>
          <input id="rule-nama" v-model="ruleForm.namaAturan" type="text" class="ed-input text-xs" />
        </div>
        <div class="space-y-1">
          <label class="ed-label" for="rule-durasi">DURASI DASAR (JAM)</label>
          <input id="rule-durasi" v-model.number="ruleForm.durasiDasarJam" type="number" min="1" class="ed-input tabular text-xs" />
        </div>
        <div class="space-y-1">
          <label class="ed-label" for="rule-min-hari">MIN HARI PROMO</label>
          <input id="rule-min-hari" v-model.number="ruleForm.minHariPromo" type="number" min="0" class="ed-input tabular text-xs" />
        </div>
        <div class="space-y-1">
          <label class="ed-label" for="rule-diskon">DISKON DURASI (%)</label>
          <input id="rule-diskon" v-model.number="ruleForm.diskonPersen" type="number" min="0" max="90" class="ed-input tabular text-xs" />
        </div>
        <div class="space-y-1">
          <label class="ed-label" for="rule-denda">DENDA / HARI (%)</label>
          <input id="rule-denda" v-model.number="ruleForm.dendaPersenHarian" type="number" min="0" class="ed-input tabular text-xs" />
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div class="flex items-center gap-2 text-xs" style="color: var(--srf-ink-3);">
          <span>Toleransi telat (jam):</span>
          <input
            v-model.number="ruleForm.toleransiTelatJam"
            type="number"
            min="0"
            max="48"
            aria-label="Toleransi telat jam"
            class="ed-input tabular !w-20 !min-h-[36px] !py-1 !text-xs"
          />
        </div>
        <button type="button" class="ed-btn-primary" :disabled="savingRule" @click="saveRule">
          {{ savingRule ? 'Menyimpan...' : 'Simpan Pengaturan Durasi' }}
        </button>
      </div>
    </section>

    <!-- Section B: Daftar Diskon Per Alat / Kategori / Paket -->
    <section class="ed-card overflow-hidden">
      <div
        class="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        style="border-bottom: 1px solid var(--srf-line);"
      >
        <div class="flex flex-wrap items-center gap-2">
          <select
            v-model="statusTab"
            aria-label="Filter status promo"
            class="ed-select !min-h-[44px] sm:!min-h-[38px] sm:!w-44 !py-1.5 !text-xs font-medium"
          >
            <option value="semua">Semua Promo ({{ promoList.length }})</option>
            <option value="Aktif">Aktif</option>
            <option value="Terjadwal">Terjadwal</option>
            <option value="Berakhir">Berakhir</option>
            <option value="Nonaktif">Nonaktif</option>
          </select>
        </div>

        <div class="relative w-full sm:w-72">
          <input
            v-model="search"
            type="search"
            placeholder="Cari nama promo atau target..."
            class="ed-input !min-h-[44px] sm:!min-h-[38px] !py-1.5 !text-xs"
          />
        </div>
      </div>

      <div v-if="promoPending && !promoList.length" class="p-10 text-center text-sm" style="color: var(--srf-ink-3);">
        Memuat daftar promo diskon...
      </div>

      <div v-else-if="promoErr && !promoList.length" class="p-10 text-center space-y-3">
        <p class="text-sm font-medium" style="color: var(--srf-bad-ink);">Gagal memuat promo diskon.</p>
        <button type="button" class="ed-btn-secondary" @click="refreshPromos()">Coba Lagi</button>
      </div>

      <div v-else-if="!filteredPromos.length" class="p-12 text-center space-y-3">
        <p class="text-sm font-medium" style="color: var(--srf-ink-2);">
          Belum ada promo diskon khusus per alat, kategori, atau paket.
        </p>
        <button type="button" class="ed-btn-primary" @click="openCreateModal">
          + Buat Promo Diskon Pertama
        </button>
      </div>

      <template v-else>
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr
                class="border-b text-[11px] font-semibold uppercase tracking-wider"
                style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-3);"
              >
                <th class="px-4 py-3">Nama Promo &amp; Label</th>
                <th class="px-4 py-3">Target</th>
                <th class="px-4 py-3 text-right">Potongan</th>
                <th class="px-4 py-3">Periode</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in filteredPromos"
                :key="p.id"
                class="border-b last:border-b-0 transition-colors hover:bg-[var(--srf-hover)]"
                style="border-color: var(--srf-line);"
              >
                <td class="px-4 py-3.5 align-middle">
                  <div class="font-semibold" style="color: var(--srf-ink);">{{ p.namaPromo }}</div>
                  <div v-if="p.labelBadge" class="mt-1">
                    <StatusBadge variant="light" tone="good" :label="p.labelBadge" />
                  </div>
                </td>
                <td class="px-4 py-3.5 align-middle text-xs" style="color: var(--srf-ink-2);">
                  {{ p.targetNama }}
                </td>
                <td class="px-4 py-3.5 align-middle text-right tabular font-semibold" style="color: var(--srf-good-ink);">
                  {{ p.tipePotongan === 'persen' ? `-${p.nilaiPotongan}%` : `-${formatRupiah(p.nilaiPotongan)}` }}
                </td>
                <td class="px-4 py-3.5 align-middle text-xs tabular" style="color: var(--srf-ink-3);">
                  {{ formatPeriod(p) }}
                </td>
                <td class="px-4 py-3.5 align-middle">
                  <button
                    type="button"
                    class="cursor-pointer rounded-full"
                    :disabled="togglingId === p.id"
                    @click="togglePromoStatus(p)"
                  >
                    <StatusBadge variant="outline" :label="p.statusBerjalan" :tone="statusTone(p.statusBerjalan)" />
                  </button>
                </td>
                <td class="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                  <div class="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !px-3 !min-h-0 !text-xs"
                      @click="openEditModal(p)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="ed-btn-secondary !h-9 !px-3 !min-h-0 !text-xs"
                      style="color: var(--srf-bad-ink); border-color: var(--srf-bad-border); background-color: var(--srf-bad-soft);"
                      @click="deleteTarget = p"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="divide-y md:hidden" style="border-color: var(--srf-line);">
          <div v-for="p in filteredPromos" :key="`mp-${p.id}`" class="space-y-2.5 p-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-sm font-semibold" style="color: var(--srf-ink);">{{ p.namaPromo }}</div>
                <div class="text-xs" style="color: var(--srf-ink-2);">{{ p.targetNama }}</div>
              </div>
              <button type="button" :disabled="togglingId === p.id" @click="togglePromoStatus(p)">
                <StatusBadge variant="outline" :label="p.statusBerjalan" :tone="statusTone(p.statusBerjalan)" />
              </button>
            </div>
            <div class="flex items-center justify-between text-xs tabular">
              <span class="font-bold" style="color: var(--srf-good-ink);">
                {{ p.tipePotongan === 'persen' ? `-${p.nilaiPotongan}%` : `-${formatRupiah(p.nilaiPotongan)}` }}
              </span>
              <span style="color: var(--srf-ink-3);">{{ formatPeriod(p) }}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button type="button" class="ed-btn-secondary h-11 justify-center text-xs" @click="openEditModal(p)">
                Edit
              </button>
              <button
                type="button"
                class="inline-flex h-11 items-center justify-center rounded-[10px] text-xs font-medium"
                style="border: 1px solid var(--srf-bad-border); background: var(--srf-bad-soft); color: var(--srf-bad-ink);"
                @click="deleteTarget = p"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      </template>
    </section>

    <!-- Modal Tambah / Edit Promo Diskon -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="!savingPromo && (showModal = false)"
    >
      <div
        class="ed-card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-promo-title"
      >
        <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid var(--srf-line);">
          <h2 id="modal-promo-title" class="text-base font-bold" style="color: var(--srf-ink);">
            {{ editingId ? 'Edit Promo Diskon' : 'Buat Promo Diskon Baru' }}
          </h2>
          <button type="button" class="ed-btn-secondary !h-9 !w-9 !min-h-0 !p-0" aria-label="Tutup modal" @click="showModal = false">
            ✕
          </button>
        </div>

        <div class="space-y-4 p-5">
          <div class="space-y-1">
            <label class="ed-label" for="promo-nama">NAMA PROMO</label>
            <input id="promo-nama" v-model="promoForm.namaPromo" type="text" class="ed-input" placeholder="Mis. Promo Akhir Pekan Tenda" />
          </div>

          <div class="space-y-1">
            <label class="ed-label" for="promo-badge">LABEL BADGE (OPSIONAL)</label>
            <input id="promo-badge" v-model="promoForm.labelBadge" type="text" class="ed-input" placeholder="Kosongkan untuk otomatis, mis. Diskon 15%" />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="ed-label" for="promo-target-tipe">TARGET DISKON</label>
              <select id="promo-target-tipe" v-model="promoForm.targetTipe" class="ed-select" @change="onTargetTypeChange">
                <option value="alat">Alat Spesifik</option>
                <option value="kategori">Semua Alat di Kategori</option>
                <option value="paket">Paket / Item Bundle</option>
                <option value="semua_alat">Semua Alat Satuan</option>
              </select>
            </div>

            <div v-if="promoForm.targetTipe !== 'semua_alat'" class="space-y-1">
              <label class="ed-label" for="promo-target-id">PILIH TARGET</label>
              <select id="promo-target-id" v-model.number="promoForm.targetId" class="ed-select">
                <template v-if="promoForm.targetTipe === 'kategori'">
                  <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.namaKategori }}</option>
                </template>
                <template v-else-if="promoForm.targetTipe === 'alat'">
                  <option v-for="a in tools" :key="a.id" :value="a.id">{{ a.kodeAlat }} · {{ a.namaAlat }}</option>
                </template>
                <template v-else>
                  <option v-for="pk in packages" :key="pk.id" :value="pk.id">
                    {{ pk.tipePaket === 'bundle' ? '[Bundle]' : '[Paket]' }} {{ pk.namaPaket }}
                  </option>
                </template>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="ed-label" for="promo-potongan-tipe">JENIS POTONGAN</label>
              <select id="promo-potongan-tipe" v-model="promoForm.tipePotongan" class="ed-select">
                <option value="persen">Persen (%)</option>
                <option value="nominal">Nominal (Rp)</option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="ed-label" for="promo-nilai">NILAI POTONGAN</label>
              <input id="promo-nilai" v-model.number="promoForm.nilaiPotongan" type="number" min="1" class="ed-input tabular font-semibold" />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="ed-label" for="promo-mulai">MULAI (OPSIONAL)</label>
              <input id="promo-mulai" v-model="promoForm.tanggalMulai" type="date" class="ed-input tabular text-xs" />
            </div>
            <div class="space-y-1">
              <label class="ed-label" for="promo-selesai">SELESAI (OPSIONAL)</label>
              <input id="promo-selesai" v-model="promoForm.tanggalSelesai" type="date" class="ed-input tabular text-xs" />
            </div>
          </div>

          <label class="ed-well flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3.5 py-2">
            <span class="text-xs font-semibold" style="color: var(--srf-ink);">Aktifkan promo ini</span>
            <input v-model="promoForm.statusAktif" type="checkbox" class="h-4 w-4 accent-blue-700" />
          </label>

          <div
            v-if="formErr"
            class="rounded-md border px-3 py-2 text-xs font-medium"
            style="background: var(--srf-bad-soft); border-color: var(--srf-bad-border); color: var(--srf-bad-ink);"
          >
            {{ formErr }}
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="ed-btn-secondary" :disabled="savingPromo" @click="showModal = false">
              Batal
            </button>
            <button type="button" class="ed-btn-primary" :disabled="savingPromo" @click="submitPromo">
              {{ savingPromo ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Simpan Promo' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Hapus Promo -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="!deletingId && (deleteTarget = null)"
    >
      <div class="ed-card w-full max-w-md p-5 space-y-4" role="dialog" aria-modal="true">
        <div>
          <span class="ed-label" style="color: var(--srf-bad-ink);">KONFIRMASI HAPUS</span>
          <h2 class="mt-1 text-base font-bold" style="color: var(--srf-ink);">
            Hapus promo "{{ deleteTarget.namaPromo }}"?
          </h2>
          <p class="mt-1 text-xs" style="color: var(--srf-ink-2);">
            Harga alat atau paket terkait akan langsung kembali ke tarif normal.
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="ed-btn-secondary" :disabled="Boolean(deletingId)" @click="deleteTarget = null">
            Batal
          </button>
          <button
            type="button"
            class="inline-flex min-h-[42px] items-center rounded-[10px] px-4 text-sm font-semibold text-white"
            style="background: var(--srf-bad);"
            :disabled="Boolean(deletingId)"
            @click="confirmDeletePromo"
          >
            {{ deletingId ? 'Menghapus...' : 'Hapus Promo' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="toastMsg"
      class="fixed bottom-5 right-5 z-50 rounded-[12px] px-4 py-3 text-xs font-medium shadow-lg"
      :style="
        toastMsg.tone === 'bad'
          ? { background: 'var(--srf-bad-soft)', border: '1px solid var(--srf-bad-border)', color: 'var(--srf-bad-ink)' }
          : { background: 'var(--srf-good-soft)', border: '1px solid var(--srf-good-border)', color: 'var(--srf-good-ink)' }
      "
    >
      {{ toastMsg.text }}
    </div>
  </div>
</template>

