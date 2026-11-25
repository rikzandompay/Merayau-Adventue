<script setup lang="ts">
const route = useRoute()
const cart = usePublicCart()
const pageRoot = ref<HTMLElement | null>(null)
useScrollReveal(pageRoot)

const { data, pending, error, refresh } = await useFetch('/api/public/landing')

useHead({
  title: 'Katalog Sewa Alat Gunung · Merayau Adventure Pontianak',
  meta: [
    {
      name: 'description',
      content:
        'Cari dan hitung estimasi sewa tenda, carrier, sepatu gunung, alat masak, dan paket bundel Merayau Adventure Pontianak.',
    },
  ],
})

onMounted(() => {
  cart.initClientCart()
  if (data.value) {
    cart.setCatalogPromos(data.value.promos ?? [])
    cart.syncCatalogPrices(data.value.alat ?? [], data.value.packages ?? [])
  }
})

watch(
  data,
  (val) => {
    if (!val) return
    cart.setCatalogPromos(val.promos ?? [])
    if (import.meta.client) {
      cart.syncCatalogPrices(val.alat ?? [], val.packages ?? [])
    }
  },
  { immediate: true },
)

const searchQuery = ref('')
const selectedCategory = ref(String(route.query.kategori || 'Semua'))
const onlyAvailable = ref(false)
const onlyPromo = ref(false)

watch(
  () => route.query.kategori,
  (val) => {
    selectedCategory.value = val ? String(val) : 'Semua'
  },
)

const categories = computed(() => data.value?.categories ?? [])
const packages = computed(() => data.value?.packages ?? [])
const aturan = computed(
  () =>
    data.value?.aturan ?? {
      durasiMinimalJam: 24,
      toleransiTelatJam: 2,
      dendaPersenHarian: 30,
      minHariPromo: 3,
      diskonPersen: 10,
    },
)
const kontak = computed(
  () =>
    data.value?.kontak ?? {
      whatsapp: '6285156549003',
      whatsappDisplay: '+62 851-5654-9003',
      email: 'admin@merayau.id',
      alamat:
        'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b (gang tepat di samping Mr. DIY Tanray 2), Pontianak, Kalimantan Barat',
      alamatSingkat: 'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b, Pontianak',
      mapsUrl:
        'https://www.google.com/maps/search/?api=1&query=Jl.+Tanjung+Raya+2+Gg.+Nusa+Abadi+No.+22b+Pontianak',
      jamBuka: 'Setiap Hari · 08.00 - 21.00 WIB',
    },
)

const promoAlatCount = computed(
  () => (data.value?.alat ?? []).filter((a) => Boolean(a.promoAktif)).length,
)

const filteredAlat = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = data.value?.alat ?? []
  return list.filter((item) => {
    if (selectedCategory.value !== 'Semua' && item.namaKategori !== selectedCategory.value) {
      return false
    }
    if (onlyAvailable.value && item.stokTersedia <= 0) {
      return false
    }
    if (onlyPromo.value && !item.promoAktif) {
      return false
    }
    if (q) {
      const hay = `${item.namaAlat} ${item.kodeAlat} ${item.namaKategori} ${item.spesifikasi}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
})

const estimate = computed(() => cart.computeEstimate(aturan.value, data.value?.promos))
const cartWaUrl = computed(() => cart.buildCartWaUrl(kontak.value.whatsapp, aturan.value, data.value?.promos))

function resetFilters() {
  searchQuery.value = ''
  selectedCategory.value = 'Semua'
  onlyAvailable.value = false
  onlyPromo.value = false
}
</script>

<template>
  <div ref="pageRoot" class="mry-public min-h-screen bg-[#FDFCFA] text-[#121613]">
    <PublicNavbar :total-alat="data?.stats?.totalAlatAktif ?? 58" :whatsapp="kontak.whatsapp" />

    <main class="mx-auto max-w-[1280px] overflow-x-clip px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
      <!-- Page Header -->
      <div data-reveal class="border-b border-[#EAE5DA] pb-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
              03 · Katalog Sewa Alat Live Basecamp Pontianak
            </p>
            <h1 class="mry-serif mt-2 text-3xl font-semibold text-[#121613] sm:text-4xl">
              Katalog Perlengkapan Gunung
            </h1>
            <p class="mt-2 max-w-2xl text-sm text-[#2E3530]">
              Tarif dasar per {{ aturan.durasiMinimalJam }} jam. Sewa minimal {{ aturan.minHariPromo }} hari otomatis
              mendapat diskon {{ aturan.diskonPersen }}% pada daftar sewa.
            </p>
          </div>
          <NuxtLink to="/"
            class="inline-flex min-h-[42px] items-center rounded-full border border-[#D6D0C4] bg-white px-4 text-xs font-semibold text-[#121613] hover:bg-[#F5F2EB]">
            ← Kembali ke Beranda
          </NuxtLink>
        </div>

        <!-- Search & Category Pills -->
        <div class="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="relative flex-1 lg:max-w-md">
            <input v-model="searchQuery" type="search"
              placeholder="Cari nama alat, kode (mis. TND-01), atau kapasitas..."
              class="min-h-[46px] w-full rounded-full border border-[#D6D0C4] bg-white pr-4 pl-11 text-sm text-[#121613]"
              aria-label="Cari perlengkapan di katalog" />
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#5C645E]" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <label
              class="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#D6D0C4] bg-white px-4 text-xs font-semibold text-[#121613]">
              <input v-model="onlyAvailable" type="checkbox" class="h-4 w-4 accent-[#1E4D36]" />
              <span>Hanya Stok Tersedia</span>
            </label>
            <label
              v-if="promoAlatCount > 0"
              class="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full border border-[#1E4D36]/40 bg-[#E6F0EA]/60 px-4 text-xs font-semibold text-[#1E4D36]">
              <input v-model="onlyPromo" type="checkbox" class="h-4 w-4 accent-[#1E4D36]" />
              <span>Sedang Promo ({{ promoAlatCount }})</span>
            </label>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button"
            class="mry-mono min-h-[40px] cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors"
            :class="selectedCategory === 'Semua'
              ? 'border-[#1E4D36] bg-[#1E4D36] text-white'
              : 'border-[#D6D0C4] bg-white text-[#2E3530] hover:bg-[#F5F2EB]'
              " @click="selectedCategory = 'Semua'">
            Semua ({{ data?.alat?.length ?? 0 }})
          </button>
          <button v-for="cat in categories" :key="cat.id" type="button"
            class="mry-mono min-h-[40px] cursor-pointer rounded-full border px-4 text-xs font-semibold transition-colors"
            :class="selectedCategory === cat.namaKategori
              ? 'border-[#1E4D36] bg-[#1E4D36] text-white'
              : 'border-[#D6D0C4] bg-white text-[#2E3530] hover:bg-[#F5F2EB]'
              " @click="selectedCategory = cat.namaKategori">
            {{ cat.namaKategori }} ({{ cat.jumlahAlat }})
          </button>
        </div>
      </div>

      <!-- Error / Loading -->
      <div v-if="error && !data" class="my-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <div class="font-semibold text-red-800">Gagal memuat katalog alat</div>
        <button type="button"
          class="mt-3 min-h-[42px] cursor-pointer rounded-full bg-[#1E4D36] px-5 text-xs font-semibold text-white"
          @click="refresh()">
          Coba Lagi
        </button>
      </div>

      <div class="mt-8 grid items-start gap-8 lg:grid-cols-12">
        <!-- Left Catalog Items + Bundel Strip -->
        <div class="space-y-8 lg:col-span-8">
          <!-- Paket & Item Bundle Quick Strip -->
          <div v-if="packages.length" class="space-y-3">
            <div
              v-for="pkg in packages"
              :key="`strip-${pkg.id}`"
              data-reveal-scale
              style="--reveal-delay: 80ms"
              class="rounded-2xl border border-[#1E4D36]/25 bg-[#121613] p-5 text-white"
            >
              <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="mry-mono text-[11px] font-semibold text-[#93B47E] uppercase">
                      {{ pkg.tipePaket === 'bundle' ? 'Item Bundle Promo' : 'Paket Bundel Siap Berangkat' }}
                    </span>
                    <span
                      v-if="pkg.promoAktif?.label || (pkg.tipePaket === 'bundle' && pkg.labelPromo)"
                      class="mry-mono rounded-full bg-[#93B47E] px-2.5 py-0.5 text-[10px] font-bold text-[#121613]"
                    >
                      {{ pkg.promoAktif?.label || pkg.labelPromo }}
                    </span>
                    <span
                      v-else-if="pkg.upcomingPromo"
                      class="mry-mono rounded-full border border-[#93B47E]/50 bg-[#93B47E]/15 px-2.5 py-0.5 text-[10px] font-semibold text-[#93B47E]"
                    >
                      Promo {{ pkg.upcomingPromo.namaPromo }} ({{ pkg.upcomingPromo.label }}) · {{ formatPromoDateRangeId(pkg.upcomingPromo.tanggalMulai, pkg.upcomingPromo.tanggalSelesai) }}
                    </span>
                  </div>
                  <div class="mry-serif mt-0.5 text-xl font-semibold">{{ pkg.namaPaket }}</div>
                  <div class="mt-0.5 text-xs text-[#D6D0C4]">
                    {{ pkg.items.map((it) => `${it.jumlah}x ${it.namaAlat}`).join(' · ') }}
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-3">
                  <div class="text-right">
                    <div
                      v-if="pkg.hargaEfektif < (pkg.tipePaket === 'bundle' ? pkg.totalNormal : pkg.tarifPaket)"
                      class="mry-mono text-xs text-[#D6D0C4] line-through"
                    >
                      {{ formatRupiah(pkg.tipePaket === 'bundle' ? pkg.totalNormal : pkg.tarifPaket) }}
                    </div>
                    <div class="mry-mono text-base font-bold text-[#93B47E]">
                      {{ formatRupiah(pkg.hargaEfektif ?? pkg.tarifPaket) }} / 24j
                    </div>
                  </div>
                  <button type="button"
                    class="min-h-[42px] cursor-pointer rounded-full bg-[#93B47E] px-4 text-xs font-bold text-[#121613] hover:bg-[#A6C493]"
                    :disabled="pkg.kuotaTersedia <= 0"
                    @click="cart.addPaket(pkg, false)">
                    {{ pkg.tipePaket === 'bundle' ? '+ Bundle' : '+ Paket' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Loading Skeleton -->
          <div v-if="pending && !data" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div v-for="n in 6" :key="n" class="h-72 animate-pulse rounded-2xl bg-[#EAE5DA]" />
          </div>

          <!-- Empty Filter State -->
          <div v-else-if="!filteredAlat.length"
            class="rounded-2xl border border-dashed border-[#D6D0C4] bg-white p-10 text-center">
            <div class="text-base font-semibold text-[#121613]">Perlengkapan tidak ditemukan</div>
            <p class="mt-1 text-sm text-[#5C645E]">
              Coba kata kunci lain atau ubah filter kategori di atas.
            </p>
            <button type="button"
              class="mt-4 min-h-[42px] cursor-pointer rounded-full bg-[#1E4D36] px-5 text-xs font-semibold text-white"
              @click="resetFilters">
              Reset Filter
            </button>
          </div>

          <!-- Active Grid -->
          <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article v-for="(item, idx) in filteredAlat" :key="item.id"
              data-reveal
              :style="`--reveal-delay: ${(idx % 3) * 80}ms`"
              class="flex flex-col justify-between rounded-2xl border border-[#D6D0C4] bg-white p-4 shadow-xs transition-shadow hover:border-[#1E4D36] hover:shadow-md">
              <div>
                <div class="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#EAE5DA] bg-[#F5F2EB]">
                  <img v-if="item.fotoUrl" :src="item.fotoUrl" :alt="item.namaAlat" loading="lazy"
                    class="h-full w-full object-cover" />
                  <div v-else class="flex h-full w-full items-center justify-center p-8">
                    <GearArtThumb :kind="item.namaKategori" />
                  </div>
                  <span
                    class="mry-mono absolute top-2 left-2 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-[#121613]">
                    {{ item.namaKategori }}
                  </span>
                  <span class="mry-mono absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    :class="item.stokTersedia > 0 ? 'bg-[#E6F0EA] text-[#1E4D36]' : 'bg-red-100 text-red-700'">
                    Stok {{ item.stokTersedia }}/{{ item.stokTotal }}
                  </span>
                  <span
                    v-if="item.promoAktif"
                    class="mry-mono absolute bottom-2 left-2 rounded-full bg-[#1E4D36] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs"
                  >
                    {{ item.promoAktif.label }}
                  </span>
                </div>

                <div class="mt-3">
                  <div class="mry-mono text-[11px] text-[#5C645E]">{{ item.kodeAlat }}</div>
                  <h2 class="mt-0.5 text-sm font-bold text-[#121613]">{{ item.namaAlat }}</h2>
                  <p v-if="item.spesifikasi" class="mt-1 line-clamp-2 text-xs leading-relaxed text-[#5C645E]">
                    {{ item.spesifikasi }}
                  </p>
                </div>
              </div>

              <div class="mt-4 flex items-center justify-between gap-2 border-t border-[#EAE5DA] pt-3">
                <div>
                  <div
                    v-if="item.promoAktif && item.hargaEfektif < item.hargaHarian"
                    class="mry-mono text-[11px] text-[#5C645E] line-through"
                  >
                    {{ formatRupiah(item.hargaHarian) }}
                  </div>
                  <div class="mry-mono text-sm font-bold text-[#1E4D36]">
                    {{ formatRupiah(item.hargaEfektif ?? item.hargaHarian) }}
                  </div>
                  <div class="text-[11px] text-[#5C645E]">per 24 jam</div>
                </div>

                <div v-if="cart.getAlatQty(item.id) > 0" class="flex items-center gap-1.5">
                  <button type="button"
                    class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#D6D0C4] bg-[#FDFCFA] text-sm font-bold text-[#121613]"
                    aria-label="Kurangi jumlah" @click="cart.setAlatQty(item.id, cart.getAlatQty(item.id) - 1)">
                    -
                  </button>
                  <span class="mry-mono w-6 text-center text-xs font-bold text-[#121613]">
                    {{ cart.getAlatQty(item.id) }}
                  </span>
                  <button type="button"
                    class="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-[#1E4D36] bg-[#1E4D36] text-sm font-bold text-white"
                    aria-label="Tambah jumlah" :disabled="cart.getAlatQty(item.id) >= item.stokTersedia"
                    @click="cart.addAlat(item, false)">
                    +
                  </button>
                </div>

                <button v-else type="button" :disabled="item.stokTersedia <= 0"
                  class="min-h-[38px] cursor-pointer rounded-full bg-[#121613] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#1E4D36] disabled:cursor-not-allowed disabled:opacity-45"
                  @click="cart.addAlat(item, false)">
                  {{ item.stokTersedia > 0 ? '+ Sewa' : 'Habis' }}
                </button>
              </div>
            </article>
          </div>
        </div>

        <!-- Right Sticky Daftar Sewa Kamu Estimator (Desktop) -->
        <aside class="lg:sticky lg:top-24 lg:col-span-4">
          <div class="rounded-2xl border border-[#D6D0C4] bg-white p-5 shadow-xs">
            <div class="flex items-center justify-between border-b border-[#EAE5DA] pb-3.5">
              <div>
                <div class="mry-mono text-[10px] font-semibold tracking-wider text-[#1E4D36] uppercase">
                  Nota Estimasi Sewa
                </div>
                <h2 class="mry-serif text-xl font-semibold text-[#121613]">Daftar Sewa Kamu</h2>
              </div>
              <span class="mry-mono rounded-full bg-[#E6F0EA] px-3 py-1 text-xs font-semibold text-[#1E4D36]">
                {{ cart.totalCount.value }} item
              </span>
            </div>

            <div class="mt-4 space-y-3">
              <div class="flex items-center justify-between text-xs font-semibold text-[#121613]">
                <span>Jadwal Sewa</span>
                <span v-if="estimate.isPromoEligible" class="mry-mono text-[#1E4D36]">
                  Promo -{{ estimate.diskonPersen }}% Aktif
                </span>
              </div>

              <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label class="mb-1 block text-xs font-medium text-[#5C645E]">Tanggal Ambil</label>
                  <input :value="cart.tanggalAmbil.value" type="date" :min="cart.minTanggalAmbil.value"
                    class="min-h-[40px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3 text-sm text-[#121613]"
                    @input="cart.setTanggal(($event.target as HTMLInputElement).value)" />
                </div>
                <div>
                  <label class="mb-1 block text-xs font-medium text-[#5C645E]">Tanggal Kembali</label>
                  <input :value="cart.tanggalKembali.value" type="date" :min="cart.minTanggalKembali.value"
                    class="min-h-[40px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3 text-sm text-[#121613]"
                    @input="cart.setTanggalKembali(($event.target as HTMLInputElement).value)" />
                </div>
              </div>

              <div class="flex items-center justify-between rounded-xl bg-[#F5F2EB] px-3 py-2 text-xs">
                <span class="text-[#5C645E]">Total Durasi</span>
                <span class="mry-mono font-semibold text-[#121613]">
                  {{ estimate.days }} hari ({{ estimate.days * 24 }} jam)
                </span>
              </div>
            </div>

            <div v-if="cart.totalCount.value === 0"
              class="mt-5 rounded-xl border border-dashed border-[#D6D0C4] bg-[#FDFCFA] p-6 text-center text-xs text-[#5C645E]">
              Klik tombol <span class="font-semibold text-[#121613]">+ Sewa</span> pada alat atau paket untuk menghitung
              total biaya sewa.
            </div>

            <div v-else class="mt-5 space-y-2.5">
              <div v-for="pkg in cart.paketItems.value" :key="`s-pkg-${pkg.id}`"
                class="flex items-center justify-between gap-2 rounded-xl bg-[#E6F0EA]/55 px-3 py-2 text-xs">
                <div class="min-w-0">
                  <div class="truncate font-semibold text-[#121613]">{{ pkg.namaPaket }}</div>
                  <div class="mry-mono text-[#1E4D36]">{{ pkg.qty }}x · {{ formatRupiah(pkg.tarifPaket) }}/24j</div>
                </div>
                <button type="button" class="cursor-pointer text-[11px] font-semibold text-red-700 hover:underline"
                  @click="cart.setPaketQty(pkg.id, 0)">
                  Hapus
                </button>
              </div>

              <div v-for="it in cart.alatItems.value" :key="`s-alat-${it.id}`"
                class="flex items-center justify-between gap-2 rounded-xl border border-[#EAE5DA] px-3 py-2 text-xs">
                <div class="min-w-0">
                  <div class="truncate font-semibold text-[#121613]">{{ it.namaAlat }}</div>
                  <div class="mry-mono text-[#5C645E]">{{ it.qty }}x · {{ formatRupiah(it.hargaHarian) }}/24j</div>
                </div>
                <button type="button" class="cursor-pointer text-[11px] font-semibold text-red-700 hover:underline"
                  @click="cart.setAlatQty(it.id, 0)">
                  Hapus
                </button>
              </div>

              <div v-if="estimate.upcomingItemPromos.length" class="mt-4 rounded-xl border border-[#1E4D36]/25 bg-[#E6F0EA]/60 p-3 text-xs text-[#1E4D36]">
                <div class="font-semibold">Promo Terjadwal Tersedia</div>
                <p v-for="up in estimate.upcomingItemPromos" :key="`side-up-${up.namaPromo}`" class="mt-1 leading-relaxed">
                  <span class="font-semibold">{{ up.namaPromo }} ({{ up.label }})</span> berlaku {{ formatPromoDateRangeId(up.tanggalMulai, up.tanggalSelesai) }}.
                </p>
              </div>

              <div class="space-y-1.5 border-t border-[#EAE5DA] pt-3 text-xs">
                <div class="flex justify-between text-[#5C645E]">
                  <span>Subtotal ({{ estimate.days }} hari)</span>
                  <span class="mry-mono text-[#121613]">
                    {{ formatRupiah(estimate.subtotalAlat + estimate.subtotalPaket) }}
                  </span>
                </div>
                <div
                  v-for="p in estimate.appliedItemPromos"
                  :key="`side-promo-${p.namaPromo}`"
                  class="flex justify-between font-medium text-[#1E4D36]"
                >
                  <span>{{ p.namaPromo }} ({{ p.label }})</span>
                  <span class="mry-mono">-{{ formatRupiah(p.nominal) }}</span>
                </div>
                <div v-if="estimate.diskonPromoNominal > 0" class="flex justify-between font-medium text-[#1E4D36]">
                  <span>Diskon &gt;= {{ estimate.minPromo }}H (-{{ estimate.diskonPersen }}%)</span>
                  <span class="mry-mono">-{{ formatRupiah(estimate.diskonPromoNominal) }}</span>
                </div>
                <div class="flex justify-between pt-1 text-sm font-bold text-[#121613]">
                  <span>Total Estimasi</span>
                  <span class="mry-mono text-base text-[#1E4D36]">{{ formatRupiah(estimate.grandTotal) }}</span>
                </div>
              </div>

              <a :href="cartWaUrl" target="_blank" rel="noopener noreferrer"
                class="mt-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#1E4D36] px-5 text-sm font-semibold text-white hover:bg-[#163B29]">
                <WaIcon :size="16" />
                <span>Pesan Sekarang via WhatsApp</span>
              </a>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <PublicFooter :total-alat="data?.stats?.totalAlatAktif ?? 58" :whatsapp="kontak.whatsapp"
      :whatsapp-display="kontak.whatsappDisplay" :email="kontak.email" :alamat="kontak.alamat"
      :maps-url="kontak.mapsUrl" />

    <PublicRentalCartDrawer :aturan="aturan" :whatsapp="kontak.whatsapp" :promos="data?.promos" />
  </div>
</template>
