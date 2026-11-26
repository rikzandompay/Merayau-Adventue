<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    aturan?: Partial<PublicAturan> | null
    whatsapp: string
    promos?: PublicPromoRule[] | null
    bottomOffsetMode?: 'default' | 'cart-always' | 'cart-mobile' | 'trip-bar'
    hideWhenTripBarVisible?: boolean
  }>(),
  {
    aturan: null,
    promos: null,
    bottomOffsetMode: 'default',
    hideWhenTripBarVisible: false,
  },
)

const cart = usePublicCart()
const chat = useMerayauChatbot()

const draftText = ref('')
const scrollBoxRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const triggerBtnRef = ref<HTMLButtonElement | null>(null)

const estimate = computed(() => cart.computeEstimate(props.aturan, props.promos))
const waCartUrl = computed(() => cart.buildCartWaUrl(props.whatsapp, props.aturan, props.promos))
const waFallbackUrl = computed(() =>
  buildWaLink(
    props.whatsapp,
    'Halo Admin Merayau Adventure Pontianak, saya ingin tanya stok dan pesan perlengkapan.',
  ),
)

const hasUserMessages = computed(() => chat.messages.value.some((m) => m.role === 'user'))

const triggerBottomClass = computed(() => {
  if (props.bottomOffsetMode === 'cart-always' && cart.totalCount.value > 0) {
    return 'bottom-[76px]'
  }
  if (props.bottomOffsetMode === 'cart-mobile' && cart.totalCount.value > 0) {
    return 'bottom-[76px] lg:bottom-4'
  }
  if (props.bottomOffsetMode === 'trip-bar' && props.hideWhenTripBarVisible) {
    return 'bottom-[88px] lg:bottom-4'
  }
  return 'bottom-4'
})

function buildCartSummaryPayload(): ChatbotCartSummary {
  return {
    alatCount: cart.alatItems.value.reduce((s, x) => s + x.qty, 0),
    paketCount: cart.paketItems.value.reduce((s, p) => s + p.qty, 0),
    durasiHari: estimate.value.days,
    grandTotal: estimate.value.grandTotal,
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = scrollBoxRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

async function handleSend(textOverride?: string) {
  const msg = (textOverride ?? draftText.value).trim()
  if (!msg || chat.isLoading.value) return
  if (!textOverride) {
    draftText.value = ''
  }
  await chat.sendMessage(msg, buildCartSummaryPayload())
  scrollToBottom()
}

function handleAddAlat(card: ChatbotAlatCard) {
  cart.addAlat(
    {
      id: card.id,
      idKategori: card.idKategori,
      kodeAlat: card.kodeAlat,
      namaAlat: card.namaAlat,
      namaKategori: card.namaKategori,
      hargaHarian: card.hargaHarian,
      stokTersedia: card.stokTersedia,
      fotoUrl: card.fotoUrl,
    },
    false,
  )
}

function handleAddPaket(pkg: ChatbotPaketCard) {
  cart.addPaket(
    {
      id: pkg.id,
      namaPaket: pkg.namaPaket,
      tipePaket: pkg.tipePaket,
      tarifPaket: pkg.tarifPaket,
      kuotaTersedia: pkg.kuotaTersedia,
      items: pkg.items,
    },
    false,
  )
}

function getPaketCartQty(id: number): number {
  return cart.paketItems.value.find((p) => p.id === id)?.qty ?? 0
}

function handleOpenCartFromChat() {
  if (import.meta.client && window.innerWidth < 640) {
    chat.closeChat()
  }
  cart.drawerOpen.value = true
}

function handleClosePanel() {
  chat.closeChat()
  nextTick(() => {
    triggerBtnRef.value?.focus()
  })
}

function handleInputFocus() {
  nextTick(() => {
    inputRef.value?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && chat.isOpen.value && !cart.drawerOpen.value) {
    handleClosePanel()
  }
}

watch(
  () => chat.isOpen.value,
  (open) => {
    if (open) {
      scrollToBottom()
      if (import.meta.client && window.innerWidth >= 640) {
        nextTick(() => {
          inputRef.value?.focus()
        })
      }
    }
  },
)

watch(
  () => [chat.messages.value.length, chat.isLoading.value, chat.errorMessage.value],
  () => {
    if (chat.isOpen.value) {
      scrollToBottom()
    }
  },
)

onMounted(() => {
  cart.initClientCart()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div>
    <!-- Trigger Button -->
    <button
      v-if="!chat.isOpen.value && !cart.drawerOpen.value"
      ref="triggerBtnRef"
      type="button"
      :class="[
        'fixed right-4 z-[48] inline-flex min-h-[48px] max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-2.5 rounded-xl border border-[#163B29] bg-[#1E4D36] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#163B29]',
        triggerBottomClass,
      ]"
      aria-label="Buka asisten pemesanan Merayau Adventure"
      @click="chat.openChat()"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H9l-4.5 3.5V17.5A2.5 2.5 0 0 1 4 15V6.5Z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path d="M8 9.5h8M8 13h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span>Bantuan Sewa</span>
    </button>

    <!-- Chat Panel -->
    <Teleport to="body">
      <Transition name="mry-chat">
        <div
          v-if="chat.isOpen.value"
          class="mry-public fixed inset-0 z-[49] flex h-[100dvh] w-full flex-col overflow-hidden bg-[#FDFCFA] sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[min(600px,calc(100dvh-2rem))] sm:w-[400px] sm:max-w-[calc(100vw-2rem)] sm:rounded-2xl sm:border sm:border-[#D6D0C4] sm:shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Asisten Pemesanan Merayau Adventure"
        >
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between gap-2 border-b border-[#EAE5DA] bg-white px-4 py-3">
            <div class="min-w-0">
              <div class="mry-mono text-[11px] font-semibold tracking-[0.08em] text-[#1E4D36] uppercase">
                Asisten Merayau
              </div>
              <h2 class="mry-serif truncate text-lg font-semibold text-[#121613]">
                Bantuan Pemesanan
              </h2>
              <p class="truncate text-xs text-[#5C645E]">
                Info stok alat, paket, trip &amp; sewa
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1.5">
              <button
                v-if="hasUserMessages"
                type="button"
                class="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-[#D6D0C4] bg-[#FDFCFA] px-3 text-xs font-semibold text-[#2E3530] hover:bg-[#F5F2EB]"
                @click="chat.resetChat()"
              >
                Reset
              </button>
              <button
                type="button"
                class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] hover:bg-[#F5F2EB]"
                aria-label="Tutup asisten pemesanan"
                @click="handleClosePanel"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Messages Scroll Area -->
          <div
            ref="scrollBoxRef"
            class="flex-1 space-y-4 overflow-x-hidden overflow-y-auto bg-[#FDFCFA] p-4"
          >
            <div
              v-for="(msg, idx) in chat.messages.value"
              :key="msg.id"
              class="space-y-2.5"
            >
              <!-- Message Bubble -->
              <div :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
                <div
                  :class="[
                    'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed break-words whitespace-pre-line',
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-[#1E4D36] text-white'
                      : 'rounded-bl-sm border border-[#EAE5DA] bg-[#F5F2EB] text-[#121613]',
                  ]"
                >
                  {{ msg.text }}
                </div>
              </div>

              <!-- Alat Cards -->
              <div v-if="msg.alatCards?.length" class="space-y-2">
                <div
                  v-for="item in msg.alatCards"
                  :key="`chat-alat-${msg.id}-${item.id}`"
                  class="flex items-center justify-between gap-3 rounded-xl border border-[#D6D0C4] bg-white p-2.5"
                >
                  <div class="flex min-w-0 items-center gap-2.5">
                    <img
                      :src="item.fotoUrl"
                      :alt="item.namaAlat"
                      class="h-12 w-12 shrink-0 rounded-lg border border-[#EAE5DA] bg-[#F5F2EB] object-cover"
                      loading="lazy"
                    />
                    <div class="min-w-0">
                      <div class="mry-mono truncate text-[10px] font-semibold text-[#5C645E]">
                        {{ item.kodeAlat }} · {{ item.namaKategori }}
                      </div>
                      <div class="truncate text-xs font-semibold text-[#121613]">
                        {{ item.namaAlat }}
                      </div>
                      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span class="mry-mono font-semibold text-[#1E4D36]">
                          {{ formatRupiah(item.hargaEfektif) }}/24j
                        </span>
                        <span
                          :class="item.stokTersedia > 0 ? 'text-[#5C645E]' : 'font-semibold text-[#C2410C]'"
                        >
                          {{ item.stokTersedia > 0 ? `Tersedia ${item.stokTersedia}` : 'Stok habis' }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    :disabled="item.stokTersedia <= 0"
                    class="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#1E4D36] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#163B29] disabled:cursor-not-allowed disabled:bg-[#D6D0C4] disabled:text-[#5C645E]"
                    @click="handleAddAlat(item)"
                  >
                    <template v-if="item.stokTersedia <= 0">Habis</template>
                    <template v-else-if="cart.getAlatQty(item.id) > 0">
                      Di Daftar ({{ cart.getAlatQty(item.id) }}) · +1
                    </template>
                    <template v-else>+ Daftar Sewa</template>
                  </button>
                </div>
              </div>

              <!-- Paket Cards -->
              <div v-if="msg.paketCards?.length" class="space-y-2">
                <div
                  v-for="pkg in msg.paketCards"
                  :key="`chat-pkg-${msg.id}-${pkg.id}`"
                  class="rounded-xl border border-[#1E4D36]/30 bg-[#E6F0EA]/45 p-3"
                >
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="min-w-0">
                      <div class="mry-mono text-[10px] font-semibold text-[#1E4D36] uppercase">
                        {{ pkg.tipePaket === 'bundle' ? 'Item Bundle' : 'Paket Bundel' }}
                      </div>
                      <div class="text-xs font-semibold text-[#121613]">{{ pkg.namaPaket }}</div>
                      <p class="mt-0.5 text-[11px] leading-snug text-[#2E3530]">
                        {{ pkg.ringkasanIsi }}
                      </p>
                      <div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span class="mry-mono font-semibold text-[#1E4D36]">
                          {{ formatRupiah(pkg.hargaEfektif) }}/24 jam
                        </span>
                        <span
                          :class="pkg.kuotaTersedia > 0 ? 'text-[#5C645E]' : 'font-semibold text-[#C2410C]'"
                        >
                          {{ pkg.kuotaTersedia > 0 ? `Kuota ${pkg.kuotaTersedia}` : 'Kuota habis' }}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      :disabled="pkg.kuotaTersedia <= 0"
                      class="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#1E4D36] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#163B29] disabled:cursor-not-allowed disabled:bg-[#D6D0C4] disabled:text-[#5C645E]"
                      @click="handleAddPaket(pkg)"
                    >
                      <template v-if="pkg.kuotaTersedia <= 0">Habis</template>
                      <template v-else-if="getPaketCartQty(pkg.id) > 0">
                        Di Daftar ({{ getPaketCartQty(pkg.id) }}) · +1
                      </template>
                      <template v-else>+ Daftar Sewa</template>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Trip Cards -->
              <div v-if="msg.tripCards?.length" class="space-y-2">
                <div
                  v-for="trip in msg.tripCards"
                  :key="`chat-trip-${msg.id}-${trip.id}`"
                  class="flex items-center justify-between gap-3 rounded-xl border border-[#D6D0C4] bg-white p-2.5"
                >
                  <div class="flex min-w-0 items-center gap-2.5">
                    <img
                      :src="trip.fotoUrl"
                      :alt="trip.judul"
                      class="h-12 w-12 shrink-0 rounded-lg border border-[#EAE5DA] bg-[#F5F2EB] object-cover"
                      loading="lazy"
                    />
                    <div class="min-w-0">
                      <div class="mry-mono truncate text-[10px] font-semibold text-[#1E4D36]">
                        {{ trip.tanggalBerangkat }} · {{ trip.durasi }}
                      </div>
                      <div class="truncate text-xs font-semibold text-[#121613]">
                        {{ trip.judul }}
                      </div>
                      <div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#5C645E]">
                        <span class="mry-mono font-semibold text-[#121613]">
                          Mulai {{ formatRupiah(trip.hargaMulai) }}
                        </span>
                        <span>Sisa {{ trip.sisaKuota }}/{{ trip.kuota }}</span>
                      </div>
                    </div>
                  </div>
                  <NuxtLink
                    :to="`/trip/${trip.id}`"
                    class="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-xl border border-[#1E4D36] bg-white px-3 text-xs font-semibold text-[#1E4D36] hover:bg-[#E6F0EA]"
                    @click="handleClosePanel"
                  >
                    Detail Trip
                  </NuxtLink>
                </div>
              </div>

              <!-- Action Buttons -->
              <div v-if="msg.actions?.length" class="flex flex-wrap gap-2">
                <template v-for="act in msg.actions" :key="`act-${msg.id}-${act.label}`">
                  <button
                    v-if="act.type === 'open_cart'"
                    type="button"
                    class="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl bg-[#1E4D36] px-3.5 text-xs font-semibold text-white hover:bg-[#163B29]"
                    @click="handleOpenCartFromChat"
                  >
                    {{ act.label }}
                  </button>
                  <a
                    v-else-if="act.type === 'wa_cart'"
                    :href="waCartUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#1E4D36] px-3.5 text-xs font-semibold text-white hover:bg-[#163B29]"
                  >
                    <WaIcon :size="14" />
                    <span>{{ act.label }}</span>
                  </a>
                  <a
                    v-else-if="act.type === 'wa_link'"
                    :href="act.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#1E4D36] bg-white px-3.5 text-xs font-semibold text-[#1E4D36] hover:bg-[#E6F0EA]"
                  >
                    <WaIcon :size="14" />
                    <span>{{ act.label }}</span>
                  </a>
                  <NuxtLink
                    v-else-if="act.type === 'route'"
                    :to="act.to"
                    class="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#8A8578] bg-white px-3.5 text-xs font-semibold text-[#121613] hover:border-[#1E4D36] hover:bg-[#E6F0EA]"
                    @click="handleClosePanel"
                  >
                    {{ act.label }}
                  </NuxtLink>
                  <a
                    v-else-if="act.type === 'external'"
                    :href="act.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#8A8578] bg-white px-3.5 text-xs font-semibold text-[#121613] hover:border-[#1E4D36] hover:bg-[#E6F0EA]"
                  >
                    {{ act.label }}
                  </a>
                </template>
              </div>

              <!-- Quick Suggestions (only on latest bot message when not loading) -->
              <div
                v-if="
                  msg.role === 'bot' &&
                  idx === chat.messages.value.length - 1 &&
                  !chat.isLoading.value &&
                  msg.suggestions?.length
                "
                class="flex flex-wrap gap-2 pt-1"
              >
                <button
                  v-for="sug in msg.suggestions"
                  :key="`sug-${msg.id}-${sug}`"
                  type="button"
                  class="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border border-[#8A8578] bg-white px-3 py-1.5 text-left text-xs font-medium text-[#121613] transition-colors hover:border-[#1E4D36] hover:bg-[#E6F0EA]"
                  @click="handleSend(sug)"
                >
                  {{ sug }}
                </button>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="chat.isLoading.value" role="status" class="flex justify-start">
              <div class="rounded-2xl rounded-bl-sm border border-[#EAE5DA] bg-[#F5F2EB] px-3.5 py-2.5 text-xs font-medium text-[#5C645E]">
                Memeriksa data basecamp...
              </div>
            </div>

            <!-- Error State -->
            <div
              v-if="chat.errorMessage.value"
              role="alert"
              class="rounded-xl border border-[#C2410C]/40 bg-white p-3 text-xs text-[#121613]"
            >
              <div class="font-semibold text-[#C2410C]">Tidak dapat memuat jawaban</div>
              <p class="mt-1 leading-relaxed text-[#2E3530]">{{ chat.errorMessage.value }}</p>
              <div class="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl bg-[#1E4D36] px-3.5 text-xs font-semibold text-white hover:bg-[#163B29]"
                  @click="chat.retryLast(buildCartSummaryPayload())"
                >
                  Coba Lagi
                </button>
                <a
                  :href="waFallbackUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#8A8578] bg-[#FDFCFA] px-3.5 text-xs font-semibold text-[#121613] hover:bg-[#F5F2EB]"
                >
                  <WaIcon :size="14" />
                  <span>WhatsApp Admin</span>
                </a>
              </div>
            </div>
          </div>

          <!-- Live Cart Strip -->
          <div
            v-if="cart.totalCount.value > 0"
            class="flex shrink-0 items-center justify-between gap-2 border-t border-[#EAE5DA] bg-[#E6F0EA] px-4 py-2 text-xs"
          >
            <div class="min-w-0 truncate text-[#121613]">
              <span class="font-semibold">Daftar Sewa: {{ cart.totalCount.value }} item</span>
              <span class="mry-mono ml-1.5 font-semibold text-[#1E4D36]">
                {{ formatRupiah(estimate.grandTotal) }}
              </span>
            </div>
            <button
              type="button"
              class="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center rounded-lg bg-[#1E4D36] px-3 text-xs font-semibold text-white hover:bg-[#163B29]"
              @click="handleOpenCartFromChat"
            >
              Lihat &amp; Kirim WA
            </button>
          </div>

          <!-- Input Bar -->
          <form
            class="flex shrink-0 items-center gap-2 border-t border-[#EAE5DA] bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            @submit.prevent="handleSend()"
          >
            <label for="mry-chatbot-input" class="sr-only">Tulis pertanyaan untuk Asisten Merayau</label>
            <input
              id="mry-chatbot-input"
              ref="inputRef"
              v-model="draftText"
              type="text"
              maxlength="400"
              placeholder="Tanya stok alat, paket, trip, atau aturan..."
              class="min-h-[44px] min-w-0 flex-1 rounded-xl border border-[#8A8578] bg-[#FDFCFA] px-3.5 text-sm text-[#121613] placeholder:text-[#5C645E]"
              @focus="handleInputFocus"
            />
            <button
              type="submit"
              :disabled="!draftText.trim() || chat.isLoading.value"
              class="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#1E4D36] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#163B29] disabled:cursor-not-allowed disabled:bg-[#D6D0C4] disabled:text-[#5C645E]"
            >
              Kirim
            </button>
          </form>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

