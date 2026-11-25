<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface GalleryItem {
  src: string
  label: string
  tag: string
}

interface AdminTripRow {
  id: number
  kodeTrip: string
  judul: string
  lokasi: string
  durasi: string
  foto: string | null
  statusPublish: 'Published' | 'Draft' | 'Penuh'
  detail?: {
    elevation?: string
    gallery?: string[]
    galleryItems?: Array<{ src: string; label?: string; tag?: string }>
  }
}

interface TripsResponse {
  trips: AdminTripRow[]
}

const { data, pending, error, refresh } = await useFetch<TripsResponse>('/api/admin/trips')

onMounted(() => {
  refresh()
})

const trips = computed(() => data.value?.trips ?? [])
const selectedTripId = ref<number>(0)

const selectedTrip = computed(
  () => trips.value.find((t) => t.id === selectedTripId.value) ?? trips.value[0] ?? null,
)
const selectedTripIndex = computed(() =>
  Math.max(0, trips.value.findIndex((t) => t.id === selectedTrip.value?.id)),
)

const heroFoto = ref<string | null>(null)
const slots = ref<GalleryItem[]>([])
const activePreviewIdx = ref(2)
const dirty = ref(false)
const saving = ref(false)
const publishing = ref(false)
const feedback = ref<{ type: 'ok' | 'err'; msg: string } | null>(null)

function extractSavedItems(trip: AdminTripRow): GalleryItem[] {
  const curated = (trip.detail?.galleryItems ?? [])
    .filter((item) => Boolean(item?.src?.trim()))
    .map((item) => ({
      src: item.src.trim(),
      label: item.label?.trim() ?? '',
      tag: item.tag?.trim() ?? '',
    }))
  if (curated.length) return curated.slice(0, 5)

  return (trip.detail?.gallery ?? [])
    .filter((g) => Boolean(g?.trim()))
    .slice(0, 5)
    .map((src) => ({
      src: src.trim(),
      label: '',
      tag: '',
    }))
}

function hydrateEditor(trip: AdminTripRow | null) {
  feedback.value = null
  dirty.value = false
  if (!trip) {
    heroFoto.value = null
    slots.value = []
    return
  }
  heroFoto.value = trip.foto
  slots.value = extractSavedItems(trip)
  activePreviewIdx.value = 2
}

watch(
  trips,
  (list) => {
    if (!list.length) {
      selectedTripId.value = 0
      hydrateEditor(null)
      return
    }
    if (!selectedTripId.value || !list.some((t) => t.id === selectedTripId.value)) {
      selectedTripId.value = list[0]!.id
      hydrateEditor(list[0]!)
    }
  },
  { immediate: true },
)

watch(selectedTripId, (id, prevId) => {
  if (!id || id === prevId) return
  const target = trips.value.find((t) => t.id === id) ?? null
  hydrateEditor(target)
})

function markDirty() {
  dirty.value = true
  feedback.value = null
}

function onHeroChange(val: string | null) {
  heroFoto.value = val
  markDirty()
}

function onSlotSrcChange(idx: number, val: string | null) {
  if (!slots.value[idx]) return
  slots.value[idx]!.src = val ?? ''
  markDirty()
}

function addSlot() {
  if (slots.value.length >= 5) return
  slots.value.push({ src: '', label: '', tag: '' })
  activePreviewIdx.value = Math.min(4, slots.value.length - 1)
  markDirty()
}

function removeSlot(idx: number) {
  slots.value.splice(idx, 1)
  activePreviewIdx.value = Math.min(activePreviewIdx.value, Math.max(0, previewCards.value.length - 1))
  markDirty()
}

function moveSlot(idx: number, dir: -1 | 1) {
  const target = idx + dir
  if (target < 0 || target >= slots.value.length) return
  const current = slots.value[idx]!
  slots.value[idx] = slots.value[target]!
  slots.value[target] = current
  activePreviewIdx.value = target
  markDirty()
}

function loadLandingPreset() {
  if (!selectedTrip.value) return
  const resolved = resolveTripGalleryCards(selectedTrip.value, selectedTripIndex.value)
  slots.value = resolved.map((card) => ({
    src: card.src,
    label: card.label,
    tag: card.tag,
  }))
  activePreviewIdx.value = 2
  markDirty()
}

function resetChanges() {
  hydrateEditor(selectedTrip.value)
}

const previewCards = computed(() => {
  if (!selectedTrip.value) return []
  const cleaned = slots.value
    .filter((s) => s.src.trim().length > 0)
    .slice(0, 5)
  return resolveTripGalleryCards(
    {
      judul: selectedTrip.value.judul,
      lokasi: selectedTrip.value.lokasi,
      foto: heroFoto.value,
      detail: {
        elevation: selectedTrip.value.detail?.elevation,
        gallery: cleaned.map((c) => c.src),
        galleryItems: cleaned,
      },
    },
    selectedTripIndex.value,
  )
})

const activePreviewCard = computed(
  () => previewCards.value[activePreviewIdx.value] ?? previewCards.value[2] ?? previewCards.value[0] ?? null,
)

const filledSlotCount = computed(() => slots.value.filter((s) => s.src.trim().length > 0).length)

function savedCountOf(trip: AdminTripRow): number {
  return extractSavedItems(trip).length
}

function statusTone(status: AdminTripRow['statusPublish']): 'good' | 'warn' | 'bad' {
  if (status === 'Published') return 'good'
  if (status === 'Penuh') return 'warn'
  return 'bad'
}

async function publishSelectedTrip() {
  const targetTrip = selectedTrip.value
  if (!targetTrip || publishing.value) return
  feedback.value = null
  publishing.value = true
  try {
    await $fetch(`/api/admin/trips/${targetTrip.id}`, {
      method: 'PUT',
      body: { statusPublish: 'Published' },
    })
    await Promise.all([refresh(), refreshNuxtData()])
    feedback.value = {
      type: 'ok',
      msg: `Status ${targetTrip.judul} diubah ke Published dan sekarang aktif di landing page.`,
    }
  } catch (err: unknown) {
    feedback.value = {
      type: 'err',
      msg: extractErrorMessage(err, 'Gagal mempublikasikan trip.'),
    }
  } finally {
    publishing.value = false
  }
}

async function saveGallery() {
  const targetTrip = selectedTrip.value
  if (!targetTrip) return
  feedback.value = null
  const invalidEmpty = slots.value.some((s) => !s.src.trim())
  if (invalidEmpty) {
    feedback.value = {
      type: 'err',
      msg: 'Setiap slot foto yang ditambahkan harus memiliki gambar, atau hapus slot kosong sebelum menyimpan.',
    }
    return
  }

  saving.value = true
  try {
    const cleanItems = slots.value
      .map((s) => ({
        src: s.src.trim(),
        label: s.label.trim(),
        tag: s.tag.trim(),
      }))
      .filter((s) => s.src.length > 0)
      .slice(0, 5)

    await $fetch(`/api/admin/trips/${targetTrip.id}/gallery`, {
      method: 'PUT',
      body: {
        foto: heroFoto.value,
        galleryItems: cleanItems,
      },
    })

    await Promise.all([refresh(), refreshNuxtData()])
    const refreshedTrip = trips.value.find((t) => t.id === targetTrip.id) ?? null
    hydrateEditor(refreshedTrip)
    feedback.value = {
      type: 'ok',
      msg: `Galeri ${targetTrip.judul} tersimpan dan tersinkron ke landing page.`,
    }
  } catch (err: unknown) {
    feedback.value = {
      type: 'err',
      msg: extractErrorMessage(err, 'Gagal menyimpan galeri dokumentasi trip.'),
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="ed-label" style="color: var(--srf-accent)">
          DATA &amp; PESERTA TRIP
        </p>
        <h1 class="font-serif-display text-2xl font-bold tracking-tight sm:text-3xl">
          Galeri Dokumentasi Trip
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Atur 5 foto dokumentasi, caption, dan tag untuk setiap gunung. Perubahan langsung tampil di Galeri Kipas halaman utama.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink to="/#galeri-trip" target="_blank" class="ed-btn-primary !min-h-[44px] !text-xs">
          Lihat di Landing Page
        </NuxtLink>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="pending && !data" class="ed-card p-6 text-sm" style="color: var(--srf-ink-2)">
      Memuat daftar trip dan galeri dokumentasi...
    </div>

    <!-- Error state -->
    <div
      v-else-if="error && !data"
      class="ed-card flex flex-wrap items-center justify-between gap-3 p-5"
      style="border-color: var(--srf-bad-border)"
    >
      <div class="text-sm font-medium" style="color: var(--srf-bad-ink)">
        Gagal memuat data trip dari server. Periksa koneksi lalu coba lagi.
      </div>
      <button type="button" class="ed-btn-secondary !min-h-[44px] !text-xs" @click="refresh()">
        Coba Lagi
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!trips.length" class="ed-card space-y-3 p-8 text-center">
      <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
        Belum ada jadwal Open Trip
      </h2>
      <p class="mx-auto max-w-md text-sm" style="color: var(--srf-ink-2)">
        Tambahkan minimal satu destinasi trip di menu Data Trip terlebih dahulu untuk mengisi galeri dokumentasinya.
      </p>
      <div class="pt-1">
        <NuxtLink to="/admin/data-trip" class="ed-btn-primary !min-h-[44px] !text-xs">
          Buka Data Trip
        </NuxtLink>
      </div>
    </div>

    <!-- Main Gallery Workspace -->
    <template v-else-if="selectedTrip">
      <!-- Trip Selector Dropdown -->
      <div class="max-w-md space-y-1.5">
        <label for="galeri-trip-select" class="ed-label">PILIH DESTINASI TRIP</label>
        <select
          id="galeri-trip-select"
          v-model.number="selectedTripId"
          class="ed-select !min-h-[44px] text-sm font-medium"
        >
          <option v-for="trip in trips" :key="trip.id" :value="trip.id">
            {{ trip.judul }} ({{ savedCountOf(trip) }}/5 · {{ trip.statusPublish }})
          </option>
        </select>
      </div>

      <!-- Draft Visibility Notice -->
      <div
        v-if="selectedTrip.statusPublish === 'Draft'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-medium"
        style="
          background-color: var(--srf-warn-soft);
          border-color: var(--srf-warn-border);
          color: var(--srf-warn-ink);
        "
      >
        <span>
          Trip ini masih berstatus Draft di database sehingga foto kustomnya belum tampil di landing page.
        </span>
        <button
          type="button"
          class="ed-btn-primary !min-h-[44px] shrink-0 !text-xs"
          :disabled="publishing"
          @click="publishSelectedTrip"
        >
          {{ publishing ? 'Mempublikasikan...' : 'Publikasikan Sekarang' }}
        </button>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <!-- Left Column: Live Landing Preview & Hero Image -->
        <div class="space-y-5 min-w-0 lg:col-span-5">
          <section class="ed-card p-4 space-y-4 sm:p-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="ed-label" style="color: var(--srf-accent)">PRATINJAU LANDING PAGE</p>
                <h2 class="truncate text-base font-semibold" style="color: var(--srf-ink)">
                  {{ selectedTrip.judul }}
                </h2>
              </div>
              <StatusBadge :label="selectedTrip.statusPublish" :tone="statusTone(selectedTrip.statusPublish)" />
            </div>

            <!-- Selected Card Spotlight (matches FanTripGallery card format) -->
            <div
              v-if="activePreviewCard"
              class="relative aspect-[4/3] w-full overflow-hidden rounded-xl border"
              style="border-color: var(--srf-line); background-color: var(--srf-well)"
            >
              <img
                :src="activePreviewCard.src"
                :alt="activePreviewCard.label"
                class="h-full w-full object-cover"
              />
              <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/85 to-transparent p-3.5 pt-8 text-white">
                <div class="mb-1 flex flex-wrap items-center gap-1.5">
                  <span class="rounded bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Kartu {{ activePreviewIdx + 1 }}{{ activePreviewIdx === 2 ? ' (Tengah)' : '' }}
                  </span>
                  <span
                    v-if="activePreviewCard.isPreset"
                    class="rounded bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#111827]"
                  >
                    Preset bawaan
                  </span>
                </div>
                <div class="text-sm font-semibold text-white">
                  {{ activePreviewCard.label }}
                </div>
                <div class="text-xs text-gray-100">
                  {{ activePreviewCard.tag }}
                </div>
              </div>
            </div>

            <!-- 5-Card Strip Selector -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <span class="ed-label">URUTAN 5 KARTU KIPAS</span>
                <span class="text-[11px]" style="color: var(--srf-ink-2)">Klik kartu untuk pratinjau</span>
              </div>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="(card, idx) in previewCards"
                  :key="`prev-${idx}`"
                  type="button"
                  :aria-label="`Pratinjau kartu ${idx + 1}: ${card.label}`"
                  :aria-pressed="activePreviewIdx === idx"
                  class="group relative min-h-[56px] cursor-pointer overflow-hidden rounded-lg border-2 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--srf-accent)]"
                  :style="
                    activePreviewIdx === idx
                      ? { borderColor: 'var(--srf-accent)' }
                      : { borderColor: 'var(--srf-line)' }
                  "
                  @click="activePreviewIdx = idx"
                >
                  <img :src="card.src" :alt="card.label" class="aspect-[4/3] h-full w-full object-cover" />
                  <span
                    class="tabular absolute bottom-1 left-1 rounded px-1 py-0.5 text-[10px] font-bold"
                    style="background-color: rgba(17, 24, 39, 0.85); color: #ffffff"
                  >
                    {{ idx === 2 ? '3*' : idx + 1 }}
                  </span>
                </button>
              </div>
              <p class="mt-2 text-xs" style="color: var(--srf-ink-2)">
                Kartu nomor 3 (3*) tampil di posisi tengah depan saat galeri trip pertama kali dibuka di landing page.
              </p>
            </div>
          </section>

          <section class="ed-card p-4 space-y-3 sm:p-5">
            <div>
              <p class="ed-label">COVER UTAMA TRIP</p>
              <p class="mt-0.5 text-xs" style="color: var(--srf-ink-2)">
                Dipakai pada kartu jadwal Open Trip dan sebagai cadangan foto utama jika slot galeri belum penuh 5 foto.
              </p>
            </div>
            <AdminImageUpload
              :model-value="heroFoto"
              folder="trip"
              label="FOTO UTAMA DESTINASI (MAKS 2MB)"
              fallback-kind="trip"
              @update:model-value="onHeroChange"
            />
          </section>
        </div>

        <!-- Right Column: 5 Documentation Slots Editor -->
        <section class="ed-card p-4 space-y-4 min-w-0 sm:p-5 lg:col-span-7">
          <div class="flex flex-wrap items-center justify-between gap-2.5 border-b pb-3.5" style="border-color: var(--srf-line)">
            <div>
              <p class="ed-label">SLOT DOKUMENTASI FOTO ({{ filledSlotCount }}/5)</p>
              <h2 class="text-base font-semibold" style="color: var(--srf-ink)">
                Daftar Foto &amp; Keterangan
              </h2>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="ed-btn-secondary !min-h-[44px] !text-xs"
                @click="loadLandingPreset"
              >
                Muat 5 Foto Bawaan
              </button>
              <button
                type="button"
                class="ed-btn-primary !min-h-[44px] !text-xs"
                :disabled="slots.length >= 5"
                @click="addSlot"
              >
                + Tambah Slot
              </button>
            </div>
          </div>

          <!-- Empty custom slots state -->
          <div
            v-if="!slots.length"
            class="ed-well space-y-3 p-5 text-sm"
            style="color: var(--srf-ink-2)"
          >
            <div class="font-semibold" style="color: var(--srf-ink)">
              Belum ada foto dokumentasi kustom untuk trip ini.
            </div>
            <p class="text-xs leading-relaxed">
              Saat ini landing page menampilkan foto preset bawaan gunung terkait (bisa dilihat pada Pratinjau di sebelah). Klik "Muat 5 Foto Bawaan" untuk menyunting foto bawaan, atau "+ Tambah Slot" untuk mengunggah foto ekspedisi baru.
            </p>
          </div>

          <!-- Editable Slots List -->
          <div v-else class="space-y-3.5">
            <article
              v-for="(slot, idx) in slots"
              :key="`slot-${idx}`"
              class="ed-well space-y-3 p-3.5 sm:p-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="ed-label" style="color: var(--srf-ink)">
                    FOTO {{ idx + 1 }}
                  </span>
                  <span
                    v-if="idx === 2"
                    class="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                    style="
                      background-color: var(--srf-accent-soft);
                      border-color: var(--srf-accent-border);
                      color: var(--srf-accent-ink);
                    "
                  >
                    Posisi Tengah Kipas
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="ed-btn-secondary !min-h-[44px] !min-w-[44px] !px-2.5 !text-xs"
                    :disabled="idx === 0"
                    :aria-label="`Geser foto ${idx + 1} ke atas`"
                    title="Geser ke atas"
                    @click="moveSlot(idx, -1)"
                  >
                    Naik
                  </button>
                  <button
                    type="button"
                    class="ed-btn-secondary !min-h-[44px] !min-w-[44px] !px-2.5 !text-xs"
                    :disabled="idx === slots.length - 1"
                    :aria-label="`Geser foto ${idx + 1} ke bawah`"
                    title="Geser ke bawah"
                    @click="moveSlot(idx, 1)"
                  >
                    Turun
                  </button>
                  <button
                    type="button"
                    class="ed-btn-secondary !min-h-[44px] !px-3 !text-xs"
                    style="color: var(--srf-bad-ink); border-color: var(--srf-bad-border)"
                    :aria-label="`Hapus foto ${idx + 1}`"
                    @click="removeSlot(idx)"
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <AdminImageUpload
                :model-value="slot.src || null"
                folder="trip"
                label="GAMBAR DOKUMENTASI (JPG / PNG / WEBP · MAKS 2MB)"
                fallback-kind="trip"
                @update:model-value="(val) => onSlotSrcChange(idx, val)"
              />

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div class="space-y-1">
                  <label :for="`gal-label-${idx}`" class="ed-label">
                    CAPTION / JUDUL FOTO
                  </label>
                  <input
                    :id="`gal-label-${idx}`"
                    v-model="slot.label"
                    type="text"
                    maxlength="120"
                    class="ed-input !min-h-[44px] !text-xs"
                    :placeholder="`cth: Sunrise Puncak ${selectedTrip.judul}`"
                    @input="markDirty"
                  />
                </div>
                <div class="space-y-1">
                  <label :for="`gal-tag-${idx}`" class="ed-label">
                    TAG SINGKAT
                  </label>
                  <input
                    :id="`gal-tag-${idx}`"
                    v-model="slot.tag"
                    type="text"
                    maxlength="60"
                    class="ed-input !min-h-[44px] !text-xs"
                    :placeholder="`cth: ${selectedTrip.detail?.elevation || selectedTrip.lokasi}`"
                    @input="markDirty"
                  />
                </div>
              </div>
            </article>
          </div>

          <!-- Feedback & Save Footer -->
          <div
            v-if="feedback"
            role="status"
            class="rounded-xl border px-4 py-2.5 text-xs font-semibold"
            :style="
              feedback.type === 'ok'
                ? {
                    backgroundColor: 'var(--srf-good-soft)',
                    borderColor: 'var(--srf-good-border)',
                    color: 'var(--srf-good-ink)',
                  }
                : {
                    backgroundColor: 'var(--srf-bad-soft)',
                    borderColor: 'var(--srf-bad-border)',
                    color: 'var(--srf-bad-ink)',
                  }
            "
          >
            {{ feedback.msg }}
          </div>

          <div
            class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
            style="border-color: var(--srf-line)"
          >
            <div class="text-xs font-medium" style="color: var(--srf-ink-2)">
              {{ dirty ? 'Ada perubahan yang belum disimpan ke database.' : 'Semua perubahan sudah tersinkron.' }}
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              <button
                v-if="dirty"
                type="button"
                class="ed-btn-secondary !min-h-[44px] !text-xs"
                :disabled="saving"
                @click="resetChanges"
              >
                Batalkan
              </button>
              <button
                type="button"
                class="ed-btn-primary !min-h-[44px] !text-xs"
                :disabled="saving"
                @click="saveGallery"
              >
                {{ saving ? 'Menyimpan...' : 'Simpan Galeri ke Landing Page' }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
