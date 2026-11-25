<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface KategoriRow {
  id: number
  namaKategori: string
}

interface AlatRow {
  id: number
  kodeAlat: string
  idKategori: number
  namaKategori: string
  namaAlat: string
  hargaHarian: number
  stokTersedia: number
  statusAktif: boolean
}

interface ExistingBundle {
  id: number
  kodePaket: string
  namaPaket: string
  deskripsi: string
  labelPromo: string
  foto: string | null
  diskonPersen: number
  tarifPaket: number
  totalNormal: number
  statusAktif: boolean
  items: Array<{ idAlat: number; idKategori: number; jumlah: number }>
}

const route = useRoute()
const editId = computed(() => (route.query.edit ? Number(route.query.edit) : null))

const [{ data: alatRes }, { data: existingBundles }] = await Promise.all([
  useFetch<{ items: AlatRow[]; categories: KategoriRow[] }>('/api/admin/alat'),
  useFetch<ExistingBundle[]>('/api/admin/paket-alat?tipe=bundle'),
])

interface BundleRowDraft {
  key: number
  idAlat: number
  jumlah: number
}

let nextRowKey = 1
const namaPaket = ref('')
const labelPromo = ref('')
const deskripsi = ref('')
const foto = ref<string | null>(null)
const statusAktif = ref(true)
const pricingMode = ref<'persen' | 'nominal' | 'custom'>('persen')
const diskonPersenInput = ref<number>(15)
const potonganNominalInput = ref<number>(10000)
const customTarifInput = ref<number>(0)

const selectedCatIds = ref<number[]>([])
const rowsByCategory = reactive<Record<number, BundleRowDraft[]>>({})

const categories = computed(() => alatRes.value?.categories ?? [])
const toolsByCat = computed(() => {
  const map = new Map<number, AlatRow[]>()
  for (const item of alatRes.value?.items ?? []) {
    const arr = map.get(item.idKategori) ?? []
    arr.push(item)
    map.set(item.idKategori, arr)
  }
  return map
})

const alatMap = computed(() => new Map((alatRes.value?.items ?? []).map((a) => [a.id, a])))

function addToolRow(catId: number) {
  const list = (rowsByCategory[catId] ??= [])
  const used = new Set(list.map((r) => r.idAlat))
  const options = toolsByCat.value.get(catId) ?? []
  const nextTool =
    options.find((t) => t.statusAktif && !used.has(t.id)) ||
    options.find((t) => t.statusAktif) ||
    options[0]
  if (!nextTool) return
  list.push({ key: nextRowKey++, idAlat: nextTool.id, jumlah: 1 })
}

function removeToolRow(catId: number, rowKey: number) {
  const list = rowsByCategory[catId]
  if (!list) return
  rowsByCategory[catId] = list.filter((r) => r.key !== rowKey)
  if (!rowsByCategory[catId].length) {
    const idx = selectedCatIds.value.indexOf(catId)
    if (idx >= 0) selectedCatIds.value.splice(idx, 1)
  }
}

function ensureCategoryRow(catId: number) {
  if (!rowsByCategory[catId]?.length) {
    rowsByCategory[catId] = []
    addToolRow(catId)
  }
}

if (editId.value) {
  const target = (existingBundles.value ?? []).find((b) => b.id === editId.value)
  if (target) {
    namaPaket.value = target.namaPaket
    labelPromo.value = target.labelPromo || ''
    deskripsi.value = target.deskripsi || ''
    foto.value = target.foto
    statusAktif.value = target.statusAktif
    for (const item of target.items) {
      if (!selectedCatIds.value.includes(item.idKategori)) {
        selectedCatIds.value.push(item.idKategori)
      }
      const list = (rowsByCategory[item.idKategori] ??= [])
      list.push({ key: nextRowKey++, idAlat: item.idAlat, jumlah: item.jumlah })
    }
    if (target.diskonPersen > 0) {
      pricingMode.value = 'persen'
      diskonPersenInput.value = target.diskonPersen
    } else {
      pricingMode.value = 'custom'
      customTarifInput.value = target.tarifPaket
    }
  }
} else {
  const defaultCats = categories.value.slice(0, 2)
  for (const c of defaultCats) {
    if ((toolsByCat.value.get(c.id) ?? []).length) {
      selectedCatIds.value.push(c.id)
      ensureCategoryRow(c.id)
    }
  }
}

function toggleCategory(catId: number) {
  const idx = selectedCatIds.value.indexOf(catId)
  if (idx >= 0) {
    selectedCatIds.value.splice(idx, 1)
  } else {
    selectedCatIds.value.push(catId)
    ensureCategoryRow(catId)
  }
}

const activeCategoryGroups = computed(() =>
  selectedCatIds.value
    .map((catId) => {
      const cat = categories.value.find((c) => c.id === catId)
      const rows = rowsByCategory[catId] ?? []
      const options = toolsByCat.value.get(catId) ?? []
      const usedIds = new Set(rows.map((r) => r.idAlat))
      const activeOptionCount = options.filter((o) => o.statusAktif).length
      return {
        catId,
        catName: cat?.namaKategori ?? 'Kategori',
        options,
        rows,
        usedIds,
        canAddMore: rows.length < activeOptionCount,
      }
    })
    .filter((group) => group.rows.length > 0),
)

const flatSelectedItems = computed(() =>
  activeCategoryGroups.value.flatMap((group) =>
    group.rows.map((row) => ({
      catId: group.catId,
      catName: group.catName,
      row,
      alat: alatMap.value.get(row.idAlat),
    })),
  ),
)

const totalNormalHarian = computed(() =>
  flatSelectedItems.value.reduce((acc, entry) => {
    const rate = entry.alat?.hargaHarian ?? 0
    return acc + rate * Math.max(1, entry.row.jumlah)
  }, 0),
)

watch(totalNormalHarian, (val) => {
  if (pricingMode.value === 'custom' && customTarifInput.value <= 0 && !editId.value) {
    customTarifInput.value = val
  }
})

const finalTarifBundle = computed(() => {
  const base = totalNormalHarian.value
  if (pricingMode.value === 'persen') {
    const pct = Math.min(95, Math.max(0, Number(diskonPersenInput.value) || 0))
    return Math.max(0, Math.round((base * (100 - pct)) / 100))
  }
  if (pricingMode.value === 'nominal') {
    const cut = Math.max(0, Number(potonganNominalInput.value) || 0)
    return Math.max(0, base - cut)
  }
  return Math.max(0, Math.round(Number(customTarifInput.value) || 0))
})

const hematNominal = computed(() => Math.max(0, totalNormalHarian.value - finalTarifBundle.value))
const effectivePersen = computed(() => {
  if (totalNormalHarian.value <= 0 || hematNominal.value <= 0) return 0
  return Math.min(95, Math.round((hematNominal.value / totalNormalHarian.value) * 100))
})

const kuotaOtomatis = computed(() => {
  const totalsByAlat = new Map<number, number>()
  for (const entry of flatSelectedItems.value) {
    if (!entry.alat || entry.row.idAlat <= 0) continue
    totalsByAlat.set(
      entry.row.idAlat,
      (totalsByAlat.get(entry.row.idAlat) ?? 0) + Math.max(1, entry.row.jumlah),
    )
  }
  if (!totalsByAlat.size) return 0
  let minQuota = Infinity
  for (const [idAlat, qty] of totalsByAlat.entries()) {
    const avail = Math.max(0, alatMap.value.get(idAlat)?.stokTersedia ?? 0)
    minQuota = Math.min(minQuota, Math.floor(avail / qty))
  }
  return Number.isFinite(minQuota) ? minQuota : 0
})

const saving = ref(false)
const errorMsg = ref('')

async function saveBundle() {
  errorMsg.value = ''
  const items = flatSelectedItems.value
    .filter((e) => e.row.idAlat > 0)
    .map((e) => ({ idAlat: e.row.idAlat, jumlah: Math.max(1, e.row.jumlah) }))

  if (!namaPaket.value.trim()) {
    errorMsg.value = 'Nama item bundle wajib diisi.'
    return
  }
  if (!items.length) {
    errorMsg.value = 'Pilih minimal 1 kategori beserta alat di dalamnya.'
    return
  }
  if (finalTarifBundle.value <= 0) {
    errorMsg.value = 'Tarif final bundle wajib lebih dari Rp 0.'
    return
  }

  saving.value = true
  try {
    const payload = {
      namaPaket: namaPaket.value.trim(),
      tipePaket: 'bundle' as const,
      labelPromo: labelPromo.value.trim() || null,
      deskripsi: deskripsi.value.trim() || null,
      foto: foto.value,
      diskonPersen: effectivePersen.value,
      tarifPaket: finalTarifBundle.value,
      statusAktif: statusAktif.value,
      items,
    }
    if (editId.value) {
      await $fetch(`/api/admin/paket-alat/${editId.value}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await $fetch('/api/admin/paket-alat', {
        method: 'POST',
        body: payload,
      })
    }
    await navigateTo('/admin/item-bundle')
  } catch (err: unknown) {
    errorMsg.value = extractErrorMessage(err, 'Gagal menyimpan item bundle.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">
          BUNDLE PROMO ALAT
        </p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight" style="color: var(--srf-ink)">
          {{ editId ? 'Edit Item Bundle' : 'Tambah Item Bundle' }}
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Susun kombinasi beberapa alat gunung, tentukan promo harga bundle, dan tampilkan ke katalog publik.
        </p>
      </div>
      <NuxtLink to="/admin/item-bundle" class="ed-btn-secondary">
        Kembali ke Item Bundle
      </NuxtLink>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="space-y-5 lg:col-span-8">
        <section class="ed-card p-5 space-y-4">
          <div>
            <h2 class="text-sm font-semibold" style="color: var(--srf-ink)">
              1. Informasi Bundle &amp; Foto Promo
            </h2>
            <p class="text-xs" style="color: var(--srf-ink-3)">
              Tambahkan label promo opsional agar bundle langsung menonjol di website publik.
            </p>
          </div>

          <AdminImageUpload
            v-model="foto"
            folder="paket"
            label="UPLOAD GAMBAR BUNDLE (JPG / PNG / WEBP · MAKS 2MB)"
            fallback-kind="tent"
          />

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div class="space-y-1 sm:col-span-7">
              <label class="ed-label" for="nama-bundle">NAMA ITEM BUNDLE</label>
              <input
                id="nama-bundle"
                v-model="namaPaket"
                type="text"
                class="ed-input"
                placeholder="Mis. Bundle Camp Hemat 2 Orang"
              />
            </div>
            <div class="space-y-1 sm:col-span-5">
              <label class="ed-label" for="label-promo">LABEL PROMO (OPSIONAL)</label>
              <input
                id="label-promo"
                v-model="labelPromo"
                type="text"
                class="ed-input"
                placeholder="Mis. BUNDLE HEMAT 15%"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="ed-label" for="deskripsi-bundle">DESKRIPSI SINGKAT (OPSIONAL)</label>
            <textarea
              id="deskripsi-bundle"
              v-model="deskripsi"
              rows="2"
              class="ed-textarea text-xs"
              placeholder="Mis. Paket hemat untuk kemping akhir pekan berdua sudah termasuk tenda dan matras."
            />
          </div>

          <label class="ed-well flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5">
            <div class="min-w-0">
              <span class="ed-label block">STATUS AKTIF BUNDLE</span>
              <span class="text-xs font-medium" style="color: var(--srf-ink);">
                {{ statusAktif ? 'Aktif (Tampil di publik dan Sewa Alat)' : 'Nonaktif (Disembunyikan)' }}
              </span>
            </div>
            <input
              v-model="statusAktif"
              type="checkbox"
              class="h-4 w-4 shrink-0 cursor-pointer accent-blue-700"
            />
          </label>
        </section>

        <section class="ed-card p-5 space-y-4">
          <div>
            <h2 class="text-sm font-semibold" style="color: var(--srf-ink)">
              2. Pilih Kategori &amp; Isi Alat Bundle
            </h2>
            <p class="text-xs" style="color: var(--srf-ink-3)">
              Pilih kategori di bawah ini untuk memilih beberapa alat dan jumlah unit dalam satu bundle.
            </p>
          </div>

          <div class="space-y-2">
            <div class="ed-label">PILIH DARI KATEGORI MANA SAJA (MULTI-PILIH)</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in categories"
                :key="cat.id"
                type="button"
                class="ed-chip"
                :data-selected="selectedCatIds.includes(cat.id)"
                @click="toggleCategory(cat.id)"
              >
                <span>{{ selectedCatIds.includes(cat.id) ? '✓' : '+' }} {{ cat.namaKategori }}</span>
                <span class="tabular text-xs" style="color: var(--srf-ink-3)">
                  {{ (toolsByCat.get(cat.id) ?? []).length }}
                </span>
              </button>
            </div>
          </div>

          <div v-if="!activeCategoryGroups.length" class="ed-well p-4 text-xs" style="color: var(--srf-ink-3)">
            Belum ada kategori terpilih. Klik minimal satu kategori di atas.
          </div>

          <div v-else class="space-y-3">
            <div
              class="hidden sm:grid sm:grid-cols-12 gap-3 rounded-md border px-3 py-2 text-xs font-semibold"
              style="background-color: var(--srf-well); border-color: var(--srf-line); color: var(--srf-ink-2)"
            >
              <div class="col-span-3">KATEGORI</div>
              <div class="col-span-9">PILIH ALAT DARI KATEGORI</div>
            </div>

            <div
              v-for="group in activeCategoryGroups"
              :key="group.catId"
              class="grid grid-cols-1 gap-3 border-b pb-3.5 last:border-b-0 sm:grid-cols-12 sm:items-start"
              style="border-color: var(--srf-line)"
            >
              <div class="sm:col-span-3 space-y-1.5 pt-1">
                <div class="text-sm font-semibold">{{ group.catName }}</div>
                <div class="text-xs" style="color: var(--srf-ink-3)">
                  {{ group.rows.length }} alat dipilih
                </div>
                <button
                  v-if="group.canAddMore"
                  type="button"
                  class="ed-btn-secondary !px-2.5 !py-1 !text-xs"
                  @click="addToolRow(group.catId)"
                >
                  + Tambah alat
                </button>
              </div>

              <div class="space-y-2 sm:col-span-9">
                <div v-for="row in group.rows" :key="row.key" class="grid grid-cols-12 items-center gap-2">
                  <div class="col-span-12 sm:col-span-6">
                    <select v-model="row.idAlat" class="ed-select !text-xs">
                      <option
                        v-for="opt in group.options"
                        :key="opt.id"
                        :value="opt.id"
                        :disabled="!opt.statusAktif || (opt.id !== row.idAlat && group.usedIds.has(opt.id))"
                      >
                        {{ opt.namaAlat }} · {{ formatCompactRupiah(opt.hargaHarian) }} (Stok {{ opt.stokTersedia }}{{ !opt.statusAktif ? ', Nonaktif' : '' }})
                      </option>
                    </select>
                  </div>

                  <div class="col-span-4 sm:col-span-2">
                    <input
                      v-model.number="row.jumlah"
                      type="number"
                      min="1"
                      class="ed-input tabular !text-xs"
                      aria-label="Jumlah unit"
                    />
                  </div>

                  <div class="col-span-5 sm:col-span-2">
                    <StatusBadge
                      :label="`${alatMap.get(row.idAlat)?.stokTersedia ?? 0} unit`"
                      :tone="(alatMap.get(row.idAlat)?.stokTersedia ?? 0) > 2 ? 'good' : 'warn'"
                    />
                  </div>

                  <div class="col-span-3 sm:col-span-2 text-right">
                    <button
                      type="button"
                      class="cursor-pointer text-xs font-semibold hover:underline"
                      style="color: var(--srf-bad-ink)"
                      @click="removeToolRow(group.catId, row.key)"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="ed-card p-5 space-y-4">
          <div>
            <h2 class="text-sm font-semibold" style="color: var(--srf-ink)">
              3. Pengaturan Harga Bundle
            </h2>
            <p class="text-xs" style="color: var(--srf-ink-3)">
              Pilih cara menentukan harga bundle promo dari total harga satuan alat.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              class="ed-chip justify-center !min-h-[42px]"
              :data-selected="pricingMode === 'persen'"
              @click="pricingMode = 'persen'"
            >
              Diskon Persen (%)
            </button>
            <button
              type="button"
              class="ed-chip justify-center !min-h-[42px]"
              :data-selected="pricingMode === 'nominal'"
              @click="pricingMode = 'nominal'"
            >
              Potongan Nominal (Rp)
            </button>
            <button
              type="button"
              class="ed-chip justify-center !min-h-[42px]"
              :data-selected="pricingMode === 'custom'"
              @click="pricingMode = 'custom'; if (customTarifInput <= 0) customTarifInput = totalNormalHarian"
            >
              Harga Bundle Custom
            </button>
          </div>

          <div v-if="pricingMode === 'persen'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="ed-label" for="bundle-diskon-pct">PERSENTASE DISKON BUNDLE (%)</label>
              <input
                id="bundle-diskon-pct"
                v-model.number="diskonPersenInput"
                type="number"
                min="0"
                max="95"
                class="ed-input tabular font-semibold"
              />
            </div>
            <div class="space-y-1">
              <span class="ed-label block">TARIF FINAL BUNDLE / 24 JAM</span>
              <input :value="formatRupiah(finalTarifBundle)" type="text" readonly class="ed-input tabular font-semibold" />
            </div>
          </div>

          <div v-else-if="pricingMode === 'nominal'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="ed-label" for="bundle-potongan-rp">POTONGAN NOMINAL (RP)</label>
              <input
                id="bundle-potongan-rp"
                v-model.number="potonganNominalInput"
                type="number"
                min="0"
                step="1000"
                class="ed-input tabular font-semibold"
              />
            </div>
            <div class="space-y-1">
              <span class="ed-label block">TARIF FINAL BUNDLE / 24 JAM</span>
              <input :value="formatRupiah(finalTarifBundle)" type="text" readonly class="ed-input tabular font-semibold" />
            </div>
          </div>

          <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="space-y-1">
              <label class="ed-label" for="bundle-custom-tarif">HARGA BUNDLE CUSTOM / 24 JAM (RP)</label>
              <input
                id="bundle-custom-tarif"
                v-model.number="customTarifInput"
                type="number"
                min="1000"
                step="1000"
                class="ed-input tabular font-semibold"
              />
            </div>
            <div class="space-y-1">
              <span class="ed-label block">SELISIH HEMAT</span>
              <input
                :value="`${formatRupiah(hematNominal)} (${effectivePersen}%)`"
                type="text"
                readonly
                class="ed-input tabular font-semibold"
              />
            </div>
          </div>
        </section>
      </div>

      <div class="space-y-4 lg:col-span-4">
        <div class="ed-card p-5 space-y-4">
          <div>
            <p class="ed-label" style="color: var(--srf-accent)">RINGKASAN ITEM BUNDLE</p>
            <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
              {{ namaPaket || 'Item Bundle Baru' }}
            </h2>
          </div>

          <div class="ed-well p-3 space-y-2 text-xs">
            <div v-if="!flatSelectedItems.length" style="color: var(--srf-ink-3)">
              Belum ada alat terpilih.
            </div>
            <div
              v-for="entry in flatSelectedItems"
              :key="`sum-${entry.row.key}`"
              class="flex items-center justify-between gap-2"
            >
              <span class="truncate">{{ entry.row.jumlah }}x {{ entry.alat?.namaAlat || '-' }}</span>
              <span class="tabular shrink-0" style="color: var(--srf-ink-2)">
                {{ formatRupiah((entry.alat?.hargaHarian ?? 0) * entry.row.jumlah) }}
              </span>
            </div>
          </div>

          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between">
              <span style="color: var(--srf-ink-3)">Total harga satuan / 24 jam</span>
              <span class="tabular font-medium">{{ formatRupiah(totalNormalHarian) }}</span>
            </div>
            <div v-if="hematNominal > 0" class="flex justify-between">
              <span style="color: var(--srf-ink-3)">Potongan bundle ({{ effectivePersen }}%)</span>
              <span class="tabular font-semibold" style="color: var(--srf-good-ink)">
                -{{ formatRupiah(hematNominal) }}
              </span>
            </div>
            <div class="flex justify-between border-t pt-2 text-sm font-semibold" style="border-color: var(--srf-line)">
              <span>Tarif bundle / 24 jam</span>
              <span class="tabular">{{ formatRupiah(finalTarifBundle) }}</span>
            </div>
            <div class="flex items-center justify-between pt-1">
              <span style="color: var(--srf-ink-3)">Kuota bundle tersedia</span>
              <StatusBadge :label="`${kuotaOtomatis} bundle`" :tone="kuotaOtomatis > 2 ? 'good' : 'warn'" />
            </div>
          </div>

          <div
            v-if="errorMsg"
            class="rounded-md border px-3 py-2 text-xs font-medium"
            style="background-color: var(--srf-bad-soft); border-color: var(--srf-bad-border); color: var(--srf-bad-ink);"
          >
            {{ errorMsg }}
          </div>

          <button type="button" class="ed-btn-primary w-full" :disabled="saving" @click="saveBundle">
            {{ saving ? 'Menyimpan...' : editId ? 'Perbarui Item Bundle' : 'Simpan Item Bundle' }}
          </button>
        </div>

        <div class="ed-card p-4 space-y-1.5 text-xs" style="color: var(--srf-ink-2)">
          <div class="ed-label">INFO ITEM BUNDLE</div>
          <p>1. Kuota bundle mengikuti stok alat terkecil secara real time.</p>
          <p>2. Tarif bundle dapat memakai diskon persen, nominal, atau harga custom.</p>
          <p>3. Bundle aktif langsung tampil di website publik dan form Sewa Alat.</p>
        </div>
      </div>
    </div>
  </div>
</template>

