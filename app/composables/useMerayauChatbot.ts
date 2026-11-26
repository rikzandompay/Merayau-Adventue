export interface ChatbotAlatCard {
  id: number
  idKategori: number
  kodeAlat: string
  namaAlat: string
  namaKategori: string
  hargaHarian: number
  hargaEfektif: number
  stokTersedia: number
  fotoUrl: string
  promoLabel: string | null
  spesifikasi: string
}

export interface ChatbotPaketCard {
  id: number
  namaPaket: string
  tipePaket: 'paket' | 'bundle'
  tarifPaket: number
  hargaEfektif: number
  kuotaTersedia: number
  ringkasanIsi: string
  items: Array<{ namaAlat: string; jumlah: number }>
  promoLabel: string | null
}

export interface ChatbotTripCard {
  id: number
  kodeTrip: string
  judul: string
  lokasi: string
  tanggalBerangkat: string
  durasi: string
  hargaMulai: number
  sisaKuota: number
  kuota: number
  statusPublish: string
  fotoUrl: string
}

export type ChatbotAction =
  | { type: 'open_cart'; label: string }
  | { type: 'wa_cart'; label: string }
  | { type: 'wa_link'; label: string; url: string }
  | { type: 'route'; label: string; to: string }
  | { type: 'external'; label: string; url: string }

export interface ChatbotResponsePayload {
  reply: string
  intent: string
  outOfScope: boolean
  suggestions: string[]
  alatCards: ChatbotAlatCard[]
  paketCards: ChatbotPaketCard[]
  tripCards: ChatbotTripCard[]
  actions: ChatbotAction[]
}

export interface ChatbotCartSummary {
  alatCount: number
  paketCount: number
  durasiHari: number
  grandTotal: number
}

export interface ChatMessage {
  id: string
  role: 'bot' | 'user'
  text: string
  timestamp: string
  intent?: string
  alatCards?: ChatbotAlatCard[]
  paketCards?: ChatbotPaketCard[]
  tripCards?: ChatbotTripCard[]
  actions?: ChatbotAction[]
  suggestions?: string[]
  outOfScope?: boolean
}

export interface ChatbotContextPayload {
  lastIntent?: string
  lastAlatIds?: number[]
  lastPaketIds?: number[]
  lastTripIds?: number[]
}

const INITIAL_SUGGESTIONS = [
  'Cek stok tenda',
  'Lihat paket bundel',
  'Jadwal open trip',
  'Cara pesan & aturan',
  'Lokasi basecamp',
]

function formatTimeNow(): string {
  const now = new Date()
  return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: 'mry-bot-welcome',
    role: 'bot',
    text: 'Halo kak! Selamat datang di Merayau Adventure Pontianak. Mau cari alat gunung, paket bundel hemat, atau cek jadwal open trip? Ketik aja langsung di sini, nanti mimin bantu cek stok dan masukin ke Daftar Sewa.',
    timestamp: formatTimeNow(),
    suggestions: INITIAL_SUGGESTIONS,
  }
}

function buildContextFromMessages(msgs: ChatMessage[]): ChatbotContextPayload | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (!m || m.role !== 'bot' || m.id === 'mry-bot-welcome') continue
    if (m.outOfScope) continue
    if (m.alatCards?.length || m.paketCards?.length || m.tripCards?.length || m.intent) {
      return {
        lastIntent: m.intent,
        lastAlatIds: m.alatCards?.map((a) => a.id),
        lastPaketIds: m.paketCards?.map((p) => p.id),
        lastTripIds: m.tripCards?.map((t) => t.id),
      }
    }
  }
  return undefined
}

export function useMerayauChatbot() {
  const isOpen = useState<boolean>('mry-chat-open', () => false)
  const messages = useState<ChatMessage[]>('mry-chat-messages', () => [createWelcomeMessage()])
  const isLoading = useState<boolean>('mry-chat-loading', () => false)
  const errorMessage = useState<string>('mry-chat-error', () => '')
  const lastFailedText = useState<string>('mry-chat-last-failed', () => '')

  function openChat() {
    isOpen.value = true
  }

  function closeChat() {
    isOpen.value = false
  }

  function toggleChat() {
    isOpen.value = !isOpen.value
  }

  function resetChat() {
    messages.value = [createWelcomeMessage()]
    errorMessage.value = ''
    lastFailedText.value = ''
  }

  function appendMessage(msg: ChatMessage) {
    messages.value.push(msg)
    if (messages.value.length > 50) {
      messages.value.splice(0, messages.value.length - 50)
    }
  }

  async function sendMessage(rawText: string, cartSummary?: ChatbotCartSummary, isRetry = false) {
    const clean = rawText.trim()
    if (!clean || isLoading.value) return

    errorMessage.value = ''
    lastFailedText.value = ''

    const context = buildContextFromMessages(messages.value)
    const historyPool = isRetry
      ? messages.value.slice(0, messages.value[messages.value.length - 1]?.role === 'user' ? -1 : undefined)
      : messages.value
    const history = historyPool
      .filter((m) => m.id !== 'mry-bot-welcome')
      .slice(-10)
      .map((m) => ({
        role: m.role,
        text: m.text.slice(0, 1200),
      }))

    if (!isRetry) {
      appendMessage({
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        text: clean,
        timestamp: formatTimeNow(),
      })
    }

    isLoading.value = true
    try {
      const res = await $fetch<ChatbotResponsePayload>('/api/public/chatbot', {
        method: 'POST',
        body: {
          message: clean,
          cart: cartSummary,
          context,
          history,
        },
      })

      appendMessage({
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'bot',
        text: res.reply,
        timestamp: formatTimeNow(),
        intent: res.intent,
        alatCards: res.alatCards,
        paketCards: res.paketCards,
        tripCards: res.tripCards,
        actions: res.actions,
        suggestions: res.suggestions,
        outOfScope: res.outOfScope,
      })
    } catch (err) {
      lastFailedText.value = clean
      errorMessage.value = extractErrorMessage(
        err,
        'Gagal mengambil data dari server basecamp. Coba lagi sebentar atau hubungi WhatsApp Admin.',
      )
    } finally {
      isLoading.value = false
    }
  }

  async function retryLast(cartSummary?: ChatbotCartSummary) {
    if (!lastFailedText.value) return
    await sendMessage(lastFailedText.value, cartSummary, true)
  }

  return {
    isOpen,
    messages,
    isLoading,
    errorMessage,
    lastFailedText,
    openChat,
    closeChat,
    toggleChat,
    resetChat,
    sendMessage,
    retryLast,
  }
}

