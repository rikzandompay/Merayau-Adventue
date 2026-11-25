<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface KategoriRow {
  id: number
  namaKategori: string
  jumlahAlat?: number
}

interface AlatRow {
  id: number
  kodeAlat: string
  idKategori: number
  namaKategori: string
  namaAlat: string
  spesifikasi: string
  hargaHarian: number
  stokTotal: number
  stokDisewa: number
  stokTersedia: number
  kondisi: string
  foto: string | null
  statusAktif: boolean
}

interface SettingRow {
  id: number
  namaAturan: string
  durasiDasarJam: number
  minHariPromo: number
  diskonPersen: number
  toleransiTelatJam: number
  dendaPersenHarian: number
}

const activeKategoriId = ref<number | null>(null)
const search = ref('')
const showCatManager = ref(false)
const newCategoryName = ref('')

const [{ data: alatRes, refresh: refreshAlat }, { data: settingRes, refresh: refreshSetting }] =
  await Promise.all([
    useFetch<{ items: AlatRow[]; categories: KategoriRow[]; allCount: number }>('/api/admin/alat'),
    useFetch<SettingRow>('/api/admin/pengaturan-sewa'),
  ])

const filteredItems = computed(() => {
  const list = alatRes.value?.items ?? []
  const q = search.value.trim().toLowerCase()
  return list.filter((it) => {
    if (activeKategoriId.value && it.idKategori !== activeKategoriId.value) return false
    if (q && !it.namaAlat.toLowerCase().includes(q) && !it.kodeAlat.toLowerCase().includes(q)) {
      return false
    }
    return true
  })
})

const categoryCounts = computed(() => {
  const map = new Map<number, number>()
  for (const it of alatRes.value?.items ?? []) {
    map.set(it.idKategori, (map.get(it.idKategori) ?? 0) + 1)
  }
  return map
})

const isCreateMode = ref(false)
const selectedId = ref<number | null>(alatRes.value?.items?.[0]?.id ?? null)

const form = reactive({
  kodeAlat: '',
  idKategori: alatRes.value?.categories?.[0]?.id ?? 0,
  namaAlat: '',
  spesifikasi: '',
  hargaHarian: 30000,
  stokTotal: 5,
  kondisi: 'Baik',
  foto: null as string | null,
  statusAktif: true,
})

function loadIntoEditor(item: AlatRow) {
  isCreateMode.value = false
  selectedId.value = item.id
  form.kodeAlat = item.kodeAlat
  form.idKategori = item.idKategori
  form.namaAlat = item.namaAlat
  form.spesifikasi = item.spesifikasi
  form.hargaHarian = item.hargaHarian
  form.stokTotal = item.stokTotal
  form.kondisi = item.kondisi
  form.foto = item.foto
  form.statusAktif = item.statusAktif
}

if (alatRes.value?.items?.[0]) {
  loadIntoEditor(alatRes.value.items[0])
}

function startCreateNew() {
  isCreateMode.value = true
  selectedId.value = null
  form.kodeAlat = `ALT-${Date.now().toString().slice(-4)}`
  form.idKategori = alatRes.value?.categories?.[0]?.id ?? 0
  form.namaAlat = ''
  form.spesifikasi = ''
  form.hargaHarian = 25000
  form.stokTotal = 4
  form.kondisi = 'Baik'
  form.foto = null
  form.statusAktif = true
}

const savingAlat = ref(false)
const alatFeedback = ref<{ type: 'ok' | 'err'; msg: string } | null>(null)

async function saveAlat() {
  alatFeedback.value = null
  savingAlat.value = true
  try {
    if (isCreateMode.value) {
      const created = await $fetch<AlatRow>('/api/admin/alat', { method: 'POST', body: form })
      alatFeedback.value = { type: 'ok', msg: `${created.namaAlat} ditambahkan.` }
      await refreshAlat()
      loadIntoEditor(created)
    } else if (selectedId.value) {
      await $fetch(`/api/admin/alat/${selectedId.value}`, { method: 'PUT', body: form })
      alatFeedback.value = { type: 'ok', msg: 'Perubahan alat disimpan.' }
      await refreshAlat()
    }
  } catch (err: unknown) {
    alatFeedback.value = {
      type: 'err',
      msg:
        (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data
          ?.statusMessage || 'Gagal menyimpan data alat.',
    }
  } finally {
    savingAlat.value = false
  }
}

async function deleteOrDisableAlat() {
  if (!selectedId.value) return
  alatFeedback.value = null
  try {
    const res = await $fetch<{ ok: boolean; softDisabled: boolean; message?: string }>(
      `/api/admin/alat/${selectedId.value}`,
      { method: 'DELETE' },
    )
    alatFeedback.value = {
      type: 'ok',
      msg: res.softDisabled
        ? res.message || 'Alat dinonaktifkan.'
        : 'Alat dihapus permanen.',
    }
    await refreshAlat()
    if (alatRes.value?.items?.[0]) loadIntoEditor(alatRes.value.items[0])
  } catch (err: unknown) {
    alatFeedback.value = {
      type: 'err',
      msg:
        (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data
          ?.statusMessage || 'Gagal memproses penghapusan alat.',
    }
  }
}

async function addCategory() {
  if (!newCategoryName.value.trim()) return
  await $fetch('/api/admin/kategori', {
    method: 'POST',
    body: { namaKategori: newCategoryName.value.trim() },
  })
  newCategoryName.value = ''
  await refreshAlat()
}

async function removeCategory(id: number) {
  alatFeedback.value = null
  try {
    await $fetch(`/api/admin/kategori/${id}`, { method: 'DELETE' })
    await refreshAlat()
  } catch (err: unknown) {
    alatFeedback.value = {
      type: 'err',
      msg:
        (err as { data?: { statusMessage?: string }; statusMessage?: string })?.data
          ?.statusMessage || 'Kategori gagal dihapus.',
    }
  }
}

const ruleForm = reactive({
  namaAturan: settingRes.value?.namaAturan ?? 'Reguler Basecamp Sleman',
  durasiDasarJam: settingRes.value?.durasiDasarJam ?? 24,
  minHariPromo: settingRes.value?.minHariPromo ?? 3,
  diskonPersen: settingRes.value?.diskonPersen ?? 15,
  toleransiTelatJam: settingRes.value?.toleransiTelatJam ?? 2,
  dendaPersenHarian: settingRes.value?.dendaPersenHarian ?? 50,
})
const savingRule = ref(false)
const ruleMsg = ref('')

async function saveRule() {
  savingRule.value = true
  ruleMsg.value = ''
  try {
    await $fetch('/api/admin/pengaturan-sewa', { method: 'PUT', body: ruleForm })
    ruleMsg.value = 'Aturan tarif & denda diperbarui.'
    await refreshSetting()
  } finally {
    savingRule.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">
          INVENTORI &amp; ATURAN TARIF
        </p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">
          Master Alat &amp; Kategori
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Kelola katalog alat, foto inventori, stok total, status aktif, serta aturan tarif dan denda basecamp.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <button type="button" class="ed-btn-secondary" @click="showCatManager = !showCatManager">
          {{ showCatManager ? 'Tutup Kategori' : 'Kelola Kategori' }}
        </button>
        <button type="button" class="ed-btn-primary" @click="startCreateNew">
          + Tambah Alat Baru
        </button>
      </div>
    </div>

    <div v-if="showCatManager" class="ed-card p-4 space-y-3">
      <div class="ed-label">KELOLA KATEGORI ALAT</div>
      <form class="flex flex-wrap gap-2" @submit.prevent="addCategory">
        <input
          v-model="newCategoryName"
          type="text"
          class="ed-input !w-64"
          placeholder="Nama kategori baru..."
          required
        />
        <button type="submit" class="ed-btn-primary !text-xs">Tambah Kategori</button>
      </form>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="cat in alatRes?.categories"
          :key="cat.id"
          class="ed-well inline-flex items-center gap-2 px-3 py-1 text-xs"
        >
          {{ cat.namaKategori }}
          <button
            type="button"
            class="cursor-pointer font-semibold"
            style="color: var(--srf-bad)"
            @click="removeCategory(cat.id)"
          >
            x
          </button>
        </span>
      </div>
    </div>

    <div class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <label for="master-alat-kategori-filter" class="sr-only">Filter Kategori Alat</label>
        <select
          id="master-alat-kategori-filter"
          v-model="activeKategoriId"
          class="ed-select !min-h-[44px] sm:!min-h-[38px] sm:!w-56 !py-1.5 !text-xs font-medium"
        >
          <option :value="null">Semua Kategori ({{ alatRes?.allCount ?? 0 }})</option>
          <option v-for="cat in alatRes?.categories" :key="cat.id" :value="cat.id">
            {{ cat.namaKategori }} ({{ categoryCounts.get(cat.id) ?? 0 }})
          </option>
        </select>
        <button
          v-if="activeKategoriId !== null || search.trim().length > 0"
          type="button"
          class="ed-btn-ghost !min-h-[44px] sm:!min-h-[38px] !px-3 !text-xs"
          @click="activeKategoriId = null; search = ''"
        >
          Reset
        </button>
      </div>
      <input
        v-model="search"
        type="search"
        class="ed-input !min-h-[44px] sm:!min-h-[38px] sm:!w-64 !py-1.5 !text-xs"
        placeholder="Cari kode atau nama alat..."
      />
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="ed-card overflow-hidden lg:col-span-8">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse text-left text-sm">
            <thead>
              <tr
                class="border-b text-xs font-semibold"
                style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-2)"
              >
                <th class="px-4 py-2.5">Kode</th>
                <th class="px-4 py-2.5">Nama Alat</th>
                <th class="px-4 py-2.5">Kategori</th>
                <th class="px-4 py-2.5">Tarif / 24j</th>
                <th class="px-4 py-2.5">Stok Siap</th>
                <th class="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filteredItems"
                :key="item.id"
                class="cursor-pointer border-b last:border-b-0 transition-colors"
                :style="{
                  borderColor: 'var(--srf-line)',
                  backgroundColor:
                    !isCreateMode && selectedId === item.id ? 'var(--srf-hover)' : undefined,
                }"
                @click="loadIntoEditor(item)"
              >
                <td
                  class="px-4 py-3 tabular text-xs font-semibold"
                  :style="{ color: 'var(--srf-accent)' }"
                >
                  {{ item.kodeAlat }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="h-7 w-9 shrink-0 overflow-hidden rounded border"
                      style="background-color: var(--srf-well); border-color: var(--srf-line)"
                    >
                      <img v-if="item.foto" :src="item.foto" :alt="item.namaAlat" class="h-full w-full object-cover" />
                      <GearArtThumb v-else :kind="item.namaKategori" />
                    </div>
                    <span class="font-medium">{{ item.namaAlat }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-xs" style="color: var(--srf-ink-2)">
                  {{ item.namaKategori }}
                </td>
                <td class="px-4 py-3 tabular text-xs font-medium">
                  {{ formatRupiah(item.hargaHarian) }}
                </td>
                <td class="px-4 py-3 tabular text-xs">
                  {{ item.stokTersedia }} / {{ item.stokTotal }} unit
                </td>
                <td class="px-4 py-3">
                  <StatusBadge
                    :label="!item.statusAktif ? 'Nonaktif' : item.stokTersedia <= 2 ? 'Menipis' : 'Aktif'"
                    :tone="!item.statusAktif ? 'bad' : item.stokTersedia <= 2 ? 'warn' : 'good'"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="space-y-5 lg:col-span-4 lg:sticky lg:top-6 lg:self-start">
        <div class="ed-card p-5 space-y-3.5">
          <div>
            <p class="ed-label" style="color: var(--srf-accent)">
              {{ isCreateMode ? 'ALAT BARU' : `INSPEKTOR ITEM · ${form.kodeAlat}` }}
            </p>
            <h2 class="text-sm font-semibold">
              {{ isCreateMode ? 'Tambah Inventori Alat' : form.namaAlat }}
            </h2>
          </div>

          <AdminImageUpload
            v-model="form.foto"
            folder="alat"
            label="FOTO ALAT (JPG / PNG / WEBP · MAKS 2MB)"
            :fallback-kind="form.namaAlat || 'tent'"
          />

          <div v-if="isCreateMode" class="space-y-1">
            <label class="ed-label">KODE ALAT UNIK</label>
            <input v-model="form.kodeAlat" type="text" class="ed-input tabular" />
          </div>

          <div class="space-y-1">
            <label class="ed-label">KATEGORI</label>
            <select v-model="form.idKategori" class="ed-select">
              <option v-for="cat in alatRes?.categories" :key="cat.id" :value="cat.id">
                {{ cat.namaKategori }}
              </option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="ed-label">NAMA ALAT</label>
            <input v-model="form.namaAlat" type="text" class="ed-input" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="ed-label">TARIF / 24 JAM</label>
              <input v-model.number="form.hargaHarian" type="number" min="1000" class="ed-input tabular" />
            </div>
            <div class="space-y-1">
              <label class="ed-label">STOK TOTAL</label>
              <input v-model.number="form.stokTotal" type="number" min="0" class="ed-input tabular" />
            </div>
          </div>

          <div class="space-y-1">
            <label class="ed-label">SPESIFIKASI</label>
            <textarea v-model="form.spesifikasi" rows="2" class="ed-textarea text-xs" />
          </div>

          <label class="ed-well flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
            <span class="font-medium" :style="{ color: form.statusAktif ? 'var(--srf-good)' : 'var(--srf-bad)' }">
              Status Aktif: {{ form.statusAktif ? 'Aktif (Bisa disewa)' : 'Nonaktif (Disembunyikan)' }}
            </span>
            <input v-model="form.statusAktif" type="checkbox" class="h-4 w-4 accent-[#2563eb]" />
          </label>

          <div
            v-if="alatFeedback"
            class="rounded-md border px-3 py-2 text-xs font-medium"
            :style="{
              backgroundColor: 'var(--srf-well)',
              borderColor: alatFeedback.type === 'ok' ? 'var(--srf-good)' : 'var(--srf-bad)',
              color: alatFeedback.type === 'ok' ? 'var(--srf-good)' : 'var(--srf-bad)',
            }"
          >
            {{ alatFeedback.msg }}
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              class="ed-btn-primary flex-1"
              :disabled="savingAlat"
              @click="saveAlat"
            >
              {{ savingAlat ? 'Menyimpan...' : isCreateMode ? 'Simpan Alat Baru' : 'Simpan Perubahan Alat' }}
            </button>
            <button
              v-if="!isCreateMode && selectedId"
              type="button"
              class="ed-btn-secondary !px-3 !text-xs"
              style="color: var(--srf-bad)"
              @click="deleteOrDisableAlat"
            >
              Hapus
            </button>
          </div>
        </div>

        <div class="ed-card p-5 space-y-3">
          <div>
            <p class="ed-label">ATURAN SEWA AKTIF</p>
            <h3 class="text-sm font-semibold">Skema Harga &amp; Denda Basecamp</h3>
          </div>
          <div class="ed-well grid grid-cols-2 gap-2.5 p-3 text-xs tabular">
            <div>
              <div style="color: var(--srf-ink-3)">DURASI DASAR</div>
              <div class="font-semibold" style="color: var(--srf-ink)">{{ ruleForm.durasiDasarJam }} jam</div>
            </div>
            <div>
              <div style="color: var(--srf-ink-3)">PROMO DURASI</div>
              <div class="font-semibold" style="color: var(--srf-good-ink)">
                &gt;= {{ ruleForm.minHariPromo }} hr (-{{ ruleForm.diskonPersen }}%)
              </div>
            </div>
            <div>
              <div style="color: var(--srf-ink-3)">TOLERANSI TELAT</div>
              <div class="font-semibold" style="color: var(--srf-ink)">{{ ruleForm.toleransiTelatJam }} jam</div>
            </div>
            <div>
              <div style="color: var(--srf-ink-3)">DENDA / HARI</div>
              <div class="font-semibold" style="color: var(--srf-ink)">{{ ruleForm.dendaPersenHarian }}%</div>
            </div>
          </div>
          <NuxtLink to="/admin/diskon-promo" class="ed-btn-secondary w-full justify-center !text-xs">
            Kelola di Diskon &amp; Promo
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

