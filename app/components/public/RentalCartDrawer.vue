<script setup lang="ts">
const props = defineProps<{
  aturan?: Partial<PublicAturan> | null
  whatsapp: string
  promos?: PublicPromoRule[] | null
}>()

const cart = usePublicCart()

const estimate = computed(() => cart.computeEstimate(props.aturan, props.promos))
const waUrl = computed(() => cart.buildCartWaUrl(props.whatsapp, props.aturan, props.promos))

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && cart.drawerOpen.value) {
    cart.drawerOpen.value = false
  }
}

onMounted(() => {
  cart.initClientCart()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="mry-drawer">
      <div
        v-if="cart.drawerOpen.value"
        class="mry-public fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-label="Daftar Sewa Kamu"
        @click.self="cart.drawerOpen.value = false"
      >
        <div class="mry-drawer-panel flex h-full w-full max-w-md flex-col border-l border-[#D6D0C4] bg-[#FDFCFA] shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#EAE5DA] bg-white px-5 py-4">
          <div>
            <div class="mry-mono text-[11px] font-semibold tracking-[0.12em] text-[#1E4D36] uppercase">
              Nota Estimasi Sewa
            </div>
            <h3 class="mry-serif text-xl font-semibold text-[#121613]">
              Daftar Sewa Kamu
            </h3>
          </div>
          <button
            type="button"
            class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] hover:bg-[#F5F2EB]"
            aria-label="Tutup daftar sewa"
            @click="cart.drawerOpen.value = false"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="flex-1 space-y-5 overflow-y-auto p-5">
          <div class="rounded-xl border border-[#EAE5DA] bg-white p-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-[#121613]">Jadwal Sewa (per 24 jam)</span>
              <span
                v-if="estimate.isPromoEligible"
                class="mry-mono rounded-full bg-[#E6F0EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E4D36]"
              >
                Diskon {{ estimate.diskonPersen }}% Aktif
              </span>
            </div>

            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-medium text-[#5C645E]">
                  Rencana Tanggal Ambil
                </label>
                <input
                  :value="cart.tanggalAmbil.value"
                  type="date"
                  :min="cart.minTanggalAmbil.value"
                  class="min-h-[42px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3 text-sm text-[#121613]"
                  @input="cart.setTanggal(($event.target as HTMLInputElement).value)"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-[#5C645E]">
                  Rencana Tanggal Kembali
                </label>
                <input
                  :value="cart.tanggalKembali.value"
                  type="date"
                  :min="cart.minTanggalKembali.value"
                  class="min-h-[42px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3 text-sm text-[#121613]"
                  @input="cart.setTanggalKembali(($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between rounded-xl bg-[#F5F2EB] px-3 py-2 text-xs">
              <span class="text-[#5C645E]">Total Durasi</span>
              <span class="mry-mono font-semibold text-[#121613]">
                {{ estimate.days }} hari ({{ estimate.days * 24 }} jam)
              </span>
            </div>
          </div>

          <div v-if="estimate.upcomingItemPromos.length" class="rounded-xl border border-[#1E4D36]/25 bg-[#E6F0EA]/60 p-3 text-xs text-[#1E4D36]">
            <div class="font-semibold">Promo Terjadwal Tersedia</div>
            <p v-for="up in estimate.upcomingItemPromos" :key="up.namaPromo" class="mt-1 leading-relaxed">
              <span class="font-semibold">{{ up.namaPromo }} ({{ up.label }})</span> berlaku {{ formatPromoDateRangeId(up.tanggalMulai, up.tanggalSelesai) }}. Pilih tanggal sewa di rentang tersebut agar diskon aktif otomatis.
            </p>
          </div>

          <div v-if="cart.totalCount.value === 0" class="rounded-2xl border border-dashed border-[#D6D0C4] bg-white p-8 text-center">
            <div class="text-sm font-semibold text-[#121613]">Daftar sewa masih kosong</div>
            <p class="mt-1.5 text-xs leading-relaxed text-[#5C645E]">
              Pilih perlengkapan dari Katalog Alat atau Paket Bundel Tektok untuk menghitung estimasi biaya sewa otomatis.
            </p>
            <NuxtLink
              to="/katalog"
              class="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-[#1E4D36] px-5 text-xs font-semibold text-white hover:bg-[#163B29]"
              @click="cart.drawerOpen.value = false"
            >
              Buka Katalog Lengkap →
            </NuxtLink>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="pkg in cart.paketItems.value"
              :key="`pkg-${pkg.id}`"
              class="rounded-xl border border-[#1E4D36]/30 bg-[#E6F0EA]/40 p-3.5"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <span class="mry-mono text-[10px] font-semibold text-[#1E4D36] uppercase">
                    {{ pkg.tipePaket === 'bundle' ? 'Item Bundle' : 'Paket Bundel' }}
                  </span>
                  <div class="text-sm font-semibold text-[#121613]">{{ pkg.namaPaket }}</div>
                  <div class="mt-0.5 text-xs text-[#5C645E]">{{ pkg.ringkasanIsi }}</div>
                  <div class="mry-mono mt-1.5 text-xs font-semibold text-[#1E4D36]">
                    {{ formatRupiah(pkg.tarifPaket) }} / 24 jam
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#D6D0C4] bg-white text-sm font-bold text-[#121613]"
                    aria-label="Kurangi jumlah paket"
                    @click="cart.setPaketQty(pkg.id, pkg.qty - 1)"
                  >
                    -
                  </button>
                  <span class="mry-mono w-6 text-center text-xs font-semibold text-[#121613]">{{ pkg.qty }}</span>
                  <button
                    type="button"
                    class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#D6D0C4] bg-white text-sm font-bold text-[#121613]"
                    aria-label="Tambah jumlah paket"
                    @click="cart.setPaketQty(pkg.id, pkg.qty + 1)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div
              v-for="item in cart.alatItems.value"
              :key="`alat-${item.id}`"
              class="flex items-center justify-between gap-3 rounded-xl border border-[#EAE5DA] bg-white p-3.5"
            >
              <div class="min-w-0">
                <div class="mry-mono text-[10px] text-[#5C645E]">{{ item.kodeAlat }} · {{ item.namaKategori }}</div>
                <div class="truncate text-sm font-semibold text-[#121613]">{{ item.namaAlat }}</div>
                <div class="mry-mono mt-0.5 text-xs font-semibold text-[#1E4D36]">
                  {{ formatRupiah(item.hargaHarian) }} / 24 jam
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#D6D0C4] bg-[#FDFCFA] text-sm font-bold text-[#121613]"
                  aria-label="Kurangi unit"
                  @click="cart.setAlatQty(item.id, item.qty - 1)"
                >
                  -
                </button>
                <span class="mry-mono w-6 text-center text-xs font-semibold text-[#121613]">{{ item.qty }}</span>
                <button
                  type="button"
                  class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-[#D6D0C4] bg-[#FDFCFA] text-sm font-bold text-[#121613]"
                  aria-label="Tambah unit"
                  @click="cart.setAlatQty(item.id, item.qty + 1)"
                >
                  +
                </button>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                type="button"
                class="min-h-[40px] cursor-pointer px-2 text-xs font-medium text-[#C2410C] hover:underline"
                @click="cart.clearCart()"
              >
                Kosongkan Daftar Sewa
              </button>
            </div>
          </div>
        </div>

        <div class="border-t border-[#EAE5DA] bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between text-[#5C645E]">
              <span>Subtotal ({{ estimate.days }} hari)</span>
              <span class="mry-mono text-[#121613]">{{ formatRupiah(estimate.subtotalAlat + estimate.subtotalPaket) }}</span>
            </div>
            <div
              v-for="p in estimate.appliedItemPromos"
              :key="`drawer-promo-${p.namaPromo}`"
              class="flex justify-between font-medium text-[#1E4D36]"
            >
              <span>{{ p.namaPromo }} ({{ p.label }})</span>
              <span class="mry-mono">-{{ formatRupiah(p.nominal) }}</span>
            </div>
            <div v-if="estimate.diskonPromoNominal > 0" class="flex justify-between font-medium text-[#1E4D36]">
              <span>Diskon sewa &gt;= {{ estimate.minPromo }} hari (-{{ estimate.diskonPersen }}%)</span>
              <span class="mry-mono">-{{ formatRupiah(estimate.diskonPromoNominal) }}</span>
            </div>
            <div class="flex justify-between border-t border-[#EAE5DA] pt-2 text-sm font-bold text-[#121613]">
              <span>Estimasi Total</span>
              <span class="mry-mono text-base text-[#1E4D36]">{{ formatRupiah(estimate.grandTotal) }}</span>
            </div>
          </div>

          <a
            v-if="cart.totalCount.value > 0"
            :href="waUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#1E4D36] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#163B29]"
          >
            <WaIcon :size="16" />
            <span>Kirim Daftar Sewa via WhatsApp</span>
          </a>
        </div>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>

