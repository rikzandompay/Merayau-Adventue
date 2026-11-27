import { asc, desc, eq, sql } from 'drizzle-orm'
import {
  infoTrip,
  kategoriAlat,
  masterAlat,
  paketAlat,
  paketAlatItem,
  pesertaTrip,
  tripMeetingPoint,
  tripPaket,
} from '../database/schema'
import { useDb } from './db'
import { getPrimaryAdminContact } from './contact'
import { computePackageQuota, getActiveRentedMap, getDefaultSetting } from './inventory'
import {
  formatPromoBadgeLabel,
  getEnabledPromos,
  isPromoLive,
  resolveBestPromoForAlat,
  resolveBestPromoForPaket,
} from './promo'
import { parseTripDetail } from './trip'

export interface ChatbotCartSummary {
  alatCount: number
  paketCount: number
  durasiHari: number
  grandTotal: number
}

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

export interface ChatbotContext {
  lastIntent?: string
  lastAlatIds?: number[]
  lastPaketIds?: number[]
  lastTripIds?: number[]
}

export interface ChatbotResponse {
  reply: string
  intent: string
  outOfScope: boolean
  suggestions: string[]
  alatCards: ChatbotAlatCard[]
  paketCards: ChatbotPaketCard[]
  tripCards: ChatbotTripCard[]
  actions: ChatbotAction[]
}

export interface ChatbotCatalogSnapshot {
  alat: ChatbotAlatCard[]
  categories: Array<{ id: number; namaKategori: string; jumlahAlat: number }>
  packages: ChatbotPaketCard[]
  trips: Array<
    ChatbotTripCard & {
      pakets: Array<{ kodePaket: string; deskripsiFasilitas: string; harga: number }>
      meetingPoints: string[]
    }
  >
  activePromos: Array<{
    id: number
    namaPromo: string
    label: string
    targetTipe: string
  }>
  aturan: {
    durasiMinimalJam: number
    toleransiTelatJam: number
    dendaPersenHarian: number
    minHariPromo: number
    diskonPersen: number
  }
  kontak: {
    whatsapp: string
    whatsappDisplay: string
    email: string
    alamat: string
    alamatSingkat: string
    mapsUrl: string
    jamBuka: string
  }
}

const PRODUK_IMG_VERSION = 'hd5'
const TRIP_FALLBACK_PHOTOS = [
  '/images/landing/trip-prau.webp',
  '/images/landing/trip-merbabu.webp',
  '/images/landing/trip-lawu.webp',
]

const BASECAMP_INFO = {
  alamat:
    'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b (gang tepat di samping Mr. DIY Tanray 2), Pontianak, Kalimantan Barat',
  alamatSingkat: 'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b, Pontianak',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Jl.+Tanjung+Raya+2+Gg.+Nusa+Abadi+No.+22b+Pontianak',
  jamBuka: 'Setiap Hari, 08.00 - 21.00 WIB',
}

const SNAPSHOT_CACHE_TTL_MS = 30_000
let snapshotCache: { data: ChatbotCatalogSnapshot; expiresAt: number } | null = null

export function invalidateChatbotSnapshotCache(): void {
  snapshotCache = null
}

function formatRupiahServer(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`
}

function buildWaUrlServer(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`
  const base = `https://wa.me/${normalized}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

function resolveGearPhoto(kodeAlat: string, foto: string | null): string {
  const clean = (foto ?? '').trim()
  const code = kodeAlat.toUpperCase()
  const baseUrl = clean || `/images/produk/${code}.jpg`
  return baseUrl.startsWith('/images/produk/')
    ? `${baseUrl}?v=${PRODUK_IMG_VERSION}`
    : baseUrl
}

function resolveTripPhoto(
  foto: string | null | undefined,
  judul: string,
  detailGallery: string[] | undefined,
  idx: number,
): string {
  const main = foto?.trim()
  if (main) return main
  const first = detailGallery?.find((g) => Boolean(g?.trim()))?.trim()
  if (first) return first
  const lower = judul.toLowerCase()
  if (lower.includes('prau')) return '/images/landing/trip-prau.webp'
  if (lower.includes('merbabu')) return '/images/landing/trip-merbabu.webp'
  if (lower.includes('lawu')) return '/images/landing/trip-lawu.webp'
  return TRIP_FALLBACK_PHOTOS[idx % TRIP_FALLBACK_PHOTOS.length] ?? '/images/landing/trip-prau.webp'
}

export async function loadChatbotCatalogSnapshot(): Promise<ChatbotCatalogSnapshot> {
  const cachedNow = Date.now()
  if (snapshotCache && snapshotCache.expiresAt > cachedNow) {
    return snapshotCache.data
  }

  const db = useDb()

  const [
    alatRows,
    catRows,
    pkgRows,
    pkgItemRows,
    tripRows,
    tripPaketRows,
    tripMepoRows,
    pesertaCounts,
    rentedMap,
    settingRow,
    enabledPromos,
    primaryContact,
  ] = await Promise.all([
    db
      .select({
        id: masterAlat.id,
        kodeAlat: masterAlat.kodeAlat,
        idKategori: masterAlat.idKategori,
        namaKategori: kategoriAlat.namaKategori,
        namaAlat: masterAlat.namaAlat,
        spesifikasi: masterAlat.spesifikasi,
        hargaHarian: masterAlat.hargaHarian,
        stokTotal: masterAlat.stokTotal,
        foto: masterAlat.foto,
        statusAktif: masterAlat.statusAktif,
      })
      .from(masterAlat)
      .innerJoin(kategoriAlat, eq(masterAlat.idKategori, kategoriAlat.id))
      .orderBy(asc(masterAlat.kodeAlat)),
    db.select().from(kategoriAlat).orderBy(asc(kategoriAlat.namaKategori)),
    db.select().from(paketAlat).orderBy(asc(paketAlat.id)),
    db
      .select({
        idPaket: paketAlatItem.idPaket,
        idAlat: paketAlatItem.idAlat,
        jumlah: paketAlatItem.jumlah,
        namaAlat: masterAlat.namaAlat,
        stokTotal: masterAlat.stokTotal,
      })
      .from(paketAlatItem)
      .innerJoin(masterAlat, eq(paketAlatItem.idAlat, masterAlat.id)),
    db.select().from(infoTrip).orderBy(desc(infoTrip.id)),
    db.select().from(tripPaket).orderBy(asc(tripPaket.harga), asc(tripPaket.kodePaket)),
    db.select().from(tripMeetingPoint).orderBy(asc(tripMeetingPoint.urutan), asc(tripMeetingPoint.id)),
    db
      .select({
        idTrip: pesertaTrip.idTrip,
        total: sql<number>`COUNT(${pesertaTrip.id})`,
      })
      .from(pesertaTrip)
      .groupBy(pesertaTrip.idTrip),
    getActiveRentedMap(db),
    getDefaultSetting(db),
    getEnabledPromos(db),
    getPrimaryAdminContact(),
  ])

  const now = new Date()
  const livePromos = enabledPromos.filter((p) => isPromoLive(p, now))

  const aturan = {
    durasiMinimalJam: settingRow?.durasiDasarJam ?? 24,
    toleransiTelatJam: settingRow?.toleransiTelatJam ?? 2,
    dendaPersenHarian: settingRow?.dendaPersenHarian ?? 30,
    minHariPromo: settingRow?.minHariPromo ?? 3,
    diskonPersen: settingRow?.diskonPersen ?? 10,
  }

  const availMap = new Map<number, number>()
  const activeAlat: ChatbotAlatCard[] = alatRows
    .filter((r) => r.statusAktif)
    .map((r) => {
      const stokDisewa = rentedMap.get(r.id) ?? 0
      const stokTersedia = Math.max(0, r.stokTotal - stokDisewa)
      availMap.set(r.id, stokTersedia)
      const { hargaEfektif, promoAktif } = resolveBestPromoForAlat(
        { id: r.id, idKategori: r.idKategori, hargaHarian: r.hargaHarian },
        livePromos,
      )
      return {
        id: r.id,
        idKategori: r.idKategori,
        kodeAlat: r.kodeAlat,
        namaAlat: r.namaAlat,
        namaKategori: r.namaKategori,
        hargaHarian: r.hargaHarian,
        hargaEfektif,
        stokTersedia,
        fotoUrl: resolveGearPhoto(r.kodeAlat, r.foto),
        promoLabel: promoAktif ? promoAktif.label : null,
        spesifikasi: (r.spesifikasi ?? '').trim(),
      }
    })

  const categoryCountMap = new Map<number, number>()
  for (const item of activeAlat) {
    categoryCountMap.set(item.idKategori, (categoryCountMap.get(item.idKategori) ?? 0) + 1)
  }
  const categories = catRows
    .map((c) => ({
      id: c.id,
      namaKategori: c.namaKategori,
      jumlahAlat: categoryCountMap.get(c.id) ?? 0,
    }))
    .filter((c) => c.jumlahAlat > 0)

  const pkgItemsByPkg = new Map<number, typeof pkgItemRows>()
  for (const row of pkgItemRows) {
    const list = pkgItemsByPkg.get(row.idPaket) ?? []
    list.push(row)
    pkgItemsByPkg.set(row.idPaket, list)
  }

  const packages: ChatbotPaketCard[] = pkgRows
    .filter((p) => p.statusAktif)
    .map((pkg) => {
      const rawItems = pkgItemsByPkg.get(pkg.id) ?? []
      const items = rawItems.map((it) => ({
        idAlat: it.idAlat,
        namaAlat: it.namaAlat,
        jumlah: it.jumlah,
      }))
      const { hargaEfektif, promoAktif } = resolveBestPromoForPaket(
        { id: pkg.id, tarifPaket: pkg.tarifPaket },
        livePromos,
      )
      const kuotaTersedia = computePackageQuota(items, availMap)
      return {
        id: pkg.id,
        namaPaket: pkg.namaPaket,
        tipePaket: pkg.tipePaket,
        tarifPaket: pkg.tarifPaket,
        hargaEfektif,
        kuotaTersedia,
        ringkasanIsi: items.map((it) => `${it.jumlah}x ${it.namaAlat}`).join(', '),
        items: items.map((it) => ({ namaAlat: it.namaAlat, jumlah: it.jumlah })),
        promoLabel: promoAktif ? promoAktif.label : null,
      }
    })

  const pesertaCountMap = new Map(pesertaCounts.map((c) => [c.idTrip, Number(c.total)]))
  const trips = tripRows
    .filter((t) => t.statusPublish !== 'Draft')
    .map((t, idx) => {
      const detail = parseTripDetail(t.detailJson)
      const pakets = tripPaketRows
        .filter((p) => p.idTrip === t.id)
        .map((p) => ({
          kodePaket: p.kodePaket,
          deskripsiFasilitas: p.deskripsiFasilitas,
          harga: p.harga,
        }))
      const meetingPoints = tripMepoRows
        .filter((m) => m.idTrip === t.id)
        .map((m) => m.namaLokasi)
      const pesertaCount = pesertaCountMap.get(t.id) ?? 0
      const sisaKuota = Math.max(0, t.kuota - pesertaCount)
      const hargaMulai = pakets.length ? Math.min(...pakets.map((p) => p.harga)) : 0
      return {
        id: t.id,
        kodeTrip: t.kodeTrip,
        judul: t.judul,
        lokasi: t.lokasi,
        tanggalBerangkat: t.tanggalBerangkat,
        durasi: t.durasi,
        hargaMulai,
        sisaKuota,
        kuota: t.kuota,
        statusPublish: t.statusPublish,
        fotoUrl: resolveTripPhoto(t.foto, t.judul, detail.gallery, idx),
        pakets,
        meetingPoints,
      }
    })

  const activePromos = livePromos.map((p) => ({
    id: p.id,
    namaPromo: p.namaPromo,
    label: formatPromoBadgeLabel(p),
    targetTipe: p.targetTipe,
  }))

  const result: ChatbotCatalogSnapshot = {
    alat: activeAlat,
    categories,
    packages,
    trips,
    activePromos,
    aturan,
    kontak: {
      whatsapp: primaryContact.whatsapp,
      whatsappDisplay: primaryContact.whatsappDisplay,
      email: primaryContact.email,
      ...BASECAMP_INFO,
    },
  }
  snapshotCache = {
    data: result,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  }
  return result
}

const SYNONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(keril|carriel|carier|ransel|tas gunung|daypack)\b/g, 'carrier'],
  [/\b(sb|sleepingbag)\b/g, 'sleeping bag'],
  [/\b(headlamp|head lamp|senter|lantern)\b/g, 'lampu'],
  [/\b(cookset|cooking set|nesting|kompor|gas portable|panci)\b/g, 'masak'],
  [/\b(tongkat|tracking pole)\b/g, 'trekking pole'],
  [/\b(tend|dome)\b/g, 'tenda'],
  [/\b(bundel|bundle)\b/g, 'paket'],
  [/\b(mepo)\b/g, 'meeting point'],
  [/\b(opentrip)\b/g, 'open trip'],
  [/\b(brp|brapa|berapaan|piye)\b/g, 'berapa'],
  [/\b(hrg|hrga|ongkos|tarif)\b/g, 'harga'],
  [/\b(ready|redi|tersedia)\b/g, 'stok'],
  [/\b(ga|gak|ngga|nggak|engga|gk|kagak)\b/g, 'tidak'],
  [/\b(yg)\b/g, 'yang'],
  [/\b(utk|u)\b/g, 'untuk'],
  [/\b(dgn|ama|sm)\b/g, 'dengan'],
  [/\b(bgt|bangett|bener)\b/g, 'banget'],
  [/\b(bs)\b/g, 'bisa'],
  [/\b(sy|aku|gw|gue|ane)\b/g, 'saya'],
  [/\b(km|lu)\b/g, 'kamu'],
  [/\b(org)\b/g, 'orang'],
]

const STOP_WORDS = new Set([
  'ada',
  'apa',
  'aja',
  'saja',
  'yang',
  'mau',
  'ingin',
  'cari',
  'sewa',
  'pinjam',
  'rental',
  'harga',
  'berapa',
  'stok',
  'tarif',
  'biaya',
  'untuk',
  'buat',
  'hari',
  'jam',
  'kak',
  'min',
  'mimin',
  'admin',
  'bang',
  'mas',
  'mbak',
  'bro',
  'sis',
  'bos',
  'gan',
  'om',
  'dong',
  'nih',
  'sih',
  'deh',
  'kok',
  'ya',
  'yah',
  'di',
  'ke',
  'dari',
  'dan',
  'atau',
  'dengan',
  'itu',
  'ini',
  'bisa',
  'kalau',
  'kalo',
  'misal',
  'misalnya',
  'tidak',
  'info',
  'tolong',
  'tanya',
  'lihat',
  'cek',
  'daftar',
  'pesan',
  'order',
  'booking',
  'halo',
  'hallo',
  'helo',
  'hai',
  'hi',
  'hey',
  'hei',
  'yo',
  'uy',
  'oi',
  'p',
  'ping',
  'tes',
  'test',
  'permisi',
  'punten',
  'spada',
  'selamat',
  'pagi',
  'siang',
  'sore',
  'malam',
  'met',
  'assalamualaikum',
  'salam',
  'saya',
  'kamu',
  'kita',
  'kami',
  'banget',
  'lagi',
  'masih',
  'punya',
  'jual',
  'orang',
])

const COOKING_OFFTOPIC_WORDS = [
  'resep',
  'nasi goreng',
  'rendang',
  'soto',
  'bakso',
  'bumbu',
  'masakan',
  'gorengan',
  'kue',
]

function collapseRepeatedChars(text: string): string {
  return text.replace(/(.)\1+/g, '$1')
}

function normalizeQueryText(input: string): string {
  let text = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (const [pattern, replacement] of SYNONYM_REPLACEMENTS) {
    text = text.replace(pattern, replacement)
  }
  return text.replace(/\s+/g, ' ').trim()
}

function hasAnyPhraseIn(variants: string[], phrases: string[]): boolean {
  return phrases.some((p) => {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, 'i')
    return variants.some((v) => re.test(v))
  })
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 99
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0] ?? 0
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cur = dp[j] ?? 0
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min((dp[j] ?? 0) + 1, (dp[j - 1] ?? 0) + 1, prev + cost)
      prev = cur
    }
  }
  return dp[b.length] ?? 99
}

function isFuzzyTokenMatch(token: string, targetWord: string): boolean {
  if (token.length < 4 || targetWord.length < 4) return false
  const maxDist = token.length >= 7 && targetWord.length >= 7 ? 2 : 1
  return editDistance(token, targetWord) <= maxDist
}

function extractRequestedDays(text: string): number | null {
  const m = text.match(/\b(\d{1,2})\s*(?:hari|hr|h)\b/i)
  if (!m) return null
  const val = Number(m[1])
  if (!Number.isFinite(val) || val < 1 || val > 30) return null
  return val
}

function extractPeopleCount(text: string): number | null {
  if (/\b(solo|sendiri|sendirian|1 orang)\b/i.test(text)) return 1
  if (/\b(berdua|couple|2 orang)\b/i.test(text)) return 2
  const m = text.match(/\b(\d{1,2})\s*(?:orang|org|peserta|pendaki)\b/i)
  if (!m) return null
  const val = Number(m[1])
  return Number.isFinite(val) && val >= 1 && val <= 50 ? val : null
}

function tokenizeKeywords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t))
}

function computeDiscountedForDays(
  dailyRate: number,
  days: number,
  minHariPromo: number,
  diskonPersen: number,
): { baseTotal: number; discount: number; total: number } {
  const baseTotal = dailyRate * days
  const eligible = days >= minHariPromo && minHariPromo > 0 && diskonPersen > 0
  const discount = eligible ? Math.round((baseTotal * diskonPersen) / 100) : 0
  return { baseTotal, discount, total: Math.max(0, baseTotal - discount) }
}

function scoreAlatMatch(
  item: ChatbotAlatCard,
  tokens: string[],
  squashedTokens: string[],
  fullText: string,
): number {
  const nama = item.namaAlat.toLowerCase()
  const namaWords = nama.split(/[\s/()-]+/).filter(Boolean)
  const firstWord = namaWords[0] ?? ''
  const kat = item.namaKategori.toLowerCase()
  const katWords = kat.split(/[\s/()-]+/).filter(Boolean)
  const kode = item.kodeAlat.toLowerCase()
  const spec = item.spesifikasi.toLowerCase()

  if (fullText.includes(kode)) return 100
  if (fullText.includes(nama)) return 90

  const allTokens = Array.from(new Set([...tokens, ...squashedTokens]))
  let score = 0
  for (const tk of allTokens) {
    if (kode === tk) score += 45
    if (firstWord && (firstWord === tk || firstWord.startsWith(tk))) score += 18
    if (nama.includes(tk)) {
      score += 25
    } else if (namaWords.some((w) => isFuzzyTokenMatch(tk, w))) {
      score += 18
    }
    if (kat.includes(tk)) {
      score += 18
    } else if (katWords.some((w) => isFuzzyTokenMatch(tk, w))) {
      score += 12
    }
    if (spec.includes(tk)) score += 8
  }

  // Push tent accessories below real tents when searching "tenda"
  if (
    score > 0 &&
    allTokens.some((t) => t === 'tenda' || isFuzzyTokenMatch(t, 'tenda')) &&
    (nama.includes('footprint') || nama.includes('alas') || nama.includes('lampu tenda'))
  ) {
    score -= 14
  }

  if (score > 0 && item.stokTersedia > 0) score += 3
  return Math.max(0, score)
}

function scorePaketMatch(
  pkg: ChatbotPaketCard,
  tokens: string[],
  squashedTokens: string[],
  fullText: string,
): number {
  const nama = pkg.namaPaket.toLowerCase()
  const namaWords = nama.split(/[\s/()-]+/).filter(Boolean)
  const isi = pkg.ringkasanIsi.toLowerCase()
  if (fullText.includes(nama)) return 90

  const allTokens = Array.from(new Set([...tokens, ...squashedTokens]))
  let score = 0
  for (const tk of allTokens) {
    if (nama.includes(tk) || namaWords.some((w) => isFuzzyTokenMatch(tk, w))) score += 24
    if (isi.includes(tk)) score += 12
  }
  if (score > 0 && pkg.kuotaTersedia > 0) score += 3
  return score
}

function toPublicTripCard(
  trip: ChatbotCatalogSnapshot['trips'][number],
): ChatbotTripCard {
  return {
    id: trip.id,
    kodeTrip: trip.kodeTrip,
    judul: trip.judul,
    lokasi: trip.lokasi,
    tanggalBerangkat: trip.tanggalBerangkat,
    durasi: trip.durasi,
    hargaMulai: trip.hargaMulai,
    sisaKuota: trip.sisaKuota,
    kuota: trip.kuota,
    statusPublish: trip.statusPublish,
    fotoUrl: trip.fotoUrl,
  }
}

function formatCartHint(cart?: ChatbotCartSummary): string {
  const count = (cart?.alatCount ?? 0) + (cart?.paketCount ?? 0)
  if (count <= 0) return ''
  return `\n\nOh ya, di Daftar Sewa kamu sekarang sudah ada ${count} item (${cart?.durasiHari ?? 2} hari, estimasi ${formatRupiahServer(cart?.grandTotal ?? 0)}).`
}

export function generateChatbotReply(
  rawMessage: string,
  snapshot: ChatbotCatalogSnapshot,
  cart?: ChatbotCartSummary,
  context?: ChatbotContext,
): ChatbotResponse {
  const cleanRaw = rawMessage.trim()
  const normalized = normalizeQueryText(cleanRaw)
  const squashed = normalizeQueryText(collapseRepeatedChars(cleanRaw))
  const variants = squashed && squashed !== normalized ? [normalized, squashed] : [normalized]

  const requestedDays = extractRequestedDays(normalized) ?? extractRequestedDays(squashed)
  const peopleCount = extractPeopleCount(normalized) ?? extractPeopleCount(squashed)
  const tokens = tokenizeKeywords(normalized)
  const squashedTokens = tokenizeKeywords(squashed)

  const waAdminUrl = buildWaUrlServer(
    snapshot.kontak.whatsapp,
    'Halo Admin Merayau Adventure Pontianak, saya mau tanya stok atau pesan perlengkapan.',
  )
  const hasCartItems = (cart?.alatCount ?? 0) + (cart?.paketCount ?? 0) > 0

  if (
    hasAnyPhraseIn(variants, COOKING_OFFTOPIC_WORDS) &&
    !hasAnyPhraseIn(variants, ['kompor', 'nesting', 'gunung', 'camping', 'sewa', 'alat'])
  ) {
    return buildOutOfScopeResponse(waAdminUrl)
  }

  // Check bot identity / human question
  if (
    hasAnyPhraseIn(variants, [
      'kamu bot',
      'ini bot',
      'robot ya',
      'siapa kamu',
      'ini ai',
      'admin asli',
      'orang asli',
      'balas otomatis',
    ])
  ) {
    return {
      reply:
        'Saya asisten chat resmi Merayau Adventure di website ini kak. Saya terhubung langsung ke data stok dan harga live basecamp biar bisa bantu cek alat, hitung biaya sewa, dan masukin item ke Daftar Sewa lebih cepat. Kalau mau ngobrol langsung sama tim basecamp, tinggal klik tombol Chat Admin WhatsApp ya.',
      intent: 'identitas_bot',
      outOfScope: false,
      suggestions: ['Cek stok tenda', 'Lihat paket bundel', 'Jadwal open trip'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: [{ type: 'wa_link', label: 'Chat Admin WhatsApp', url: waAdminUrl }],
    }
  }

  // Greetings & conversational openers (handles "hallo min", "assalamualaikum kak", "pagi", "ada orang?", etc.)
  const isAvailabilityPing = hasAnyPhraseIn(variants, [
    'ada orang',
    'masih buka',
    'lagi buka',
    'buka tidak',
    'admin online',
    'min online',
    'online tidak',
    'ready min',
  ])
  const strippedGreeting = squashed
    .replace(
      /\b(halo|helo|hai|hi|hey|hei|yo|uy|oi|p|ping|tes|test|permisi|punten|spada|assalamualaikum|asalamualaikum|assalamu alaikum|asalamu alaikum|salam|selamat|met|pagi|siang|sore|malam|min|mimin|admin|kak|bang|mas|mbak|bro|sis|bos|gan|om|ada|orang|online|buka|tidak|bisa|mau|ingin|tanya|dong|bantu|tolong|bingung|nih|ya|yah|ke|di|ini)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()

  if (isAvailabilityPing || !strippedGreeting) {
    let greetingText =
      'Halo kak, siap bantu! Mau cek stok dan harga alat gunung, cari paket bundel hemat, atau tanya jadwal open trip? Ketik aja kebutuhannya (misalnya: "tenda buat 4 orang 3 hari"), nanti mimin langsung carikan.'

    if (hasAnyPhraseIn(variants, ['assalamualaikum', 'asalamualaikum', 'assalamu alaikum', 'asalamu alaikum'])) {
      greetingText =
        'Waalaikumsalam kak! Ada yang bisa mimin bantu? Lagi cari perlengkapan gunung, paket bundel hemat, atau mau cek jadwal open trip nih?'
    } else if (isAvailabilityPing) {
      greetingText = `Halo kak, ada dong! Basecamp Merayau Adventure buka ${snapshot.kontak.jamBuka.replace(/^Setiap Hari,?\s*/i, 'setiap hari jam ')}, dan di chat ini mimin siap bantu cek stok alat, paket, atau jadwal open trip kapan aja. Lagi butuh apa nih kak?`
    } else if (hasAnyPhraseIn(variants, ['pagi', 'siang', 'sore', 'malam'])) {
      const waktu = hasAnyPhraseIn(variants, ['pagi'])
        ? 'pagi'
        : hasAnyPhraseIn(variants, ['siang'])
          ? 'siang'
          : hasAnyPhraseIn(variants, ['sore'])
            ? 'sore'
            : 'malam'
      greetingText = `Selamat ${waktu} kak! Selamat datang di Merayau Adventure Pontianak. Lagi rencana camping atau naik gunung kapan nih? Bilang aja alat yang dicari, nanti mimin bantu cek stok dan hitung biayanya.`
    }

    return {
      reply: greetingText + formatCartHint(cart),
      intent: 'greeting',
      outOfScope: false,
      suggestions: [
        'Cek stok tenda',
        'Lihat paket bundel',
        'Jadwal open trip',
        'Cara pesan & aturan',
      ],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: hasCartItems
        ? [{ type: 'open_cart', label: 'Buka Daftar Sewa' }]
        : [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
    }
  }

  // Thanks / closing / confirmation
  const strippedThanks = squashed
    .replace(
      /\b(terima kasih|makasih|makasi|tq|thx|thanks|thank you|oke|ok|okey|siap|mantap|sip|baik|noted|aman|jos|cakep|kak|min|mimin|admin|bang|mas|mbak|ya|yah|sama sama)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!strippedThanks) {
    return {
      reply:
        'Sama-sama kak! Kalau alatnya sudah cocok di Daftar Sewa, tinggal atur tanggal ambil dan kirim pesannya ke WhatsApp Admin ya. Ditunggu di basecamp!',
      intent: 'closing',
      outOfScope: false,
      suggestions: ['Lihat paket bundel', 'Cek promo aktif', 'Lokasi basecamp'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: hasCartItems
        ? [
            { type: 'open_cart', label: 'Buka Daftar Sewa' },
            { type: 'wa_cart', label: 'Kirim Daftar Sewa via WhatsApp' },
          ]
        : [{ type: 'wa_link', label: 'Chat Admin WhatsApp', url: waAdminUrl }],
    }
  }

  // Delivery / COD inquiry
  if (
    hasAnyPhraseIn(variants, [
      'diantar',
      'antar',
      'delivery',
      'kirim ke rumah',
      'ojol',
      'gosend',
      'grab',
      'cod',
      'ambil dimana',
      'ambilnya dimana',
    ])
  ) {
    return {
      reply: `Untuk pengambilan dan pengembalian dilakukan langsung di Basecamp Merayau Adventure (${snapshot.kontak.alamatSingkat}) ya kak, soalnya sekalian cek kondisi fisik barang bareng admin dan titip identitas asli (KTP, SIM, atau KTM). Kalau ada kebutuhan mendesak, boleh banget koordinasi dulu lewat WhatsApp Admin.`,
      intent: 'ambil_antar',
      outOfScope: false,
      suggestions: ['Lokasi basecamp', 'Syarat jaminan KTP', 'Cara pesan alat'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: [
        { type: 'external', label: 'Buka Google Maps', url: snapshot.kontak.mapsUrl },
        { type: 'wa_link', label: 'Chat Admin WhatsApp', url: waAdminUrl },
      ],
    }
  }

  // Quality / condition concern
  if (
    hasAnyPhraseIn(variants, [
      'bagus tidak',
      'bersih tidak',
      'bersih',
      'wangi',
      'layak',
      'bocor',
      'kondisi',
      'kualitas',
      'aman tidak',
    ])
  ) {
    return {
      reply:
        'Tenang kak, semua perlengkapan seperti tenda, carrier, sepatu, jaket, sampai alat masak selalu dicek kondisi dan kelengkapannya (frame, pasak, resleting, dan fungsi alat) bareng admin saat pengambilan di basecamp. Untuk sepatu, jaket, dan celana juga wajib fitting maksimal H-1 biar ukurannya pas waktu dipakai naik gunung.',
      intent: 'kualitas_alat',
      outOfScope: false,
      suggestions: ['Cek stok tenda', 'Syarat jaminan sewa', 'Lokasi basecamp'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
    }
  }

  // 1. Specific Open Trip Match (by trip title/location or general trip keywords)
  const matchedTrips = snapshot.trips.filter((t) => {
    const title = t.judul.toLowerCase()
    const loc = t.lokasi.toLowerCase()
    const code = t.kodeTrip.toLowerCase()
    if (normalized.includes(code) || normalized.includes(title) || normalized.includes(loc)) {
      return true
    }
    return tokens.some(
      (tk) =>
        tk.length >= 3 &&
        (title.includes(tk) || loc.includes(tk) || code.includes(tk)),
    )
  })

  const isTripIntent =
    matchedTrips.length > 0 ||
    hasAnyPhraseIn(variants, [
      'open trip',
      'trip',
      'mendaki',
      'pendakian',
      'jadwal trip',
      'kuota trip',
      'meeting point',
      'itinerary',
      'daftar trip',
    ])

  if (isTripIntent) {
    const chosen = (matchedTrips.length ? matchedTrips : snapshot.trips).slice(0, 3)
    if (!chosen.length) {
      return {
        reply:
          'Saat ini belum ada jadwal open trip yang sedang tayang nih kak. Kalau mau tanya jadwal keberangkatan berikutnya atau sewa alat buat jalan sendiri, langsung chat Admin WhatsApp aja ya.',
        intent: 'open_trip',
        outOfScope: false,
        suggestions: ['Cek stok tenda', 'Lihat paket bundel', 'Lokasi basecamp'],
        alatCards: [],
        paketCards: [],
        tripCards: [],
        actions: [{ type: 'wa_link', label: 'Tanya Jadwal ke Admin', url: waAdminUrl }],
      }
    }

    const lines = chosen.map((t) => {
      const mepoText = t.meetingPoints.length
        ? ` | Meeting point: ${t.meetingPoints.slice(0, 3).join(', ')}`
        : ''
      return `- ${t.judul} (${t.tanggalBerangkat}, ${t.durasi}): mulai ${formatRupiahServer(t.hargaMulai)}, sisa kuota ${t.sisaKuota}/${t.kuota}${mepoText}`
    })

    return {
      reply: `Ini jadwal open trip Merayau Adventure yang lagi buka kak:\n${lines.join('\n')}\n\nTinggal klik kartu trip di bawah kalau mau lihat itinerary lengkap, pilihan paket, dan daftar.`,
      intent: 'open_trip',
      outOfScope: false,
      suggestions: ['Rekomendasi alat naik gunung', 'Aturan sewa alat', 'Lokasi basecamp'],
      alatCards: [],
      paketCards: [],
      tripCards: chosen.map(toPublicTripCard),
      actions: [{ type: 'wa_link', label: 'Tanya Trip via WhatsApp', url: waAdminUrl }],
    }
  }

  // 2. Promo & Diskon
  if (hasAnyPhraseIn(variants, ['promo', 'diskon', 'potongan', 'voucher', 'hemat berapa'])) {
    const promoLines = snapshot.activePromos.map((p) => `- ${p.namaPromo}: ${p.label}`)
    const durationLine = `- Sewa minimal ${snapshot.aturan.minHariPromo} hari otomatis dapat diskon ${snapshot.aturan.diskonPersen}%`

    const replyParts = [
      'Untuk promo dan diskon di Merayau Adventure saat ini:',
      durationLine,
      ...(promoLines.length
        ? promoLines
        : ['- Belum ada promo item terjadwal tambahan selain diskon durasi di atas kak.']),
      '',
      'Potongannya langsung terhitung otomatis waktu kamu pilih tanggal sewa di Daftar Sewa ya.',
    ]

    return {
      reply: replyParts.join('\n'),
      intent: 'promo',
      outOfScope: false,
      suggestions: ['Lihat paket bundel', 'Cek stok tenda', 'Cara pesan alat'],
      alatCards: [],
      paketCards: snapshot.packages.slice(0, 2),
      tripCards: [],
      actions: hasCartItems
        ? [{ type: 'open_cart', label: 'Cek Hitungan di Daftar Sewa' }]
        : [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
    }
  }

  // 3. Location, Hours & Contact
  if (
    hasAnyPhraseIn(variants, [
      'lokasi',
      'alamat',
      'basecamp',
      'maps',
      'dimana',
      'di mana',
      'jam buka',
      'buka jam',
      'operasional',
      'kontak',
      'whatsapp',
      'wa admin',
      'nomor wa',
      'telepon',
      'hubungi',
      'email',
      'pontianak',
    ])
  ) {
    return {
      reply: [
        'Basecamp Merayau Adventure ada di sini kak:',
        `Alamat: ${snapshot.kontak.alamat}`,
        `Jam buka: ${snapshot.kontak.jamBuka}`,
        `WhatsApp Admin: ${snapshot.kontak.whatsappDisplay}`,
        `Email: ${snapshot.kontak.email}`,
      ].join('\n'),
      intent: 'kontak_lokasi',
      outOfScope: false,
      suggestions: ['Cara pesan alat', 'Syarat jaminan sewa', 'Cek stok tenda'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: [
        { type: 'external', label: 'Buka Google Maps', url: snapshot.kontak.mapsUrl },
        { type: 'wa_link', label: 'Chat Admin WhatsApp', url: waAdminUrl },
      ],
    }
  }

  // 4. Rental Rules / Jaminan / Denda / Batal / Fitting
  if (
    hasAnyPhraseIn(variants, [
      'aturan',
      'syarat',
      'ketentuan',
      'jaminan',
      'ktp',
      'sim',
      'ktm',
      'identitas',
      'denda',
      'telat',
      'terlambat',
      'toleransi',
      'batal',
      'cancel',
      'rusak',
      'hilang',
      'fitting',
      '24 jam',
    ])
  ) {
    const a = snapshot.aturan
    return {
      reply: [
        'Aturan sewa di Merayau Adventure gampang kok kak, ini poin pentingnya:',
        `- Sewa dihitung per ${a.durasiMinimalJam} jam. Ada toleransi telat ${a.toleransiTelatJam} jam; lewat dari itu baru kena denda ${a.dendaPersenHarian}% dari tarif harian.`,
        '- Waktu ambil alat wajib titip 1 identitas asli yang masih berlaku (KTP, SIM, atau KTM).',
        '- Khusus sepatu, jaket, dan celana wajib fitting maksimal H-1 biar ukurannya pas.',
        '- Kelengkapan alat (frame, pasak, resleting, kompor) kita cek bareng-bareng di basecamp.',
        '- Kalau batal sepihak setelah jadwal dikonfirmasi DP bisa hangus, dan kerusakan/kehilangan jadi tanggung jawab penyewa.',
      ].join('\n'),
      intent: 'aturan_sewa',
      outOfScope: false,
      suggestions: ['Cara pesan alat', 'Lihat paket bundel', 'Lokasi basecamp'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: [{ type: 'wa_link', label: 'Tanya Detail ke Admin', url: waAdminUrl }],
    }
  }

  // Score direct item / package matches
  const scoredAlat = snapshot.alat
    .map((item) => ({ item, score: scoreAlatMatch(item, tokens, squashedTokens, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.item.stokTersedia - a.item.stokTersedia)

  const scoredPakets = snapshot.packages
    .map((pkg) => ({ pkg, score: scorePaketMatch(pkg, tokens, squashedTokens, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.pkg.kuotaTersedia - a.pkg.kuotaTersedia)

  const hasSpecificMatch = scoredAlat.length > 0 || scoredPakets.length > 0

  // Multi-turn Context Follow-Up (before ordering flow / generic fallback)
  const asksCheapest = hasAnyPhraseIn(variants, [
    'murah',
    'termurah',
    'paling murah',
    'budget',
    'hemat',
    'terjangkau',
    'nego',
    'mahal',
  ])

  if (!hasSpecificMatch && context) {
    // Follow-up on previously shown trips
    if (
      context.lastTripIds?.length &&
      hasAnyPhraseIn(variants, [
        'berapa',
        'harga',
        'kuota',
        'sisa',
        'meeting point',
        'daftar',
        'ikut',
      ])
    ) {
      const prevTrips = snapshot.trips.filter((t) => context.lastTripIds?.includes(t.id))
      if (prevTrips.length) {
        const lines = prevTrips.map((t) => {
          const mepo = t.meetingPoints.length ? t.meetingPoints.join(', ') : 'Dikonfirmasi Admin'
          const pkt = t.pakets.length
            ? t.pakets.map((p) => `${p.kodePaket} ${formatRupiahServer(p.harga)}`).join(', ')
            : formatRupiahServer(t.hargaMulai)
          return `- ${t.judul}: ${pkt} | Sisa kuota ${t.sisaKuota}/${t.kuota} | Meeting point: ${mepo}`
        })
        return {
          reply: `Untuk detail open trip yang barusan kita bahas kak:\n${lines.join('\n')}\n\nKlik kartu trip di bawah buat lihat itinerary lengkap dan langsung daftar ya.`,
          intent: 'open_trip',
          outOfScope: false,
          suggestions: ['Cek stok tenda', 'Aturan sewa alat', 'Lokasi basecamp'],
          alatCards: [],
          paketCards: [],
          tripCards: prevTrips.map(toPublicTripCard),
          actions: [{ type: 'wa_link', label: 'Daftar Trip via WhatsApp', url: waAdminUrl }],
        }
      }
    }

    // Follow-up on previously shown gear/packages (e.g. "kalau 3 hari berapa?", "yang paling murah?", "masih ada stok?")
    const hasFollowUpTrigger =
      requestedDays !== null ||
      asksCheapest ||
      hasAnyPhraseIn(variants, ['berapa', 'total', 'harga', 'stok', 'ready', 'masih ada', 'itu'])

    if ((context.lastAlatIds?.length || context.lastPaketIds?.length) && hasFollowUpTrigger) {
      let prevAlat = snapshot.alat.filter((a) => context.lastAlatIds?.includes(a.id))
      let prevPakets = snapshot.packages.filter((p) => context.lastPaketIds?.includes(p.id))

      if (asksCheapest) {
        prevAlat = [...prevAlat].sort((a, b) => a.hargaEfektif - b.hargaEfektif)
        prevPakets = [...prevPakets].sort((a, b) => a.hargaEfektif - b.hargaEfektif)
      }

      if (prevAlat.length || prevPakets.length) {
        const days = requestedDays ?? 1
        const lines: string[] = []
        for (const item of prevAlat.slice(0, 4)) {
          const stokText = item.stokTersedia > 0 ? `tersedia ${item.stokTersedia} unit` : 'stok habis'
          if (requestedDays) {
            const calc = computeDiscountedForDays(
              item.hargaEfektif,
              days,
              snapshot.aturan.minHariPromo,
              snapshot.aturan.diskonPersen,
            )
            const discNote =
              calc.discount > 0 ? ` (sudah potong diskon ${snapshot.aturan.diskonPersen}%)` : ''
            lines.push(
              `- ${item.namaAlat}: ${formatRupiahServer(calc.total)} untuk ${days} hari${discNote}, ${stokText}`,
            )
          } else {
            lines.push(
              `- ${item.namaAlat}: ${formatRupiahServer(item.hargaEfektif)}/24 jam, ${stokText}`,
            )
          }
        }
        for (const pkg of prevPakets.slice(0, 2)) {
          if (requestedDays) {
            const calc = computeDiscountedForDays(
              pkg.hargaEfektif,
              days,
              snapshot.aturan.minHariPromo,
              snapshot.aturan.diskonPersen,
            )
            lines.push(
              `- Paket ${pkg.namaPaket}: ${formatRupiahServer(calc.total)} untuk ${days} hari, kuota ${pkg.kuotaTersedia}`,
            )
          } else {
            lines.push(
              `- Paket ${pkg.namaPaket}: ${formatRupiahServer(pkg.hargaEfektif)}/24 jam, kuota ${pkg.kuotaTersedia}`,
            )
          }
        }

        const header = asksCheapest
          ? 'Ini urutan dari yang paling hemat buat pilihan barusan kak:'
          : requestedDays
            ? `Kalau sewa ${days} hari, ini rincian biayanya kak:`
            : 'Ini rincian item yang barusan kita bahas kak:'

        return {
          reply: `${header}\n${lines.join('\n')}\n\nKalau ada yang pas, langsung klik "+ Daftar Sewa" di kartunya ya.`,
          intent: 'cari_alat',
          outOfScope: false,
          suggestions: [
            requestedDays ? 'Lihat paket bundel' : `Sewa ${snapshot.aturan.minHariPromo} hari`,
            'Cara pesan alat',
            'Syarat jaminan KTP',
          ],
          alatCards: prevAlat.slice(0, 4),
          paketCards: prevPakets.slice(0, 2),
          tripCards: [],
          actions: hasCartItems
            ? [{ type: 'open_cart', label: 'Buka Daftar Sewa' }]
            : [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
        }
      }
    }
  }

  // 5. Ordering & Payment Flow (No payment gateway)
  const asksHowToOrder = hasAnyPhraseIn(variants, [
    'cara pesan',
    'cara sewa',
    'cara booking',
    'cara order',
    'checkout',
    'keranjang',
    'daftar sewa',
    'bayar',
    'pembayaran',
    'transfer',
    'dp',
    'cash',
    'tunai',
    'qris',
    'payment',
  ])
  const asksGenericOrder =
    !hasSpecificMatch &&
    hasAnyPhraseIn(variants, ['pesan sekarang', 'mau pesan', 'mau order', 'mau booking'])

  if (asksHowToOrder || asksGenericOrder) {
    return {
      reply:
        [
          'Cara pesannya simpel banget kak:',
          '1. Pilih alat atau paket bundel dari katalog atau langsung klik "+ Daftar Sewa" di chat ini.',
          '2. Buka Daftar Sewa, lalu tentukan tanggal ambil dan tanggal kembali.',
          '3. Klik "Kirim Daftar Sewa via WhatsApp" buat kirim rinciannya ke Admin.',
          '4. Konfirmasi stok dan pembayaran (DP atau lunas) langsung sama Admin via WhatsApp atau waktu ambil alat di Basecamp Tanjung Raya 2 sambil bawa KTP/SIM/KTM asli.',
        ].join('\n') + formatCartHint(cart),
      intent: 'cara_pesan',
      outOfScope: false,
      suggestions: ['Cek stok tenda', 'Lihat paket bundel', 'Syarat jaminan KTP'],
      alatCards: [],
      paketCards: [],
      tripCards: [],
      actions: hasCartItems
        ? [
            { type: 'open_cart', label: 'Buka Daftar Sewa' },
            { type: 'wa_cart', label: 'Kirim Daftar Sewa via WhatsApp' },
          ]
        : [
            { type: 'route', label: 'Pilih Alat di Katalog', to: '/katalog' },
            { type: 'wa_link', label: 'Chat Admin WhatsApp', url: waAdminUrl },
          ],
    }
  }

  // 6. Paket / Bundle Query (explicit paket/bundel request without specific gear keyword overriding)
  const isPaketIntent = hasAnyPhraseIn(variants, ['paket', 'tektok'])
  if (isPaketIntent && scoredAlat.length === 0) {
    const chosenPkgs = (scoredPakets.length ? scoredPakets.map((x) => x.pkg) : snapshot.packages).slice(0, 4)
    if (!chosenPkgs.length) {
      return {
        reply: 'Saat ini belum ada paket bundel aktif kak. Tapi kamu tetap bisa pilih alat satuan di Katalog Lengkap ya.',
        intent: 'paket',
        outOfScope: false,
        suggestions: ['Cek stok tenda', 'Cek stok carrier', 'Buka katalog'],
        alatCards: [],
        paketCards: [],
        tripCards: [],
        actions: [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
      }
    }

    const daysText = requestedDays ? ` untuk ${requestedDays} hari` : ''
    const lines = chosenPkgs.map((p) => {
      if (requestedDays) {
        const calc = computeDiscountedForDays(
          p.hargaEfektif,
          requestedDays,
          snapshot.aturan.minHariPromo,
          snapshot.aturan.diskonPersen,
        )
        return `- ${p.namaPaket}: ${formatRupiahServer(p.hargaEfektif)}/24 jam (estimasi ${requestedDays} hari ${formatRupiahServer(calc.total)}), kuota tersedia ${p.kuotaTersedia}`
      }
      return `- ${p.namaPaket}: ${formatRupiahServer(p.hargaEfektif)}/24 jam, kuota tersedia ${p.kuotaTersedia}`
    })

    return {
      reply: `Ini pilihan paket dan bundel yang tersedia di Merayau Adventure${daysText} kak:\n${lines.join('\n')}\n\nLangsung klik "+ Daftar Sewa" aja kalau mau masukin ke estimasi sewa.`,
      intent: 'paket',
      outOfScope: false,
      suggestions: ['Cara pesan paket', 'Cek promo aktif', 'Syarat jaminan sewa'],
      alatCards: [],
      paketCards: chosenPkgs,
      tripCards: [],
      actions: hasCartItems
        ? [{ type: 'open_cart', label: 'Buka Daftar Sewa' }]
        : [{ type: 'route', label: 'Lihat Semua di Katalog', to: '/katalog' }],
    }
  }

  // 7. Capacity / People Count or Recommendations for beginners / groups / camping
  const isRecommendationIntent =
    peopleCount !== null ||
    asksCheapest ||
    hasAnyPhraseIn(variants, [
      'rekomendasi',
      'rekomen',
      'pemula',
      'solo',
      'berdua',
      'rombongan',
      'grup',
      'camping',
      'naik gunung',
      'butuh apa',
      'bawa apa',
      'persiapan',
    ])

  if (isRecommendationIntent && scoredAlat.length === 0) {
    if (asksCheapest) {
      const cheapAlat = [...snapshot.alat]
        .filter((a) => a.stokTersedia > 0)
        .sort((a, b) => a.hargaEfektif - b.hargaEfektif)
        .slice(0, 4)
      const cheapPkgs = [...snapshot.packages]
        .filter((p) => p.kuotaTersedia > 0)
        .sort((a, b) => a.hargaEfektif - b.hargaEfektif)
        .slice(0, 2)
      return {
        reply: `Kalau cari yang paling hemat, ini beberapa alat dan paket dengan tarif paling terjangkau kak. Jangan lupa kalau sewa minimal ${snapshot.aturan.minHariPromo} hari otomatis dapat diskon ${snapshot.aturan.diskonPersen}% juga ya.`,
        intent: 'rekomendasi',
        outOfScope: false,
        suggestions: ['Cek stok tenda', 'Lihat paket bundel', 'Cara pesan alat'],
        alatCards: cheapAlat,
        paketCards: cheapPkgs,
        tripCards: [],
        actions: [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
      }
    }

    const recPkgs = snapshot.packages.filter((p) => p.kuotaTersedia > 0).slice(0, 2)
    const recAlat: ChatbotAlatCard[] = []

    const tentCandidates = snapshot.alat.filter(
      (a) =>
        a.stokTersedia > 0 &&
        a.namaKategori.toLowerCase().includes('tenda') &&
        !a.namaAlat.toLowerCase().includes('footprint') &&
        !a.namaAlat.toLowerCase().includes('alas'),
    )
    if (tentCandidates.length) {
      let bestTent = tentCandidates[0]!
      if (peopleCount && peopleCount >= 4) {
        bestTent =
          tentCandidates.find((t) => /4|5|6/.test(t.namaAlat)) ?? tentCandidates[0]!
      } else if (peopleCount && peopleCount <= 2) {
        bestTent =
          tentCandidates.find((t) => /2/.test(t.namaAlat)) ?? tentCandidates[0]!
      }
      recAlat.push(bestTent)
    }

    for (const kw of ['carrier', 'sleeping', 'masak', 'lampu']) {
      const found = snapshot.alat.find(
        (a) =>
          a.stokTersedia > 0 &&
          (a.namaAlat.toLowerCase().includes(kw) || a.namaKategori.toLowerCase().includes(kw)) &&
          !recAlat.some((r) => r.id === a.id),
      )
      if (found) recAlat.push(found)
      if (recAlat.length >= 3) break
    }

    const peopleLabel = peopleCount ? `buat ${peopleCount} orang` : 'untuk pendakian atau camping'
    return {
      reply: `Kalau ${peopleLabel}, perlengkapan wajibnya biasanya tenda, carrier, sleeping bag, dan alat masak atau lampu kak. Ini rekomendasi stok yang siap disewa sekarang${recPkgs.length ? ' (plus paket bundel biar lebih hemat)' : ''}:`,
      intent: 'rekomendasi',
      outOfScope: false,
      suggestions: ['Lihat paket bundel', `Sewa ${snapshot.aturan.minHariPromo} hari`, 'Cara pesan alat'],
      alatCards: recAlat,
      paketCards: recPkgs,
      tripCards: [],
      actions: [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
    }
  }

  // 8. Specific Gear / Category Match
  if (scoredAlat.length > 0 || scoredPakets.length > 0) {
    let candidateAlat = scoredAlat.map((x) => x.item)
    if (peopleCount && candidateAlat.length > 1) {
      const capFiltered = candidateAlat.filter((a) => {
        if (peopleCount >= 4) return /4|5|6/.test(a.namaAlat)
        if (peopleCount <= 2) return /1|2/.test(a.namaAlat)
        return /2|3|4/.test(a.namaAlat)
      })
      if (capFiltered.length) {
        candidateAlat = capFiltered
      }
    }
    if (asksCheapest) {
      candidateAlat = [...candidateAlat].sort((a, b) => a.hargaEfektif - b.hargaEfektif)
    }

    const topAlat = candidateAlat.slice(0, 4)
    const topPakets = scoredPakets.slice(0, 2).map((x) => x.pkg)

    const summaryLines: string[] = []
    for (const item of topAlat) {
      const stokText = item.stokTersedia > 0 ? `tersedia ${item.stokTersedia} unit` : 'stok habis'
      if (requestedDays) {
        const calc = computeDiscountedForDays(
          item.hargaEfektif,
          requestedDays,
          snapshot.aturan.minHariPromo,
          snapshot.aturan.diskonPersen,
        )
        const discText =
          calc.discount > 0 ? ` (sudah termasuk diskon ${snapshot.aturan.diskonPersen}%)` : ''
        summaryLines.push(
          `- ${item.namaAlat} [${item.kodeAlat}]: ${formatRupiahServer(item.hargaEfektif)}/24 jam, estimasi ${requestedDays} hari ${formatRupiahServer(calc.total)}${discText}, ${stokText}`,
        )
      } else {
        summaryLines.push(
          `- ${item.namaAlat} [${item.kodeAlat}]: ${formatRupiahServer(item.hargaEfektif)}/24 jam, ${stokText}`,
        )
      }
    }

    for (const pkg of topPakets) {
      summaryLines.push(
        `- Paket ${pkg.namaPaket}: ${formatRupiahServer(pkg.hargaEfektif)}/24 jam, kuota ${pkg.kuotaTersedia}`,
      )
    }

    return {
      reply: `Ini stok yang mimin temukan di Merayau Adventure kak:\n${summaryLines.join('\n')}\n\nLangsung klik "+ Daftar Sewa" pada kartu di bawah kalau mau dimasukkan ke hitungan sewa ya.`,
      intent: 'cari_alat',
      outOfScope: false,
      suggestions: [
        requestedDays ? 'Lihat paket bundel' : `Kalau ${snapshot.aturan.minHariPromo} hari berapa?`,
        'Yang paling murah?',
        'Cara pesan alat',
      ],
      alatCards: topAlat,
      paketCards: topPakets,
      tripCards: [],
      actions: hasCartItems
        ? [{ type: 'open_cart', label: 'Buka Daftar Sewa' }]
        : [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
    }
  }

  // 9. General Catalog / Price List / Availability Query
  if (
    hasAnyPhraseIn(variants, [
      'katalog',
      'daftar alat',
      'semua alat',
      'list alat',
      'apa saja',
      'disewakan',
      'stok',
      'harga',
      'sewa',
      'alat',
      'perlengkapan',
      'gear',
      'barang',
    ])
  ) {
    const catSummary = snapshot.categories
      .map((c) => `${c.namaKategori} (${c.jumlahAlat} jenis)`)
      .join(', ')
    const highlightAlat = snapshot.alat.filter((a) => a.stokTersedia > 0).slice(0, 4)

    return {
      reply: [
        `Di Merayau Adventure ada ${snapshot.alat.length} jenis perlengkapan aktif kak: ${catSummary}.`,
        'Sebutin aja alat yang lagi dicari (misalnya tenda, carrier, kompor, headlamp, atau sepatu), atau langsung klik item di bawah ini:',
      ].join('\n'),
      intent: 'katalog_umum',
      outOfScope: false,
      suggestions: ['Cek stok tenda', 'Cek stok carrier', 'Lihat paket bundel', 'Cek promo aktif'],
      alatCards: highlightAlat,
      paketCards: [],
      tripCards: [],
      actions: [{ type: 'route', label: 'Buka Katalog Lengkap', to: '/katalog' }],
    }
  }

  // 10. Strict Out-of-Scope Guardrail
  return buildOutOfScopeResponse(waAdminUrl)
}

function buildOutOfScopeResponse(waAdminUrl: string): ChatbotResponse {
  return {
    reply:
      'Waduh, soal itu di luar info basecamp nih kak. Mimin di sini khusus bantu cek stok dan harga alat gunung, paket bundel, open trip, aturan sewa, sampai susun pesanan ke WhatsApp Merayau Adventure Pontianak. Lagi cari perlengkapan atau jadwal trip apa kak?',
    intent: 'out_of_scope',
    outOfScope: true,
    suggestions: [
      'Cek stok tenda',
      'Lihat paket bundel',
      'Jadwal open trip',
      'Aturan & cara sewa',
    ],
    alatCards: [],
    paketCards: [],
    tripCards: [],
    actions: [{ type: 'wa_link', label: 'Chat Admin WhatsApp', url: waAdminUrl }],
  }
}
