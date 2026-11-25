<script setup lang="ts">
import type { FanSlideCard, FanTripGroup } from '~/components/public/FanTripGallery.vue'
import type { GoogleReviewItem } from '~/components/public/TestimonialsMarquee.vue'
import type { PublicTripItem } from '~/components/public/TripDetailModal.vue'

interface PublicPromoInfo {
  id: number
  namaPromo: string
  label: string
  targetTipe?: string
  targetId?: number | null
  tipePotongan: 'persen' | 'nominal'
  nilaiPotongan: number
  hematNominal?: number
}

interface UpcomingPromoBadge {
  id: number
  namaPromo: string
  label: string
  tipePotongan: 'persen' | 'nominal'
  nilaiPotongan: number
  tanggalMulai: string | null
  tanggalSelesai: string | null
}

interface PublicAlatItem {
  id: number
  kodeAlat: string
  idKategori: number
  namaKategori: string
  namaAlat: string
  spesifikasi: string
  hargaHarian: number
  hargaEfektif: number
  promoAktif: PublicPromoInfo | null
  upcomingPromo?: UpcomingPromoBadge | null
  stokTotal: number
  stokDisewa: number
  stokTersedia: number
  kondisi: string
  fotoUrl: string
  isShowcase: boolean
  tarifNote: string
}

interface PublicCategory {
  id: number
  namaKategori: string
  jumlahAlat: number
}

interface PublicPackage {
  id: number
  namaPaket: string
  tipePaket: 'paket' | 'bundle'
  deskripsi: string
  labelPromo: string
  diskonPersen: number
  totalNormal: number
  tarifPaket: number
  hargaEfektif: number
  promoAktif: PublicPromoInfo | null
  upcomingPromo?: UpcomingPromoBadge | null
  kuotaTersedia: number
  fotoUrl: string
  items: Array<{
    idAlat: number
    kodeAlat: string
    namaAlat: string
    namaKategori: string
    jumlah: number
    hargaHarian: number
    stokTersedia: number
  }>
}

interface LandingPayload {
  alat: PublicAlatItem[]
  categories: PublicCategory[]
  packages: PublicPackage[]
  promos?: PublicPromoRule[]
  trips: PublicTripItem[]
  aturan: PublicAturan
  stats: {
    totalAlatAktif: number
    totalStokUnit: number
    totalKategori: number
    diskonPromoPersen: number
    minHariPromo: number
    hargaPaketMulai: number
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

const { data, pending, error, refresh } = await useFetch<LandingPayload>('/api/public/landing')
const cart = usePublicCart()
const pageRoot = ref<HTMLElement | null>(null)
const { activeSection } = useScrollReveal(pageRoot, {
  sectionIds: ['profil-merayau', 'open-trip', 'aturan-sewa', 'kontak'],
})

useHead(() => ({
  title: 'Merayau Adventure · Perlengkapan Gunung & Open Trip Pontianak',
  meta: [
    {
      name: 'description',
      content:
        'Sewa perlengkapan camping, tenda, carrier, alat masak, dan open trip gunung terpercaya di Basecamp Merayau Adventure Pontianak.',
    },
  ],
}))

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

const stats = computed(
  () =>
    data.value?.stats ?? {
      totalAlatAktif: 58,
      totalStokUnit: 500,
      totalKategori: 6,
      diskonPromoPersen: 10,
      minHariPromo: 3,
      hargaPaketMulai: 49000,
    },
)

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

// Section 01c scroll count-up metrics (initialized to real SSR values)
const metricsRef = ref<HTMLElement | null>(null)
const metricAnimStarted = ref(false)
const metricAnimDone = ref(false)
const metricYear = ref(2019)
const metricStok = ref(stats.value.totalStokUnit)
const metricPromo = ref(aturan.value.diskonPersen)
const metricBundel = ref(30)

watch(
  [stats, aturan],
  ([s, a]) => {
    if (!metricAnimStarted.value || metricAnimDone.value) {
      metricStok.value = s.totalStokUnit
      metricPromo.value = a.diskonPersen
    }
  },
  { immediate: true },
)

let metricIo: IntersectionObserver | null = null
let metricRaf: number | null = null

function startMetricCountUp() {
  if (metricAnimStarted.value) return
  metricAnimStarted.value = true

  const targetStok = stats.value.totalStokUnit
  const targetPromo = aturan.value.diskonPersen
  const startTime = performance.now()
  const duration = 850

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    metricYear.value = Math.round(2005 + (2019 - 2005) * eased)
    metricStok.value = Math.round(targetStok * eased)
    metricPromo.value = Math.round(targetPromo * eased)
    metricBundel.value = Math.round(30 * eased)

    if (t < 1) {
      metricRaf = requestAnimationFrame(step)
    } else {
      metricYear.value = 2019
      metricStok.value = stats.value.totalStokUnit
      metricPromo.value = aturan.value.diskonPersen
      metricBundel.value = 30
      metricAnimDone.value = true
      metricRaf = null
    }
  }
  metricRaf = requestAnimationFrame(step)
}

onMounted(() => {
  if (!metricsRef.value) return
  metricIo = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        startMetricCountUp()
        metricIo?.disconnect()
        metricIo = null
      }
    },
    { threshold: 0.25 },
  )
  metricIo.observe(metricsRef.value)
})

onBeforeUnmount(() => {
  metricIo?.disconnect()
  metricIo = null
  if (metricRaf !== null) {
    cancelAnimationFrame(metricRaf)
    metricRaf = null
  }
})

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

// Section 01d Fan Gallery groups: each mountain trip has its own 5-photo fan set
const MOUNTAIN_GALLERY_SETS: Array<{
  match: string
  id: string
  judul: string
  tags: string[]
  photos: Array<{ src: string; label: string; tag: string }>
}> = [
  {
    match: 'prau',
    id: 'trip-prau',
    judul: 'Gunung Prau via Patak Banteng',
    tags: ['Dieng · 2.565 MDPL', 'Favorit Pemula'],
    photos: [
      { src: '/images/landing/hero-hikers.png', label: 'Pendakian Jalur Patak Banteng', tag: 'Tim Merayau' },
      { src: '/images/landing/gear-tnd-07.png', label: 'Camp Area Puncak Prau', tag: 'Dome 2-3 Org' },
      { src: '/images/landing/trip-prau.png', label: 'Sunrise Golden Hour Prau', tag: 'Dieng · 2.565 MDPL' },
      { src: '/images/landing/gear-cok-01.png', label: 'Sarapan Hangat di Camp', tag: 'Logistik Trip' },
      { src: '/images/landing/store-pontianak.jpg', label: 'Persiapan Basecamp Pontianak', tag: 'Fitting H-1' },
    ],
  },
  {
    match: 'merbabu',
    id: 'trip-merbabu',
    judul: 'Merbabu via Selo (2D1N)',
    tags: ['Boyolali · 3.145 MDPL', 'Sabana Terbuka'],
    photos: [
      { src: '/images/landing/gear-crr-01.png', label: 'Carrier Ekspedisi Sabana', tag: 'Carrier 50-60L' },
      { src: '/images/landing/paket-tektok.png', label: 'Perlengkapan Tim Merbabu', tag: 'Siap Berangkat' },
      { src: '/images/landing/trip-merbabu.png', label: 'Jalur Sabana Merbabu via Selo', tag: 'Boyolali · 3.145 MDPL' },
      { src: '/images/landing/gear-trk-01.png', label: 'Jalur Berbatu & Punggungan', tag: 'Trekking Gear' },
      { src: '/images/landing/extra-fan-1.png', label: 'Dokumentasi Tim Sabana', tag: 'Arsip Ekspedisi' },
    ],
  },
  {
    match: 'lawu',
    id: 'trip-lawu',
    judul: 'Gunung Lawu via Cetho',
    tags: ['Karanganyar · 3.265 MDPL', 'Jalur Klasik'],
    photos: [
      { src: '/images/landing/gear-tnd-01.png', label: 'Basecamp Tenda Rombongan', tag: 'Double Layer' },
      { src: '/images/landing/gear-lmp-05.png', label: 'Summit Attack Dini Hari', tag: 'Lampu & Power' },
      { src: '/images/landing/trip-lawu.png', label: 'Hutan Cemara Lawu via Cetho', tag: 'Karanganyar · 3.265 MDPL' },
      { src: '/images/landing/extra-fan-2.jpg', label: 'Punggungan Candi Cetho', tag: 'Arsip Ekspedisi' },
      { src: '/images/landing/hero-hikers.png', label: 'Tim Puncak Hargo Dumilah', tag: '3.265 MDPL' },
    ],
  },
]

const fanTripGroups = computed<FanTripGroup[]>(() => {
  const liveTrips = data.value?.trips ?? []
  const groups: FanTripGroup[] = []

  for (const t of liveTrips) {
    const lower = t.judul.toLowerCase()
    const preset = MOUNTAIN_GALLERY_SETS.find((p) => lower.includes(p.match))
    const customPhotos: Array<{ src: string; label: string; tag: string }> = []
    if (t.fotoUrl) {
      customPhotos.push({ src: t.fotoUrl, label: t.judul, tag: t.detail?.elevation || t.lokasi })
    }
    for (const g of t.detail?.gallery ?? []) {
      const clean = g?.trim()
      if (clean && !customPhotos.some((x) => x.src === clean)) {
        customPhotos.push({ src: clean, label: t.judul, tag: t.lokasi })
      }
    }

    const basePreset = preset?.photos ?? MOUNTAIN_GALLERY_SETS[groups.length % MOUNTAIN_GALLERY_SETS.length]!.photos
    const combined = [...customPhotos]
    for (const p of basePreset) {
      if (combined.length >= 5) break
      if (!combined.some((x) => x.src === p.src)) {
        combined.push(p)
      }
    }
    while (combined.length < 5) {
      combined.push(basePreset[combined.length % basePreset.length]!)
    }

    // Put hero photo at center index 2 when using preset/gallery
    const five = combined.slice(0, 5)
    if (customPhotos.length === 1 && preset) {
      const heroIdx = preset.photos.findIndex((p) => p.src === preset.photos[2]?.src)
      if (heroIdx !== -1 && preset.photos.length === 5) {
        five.splice(0, 5, ...preset.photos)
        five[2] = { src: t.fotoUrl || preset.photos[2]!.src, label: t.judul, tag: t.detail?.elevation || t.lokasi }
      }
    }

    groups.push({
      id: `trip-${t.id}`,
      judul: t.judul,
      tags: [t.detail?.elevation || t.lokasi, `${t.durasi} · ${formatCompactRupiah(t.hargaMulai)}`],
      tripId: t.id,
      cards: five.map((p, idx) => ({
        id: `trip-${t.id}-card-${idx}`,
        src: p.src,
        label: p.label,
        tags: [p.tag],
        tripId: t.id,
      })),
    })
  }

  // Ensure at least the 3 distinct mountain trips are always browsable
  for (const preset of MOUNTAIN_GALLERY_SETS) {
    const alreadyHas = groups.some((g) => g.judul.toLowerCase().includes(preset.match))
    if (!alreadyHas) {
      groups.push({
        id: preset.id,
        judul: preset.judul,
        tags: preset.tags,
        tripId: liveTrips[0]?.id,
        cards: preset.photos.map((p, idx) => ({
          id: `${preset.id}-card-${idx}`,
          src: p.src,
          label: p.label,
          tags: [p.tag],
          tripId: liveTrips[0]?.id,
        })),
      })
    }
  }

  return groups
})

// Section 02 + 02b Trips & Navigation to Trip Booking Page
const trips = computed(() => data.value?.trips ?? [])

const choreographyImages = computed(() => ({
  topLeft: trips.value[1]?.fotoUrl || '/images/landing/trip-prau.png',
  topRight: trips.value[0]?.fotoUrl || '/images/landing/trip-merbabu.png',
  bottomLeft: trips.value[2]?.fotoUrl || '/images/landing/trip-lawu.png',
  bottomRight: '/images/landing/gear-tnd-07.png',
}))

const choreographyLabels = computed(() => ({
  topLeft: {
    title: trips.value[1]?.judul || 'Gunung Prau via Patak Banteng',
    subtitle: trips.value[1]?.detail?.elevation || '2.565 MDPL · Dieng',
  },
  topRight: {
    title: trips.value[0]?.judul || 'Merbabu via Selo (2D1N)',
    subtitle: trips.value[0]?.detail?.elevation || '3.145 MDPL · Boyolali',
  },
  bottomLeft: {
    title: trips.value[2]?.judul || 'Gunung Lawu via Cetho',
    subtitle: trips.value[2]?.detail?.elevation || '3.265 MDPL · Karanganyar',
  },
  bottomRight: {
    title: 'Camp Ridge & Gear Merayau',
    subtitle: 'Perlengkapan Pendakian Lengkap',
  },
}))

function openTripById(tripId: number) {
  navigateTo(`/trip/${tripId}`)
}

// Section 02b Gallery4 horizontal carousel
const tripCarouselRef = ref<HTMLElement | null>(null)
const activeCarouselSlide = ref(0)
const canScrollPrev = ref(false)
const canScrollNext = ref(true)

function updateCarouselBounds() {
  const el = tripCarouselRef.value
  if (!el) return
  canScrollPrev.value = el.scrollLeft > 8
  canScrollNext.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 8
}

function scrollTripCarousel(dir: -1 | 1) {
  const el = tripCarouselRef.value
  if (!el) return
  const cardWidth = el.clientWidth >= 768 ? 380 : 310
  el.scrollBy({ left: dir * cardWidth, behavior: 'smooth' })
}

function goToCarouselSlide(idx: number) {
  const el = tripCarouselRef.value
  if (!el) return
  const cardWidth = el.clientWidth >= 768 ? 380 : 310
  el.scrollTo({ left: idx * cardWidth, behavior: 'smooth' })
  activeCarouselSlide.value = idx
}

function onCarouselScroll() {
  const el = tripCarouselRef.value
  if (!el) return
  const cardWidth = el.clientWidth >= 768 ? 380 : 310
  activeCarouselSlide.value = Math.min(
    Math.max(0, trips.value.length - 1),
    Math.round(el.scrollLeft / Math.max(1, cardWidth)),
  )
  updateCarouselBounds()
}

onMounted(() => {
  nextTick(updateCarouselBounds)
})

// Section 03 Active Paket Tektok switcher
const packages = computed(() => data.value?.packages ?? [])
const activePackageIdx = ref(0)
const currentPackage = computed(() => packages.value[activePackageIdx.value] ?? packages.value[0] ?? null)

function packageWaUrl(pkg: PublicPackage) {
  const list = pkg.items.map((it) => `- ${it.jumlah}x ${it.namaAlat}`).join('\n')
  const rate = pkg.hargaEfektif ?? pkg.tarifPaket
  return buildWaLink(
    kontak.value.whatsapp,
    `Halo Admin Merayau Adventure, saya mau booking ${pkg.namaPaket} (${formatRupiah(rate)}/24 jam):\n${list}\n\nMohon info stok tersedia ya Admin.`,
  )
}

// Section 04 Marquee items (prioritize Admin uploads & high-res studio renders, max 12 items)
const marqueeItems = computed(() => {
  const all = data.value?.alat ?? []
  const sorted = [...all].sort((a, b) => Number(b.isShowcase) - Number(a.isShowcase))
  return sorted.slice(0, 12)
})

// Section 04b Steppers & 8 Rules
const onlineSteps = [
  {
    title: 'Pilih Alat & Durasi di Katalog Web',
    time: 'Step 01 · Tentukan item atau paket tektok (diskon otomatis min. 3 hari).',
    completed: true,
  },
  {
    title: 'Kirim Daftar Sewa via WhatsApp Admin',
    time: 'Step 02 · Daftar alat terkirim ke Admin untuk validasi stok real-time.',
    completed: true,
  },
  {
    title: 'Bayar DP & Fitting Ukuran H-1',
    time: 'Step 03 · Amankan slot dengan DP; sepatu & jaket wajib dicoba maks. H-1.',
    completed: true,
  },
  {
    title: 'Pengambilan & Jaminan Identitas Asli',
    time: 'Step 04 · Cek kelengkapan alat di basecamp & serahkan KTP/SIM/KTM asli.',
    completed: false,
  },
  {
    title: 'Pengembalian Alat & Riwayat Selesai',
    time: 'Step 05 · Kembalikan tepat waktu agar dicek admin & status tercatat selesai.',
    completed: false,
  },
]

const offlineSteps = [
  {
    title: 'Datang ke Basecamp Pontianak',
    time: 'Step 01 · Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b, setiap hari 08.00 - 21.00.',
    completed: true,
  },
  {
    title: 'Pilih & Fitting Barang Langsung',
    time: 'Step 02 · Pilih tenda, carrier, sepatu gunung, atau jaket sesuai ukuran pas.',
    completed: true,
  },
  {
    title: 'Cek Kondisi & Konfirmasi Tim',
    time: 'Step 03 · Tim basecamp mengecek fungsi barang bersama penyewa ke sistem.',
    completed: true,
  },
  {
    title: 'Pembayaran & Jaminan Identitas',
    time: 'Step 04 · Bayar lunas atau DP serta titipkan identitas asli (KTP/SIM/KTM).',
    completed: false,
  },
  {
    title: 'Pengembalian Tepat Waktu',
    time: 'Step 05 · Kembalikan alat dalam kondisi lengkap sesuai tanggal kembali.',
    completed: false,
  },
]

const rentalRules = computed(() => [
  {
    id: 'rule-1',
    tone: 'info',
    title: '1. Waktu Sewa & Toleransi Pengembalian',
    desc: `Sewa dihitung per ${aturan.value.durasiMinimalJam} jam. Toleransi keterlambatan maksimal ${aturan.value.toleransiTelatJam} jam; lewat batas dikenakan denda ${aturan.value.dendaPersenHarian}% dari tarif harian.`,
  },
  {
    id: 'rule-2',
    tone: 'info',
    title: '2. Reservasi Online & Fitting Ukuran H-1',
    desc: 'Booking bisa lewat web/WA atau langsung ke store. Item ukuran (sepatu, jaket, celana) wajib fitting maksimal H-1 agar pas saat berangkat.',
  },
  {
    id: 'rule-3',
    tone: 'good',
    title: '3. Jaminan Identitas Asli Wajib',
    desc: 'Penyewa wajib meninggalkan 1 identitas asli yang masih berlaku (KTP, SIM, atau KTM) selama masa sewa dan dikembalikan setelah alat diterima kembali.',
  },
  {
    id: 'rule-4',
    tone: 'good',
    title: '4. Pemeriksaan Saat Pengambilan',
    desc: 'Wajib memeriksa kelengkapan frame, pasak, resleting, dan fungsi alat bersama admin sebelum keluar basecamp. Barang yang dibawa dianggap lengkap.',
  },
  {
    id: 'rule-5',
    tone: 'warn',
    title: '5. Pengembalian Tepat Waktu & Lengkap',
    desc: 'Kembalikan seluruh unit tepat waktu dalam kondisi kering/bersih wajar. Komponen yang tertinggal tetap terhitung sewa berjalan hingga dikembalikan.',
  },
  {
    id: 'rule-6',
    tone: 'warn',
    title: '6. Penggunaan Sesuai Fungsi Gunung',
    desc: 'Gunakan perlengkapan sesuai peruntukannya. Dilarang memasak di dalam inner tenda, memotong tali guyline, atau memakai kompor di permukaan tidak stabil.',
  },
  {
    id: 'rule-7',
    tone: 'bad',
    title: '7. Kerusakan atau Kehilangan Barang',
    desc: 'Penyewa bertanggung jawab penuh atas kerusakan berat (frame patah, kain sobek terbakar) maupun kehilangan item dengan biaya perbaikan atau penggantian.',
  },
  {
    id: 'rule-8',
    tone: 'bad',
    title: '8. Kebijakan Pembatalan Booking',
    desc: 'Pembatalan mendadak sepihak setelah konfirmasi jadwal dapat menyebabkan uang muka (DP) yang telah dibayarkan tidak dapat dikembalikan.',
  },
])

const dismissedRuleIds = ref<string[]>([])
const visibleRentalRules = computed(() =>
  rentalRules.value.filter((r) => !dismissedRuleIds.value.includes(r.id)),
)

function dismissRule(id: string) {
  if (!dismissedRuleIds.value.includes(id)) {
    dismissedRuleIds.value.push(id)
  }
}

function resetRules() {
  dismissedRuleIds.value = []
}

// Section 05 Validated Contact Form -> opens structured WhatsApp
const contactForm = reactive({
  nama: '',
  wa: '',
  email: '',
  topik: 'Tanya sewa perlengkapan',
  pesan: '',
})
const contactError = ref('')
const contactSent = ref(false)

// Section 06 Real Google Maps Reviews (Merayau Adventure Pontianak)
const googleMapsReviewsUrl =
  'https://www.google.com/maps/place/Merayau+Adventure/@-0.0542884,109.3679072,17z/data=!4m8!3m7!1s0x2e1d59b3bc309edb:0xc97cb30e1afcf554!8m2!3d-0.0542884!4d109.3704821!9m1!1b1!16s%2Fg%2F11t_thvnfy?entry=ttu'

const googleReviews: GoogleReviewItem[] = [
  {
    name: 'Rezki Mahdar',
    handle: '1 ulasan · 1 foto',
    description: 'Ramah baik dan tidak mengecewakan pelanggan',
    timeLabel: '8 bulan lalu',
    reply: 'Terimakasih ulasan positif nyaa',
  },
  {
    name: 'Super Murni CV. Sinar Abadi Tirta',
    handle: '1 ulasan · Google Maps',
    description: 'Mudah di akses dn orang nya ramah ramah',
    timeLabel: '8 bulan lalu',
    reply: 'Terimakasih ulasan positif nya',
  },
  {
    name: 'blink The Limit',
    handle: '2 ulasan · 2 foto',
    description: 'Lengkap, dan happy bgt bisa camping bersama teman',
    timeLabel: '7 bulan lalu',
  },
  {
    name: 'retno enoxii',
    handle: 'Local Guide · 63 ulasan',
    description: 'tempat sewa tenda',
    timeLabel: '5 bulan lalu',
  },
  {
    name: 'deameria sihombing',
    handle: '11 ulasan · 3 foto',
    description: 'eh salah min kmek kire ini wangkang',
    timeLabel: '9 bulan lalu',
  },
]

function submitContactForm() {
  contactError.value = ''
  contactSent.value = false

  if (contactForm.nama.trim().length < 2) {
    contactError.value = 'Mohon isi nama lengkap minimal 2 karakter.'
    return
  }
  const waClean = contactForm.wa.trim()
  if (!/^(\+?62|0)[0-9]{8,14}$/.test(waClean)) {
    contactError.value = 'Nomor WhatsApp harus diawali 08, 62, atau +62 tanpa spasi.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email.trim())) {
    contactError.value = 'Format email tidak valid.'
    return
  }
  if (contactForm.pesan.trim().length < 6) {
    contactError.value = 'Tuliskan pertanyaan atau kebutuhan alat/trip kamu minimal 6 karakter.'
    return
  }

  const msg = [
    `Halo Admin Merayau Adventure Pontianak,`,
    `*Topik:* ${contactForm.topik}`,
    `*Nama:* ${contactForm.nama.trim()}`,
    `*No. WA:* ${waClean}`,
    `*Email:* ${contactForm.email.trim()}`,
    '',
    `*Pesan:*`,
    contactForm.pesan.trim(),
  ].join('\n')

  const url = buildWaLink(kontak.value.whatsapp, msg)
  contactSent.value = true
  if (import.meta.client) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
</script>

<template>
  <div ref="pageRoot" class="mry-public min-h-screen bg-white text-[#121613]">
    <PublicNavbar
      :total-alat="stats.totalAlatAktif"
      :whatsapp="kontak.whatsapp"
      :active-section="activeSection"
    />

    <!-- Error / Loading State -->
    <div
      v-if="error && !data"
      class="mx-auto my-8 max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
    >
      <div class="text-base font-semibold text-red-800">Gagal memuat data live dari server</div>
      <p class="mt-1 text-sm text-red-700">Pastikan koneksi database aktif lalu muat ulang halaman.</p>
      <button
        type="button"
        class="mt-4 min-h-[44px] cursor-pointer rounded-full bg-[#1E4D36] px-5 text-sm font-semibold text-white"
        @click="refresh()"
      >
        Muat Ulang Data
      </button>
    </div>

    <main>
      <!-- 01 · BRIGHT ALPINE HERO -->
      <section class="relative overflow-hidden bg-white pt-7 pb-0 sm:pt-14 lg:min-h-[540px]">
        <!-- Subtle pale topographic contour background with gentle scroll depth -->
        <svg
          data-parallax-top="0.32"
          class="mry-parallax-layer pointer-events-none absolute inset-0 h-full w-full opacity-55"
          viewBox="0 0 1440 680"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path d="M-60 540 C 210 470, 390 360, 620 410 C 890 470, 1080 260, 1500 320" stroke="#E5E0D5" stroke-width="1.3" />
          <path d="M-80 460 C 180 390, 410 270, 660 330 C 920 395, 1140 180, 1520 250" stroke="#E5E0D5" stroke-width="1.2" />
          <path d="M-40 370 C 250 300, 460 190, 710 245 C 960 300, 1180 110, 1510 175" stroke="#E5E0D5" stroke-width="1.1" />
          <path d="M-30 270 C 260 210, 490 110, 750 165 C 1020 220, 1210 40, 1520 95" stroke="#E5E0D5" stroke-width="1" />
          <path d="M120 620 C 370 550, 560 470, 820 510 C 1080 550, 1260 390, 1520 430" stroke="#E5E0D5" stroke-width="1" />
        </svg>

        <div class="mx-auto grid max-w-[1280px] items-center gap-6 px-4 sm:gap-8 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-8">
          <div class="relative z-10 min-w-0 pb-4 sm:pb-6 lg:col-span-6 lg:pb-16">
            <p
              data-reveal
              style="--reveal-delay: 0ms"
              class="mry-mono text-xs font-medium tracking-[0.14em] text-[#1E4D36] uppercase"
            >
              Elevated Adventure · Est. 2019 · Pontianak
            </p>
            <h1
              data-reveal
              style="--reveal-delay: 90ms"
              class="mry-serif mt-3 text-[32px] leading-[1.1] font-semibold text-[#121613] sm:mt-4 sm:text-5xl lg:text-[54px]"
            >
              Perlengkapan gunung &amp; open trip dari Pontianak
            </h1>
            <p
              data-reveal
              style="--reveal-delay: 180ms"
              class="mt-4 max-w-lg text-sm leading-relaxed text-[#2E3530] sm:mt-5 sm:text-lg"
            >
              Stok alat pendakian siap pakai per {{ aturan.durasiMinimalJam }} jam di Basecamp Tanjung Raya 2, paket bundel siap berangkat, serta open trip terjadwal dengan kuota live dari sistem admin.
            </p>

            <div
              data-reveal
              style="--reveal-delay: 270ms"
              class="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5"
            >
              <NuxtLink
                to="/katalog"
                class="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#1E4D36] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#163B29] sm:w-auto"
              >
                Lihat {{ stats.totalAlatAktif }} Alat Sewa
              </NuxtLink>
              <a
                href="#open-trip"
                class="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-[#121613]/25 bg-white px-6 text-sm font-semibold text-[#121613] transition-colors hover:border-[#121613] hover:bg-[#F5F2EB] sm:w-auto"
              >
                Jadwal Open Trip
              </a>
            </div>
          </div>

          <div class="-mx-4 flex min-w-0 justify-center sm:-mx-6 lg:static lg:col-span-6 lg:mx-0">
            <div
              data-reveal-media
              style="--reveal-delay: 150ms"
              class="flex w-full justify-center lg:pointer-events-none lg:absolute lg:right-0 lg:bottom-0 lg:block lg:w-auto"
            >
              <img
                data-parallax-top="0.14"
                src="/images/landing/hero-hikers.png"
                alt="Pendaki membawa perlengkapan gunung Merayau Adventure"
                class="mry-parallax-layer mx-auto block max-h-[420px] w-full max-w-[460px] object-contain object-bottom mix-blend-multiply sm:max-h-[480px] sm:max-w-[520px] lg:mx-0 lg:max-h-[540px] lg:w-auto lg:max-w-[48vw] lg:object-right-bottom"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 01b · PROFIL MERAYAU ADVENTURE PONTIANAK (Hero04 Collage + Sage Editorial Band) -->
      <section
        id="profil-merayau"
        class="overflow-x-clip border-y border-[#7E9F6A] bg-[#93B47E] py-12 text-[#121613] sm:py-20"
      >
        <div class="mx-auto grid max-w-[1280px] items-center gap-8 px-4 sm:gap-12 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div class="min-w-0 space-y-5 lg:col-span-6">
            <span
              data-reveal
              style="--reveal-delay: 0ms"
              class="mry-mono inline-flex rounded-full border border-[#121613]/25 bg-white/80 px-3.5 py-1 text-xs font-semibold tracking-wider text-[#121613] uppercase"
            >
              Profil Basecamp Pontianak
            </span>
            <h2
              data-reveal
              style="--reveal-delay: 90ms"
              class="mry-serif text-3xl leading-tight font-semibold text-[#121613] sm:text-4xl"
            >
              Merayau Adventure
              <span class="block text-[#1B2D1E]">Lengkap, Terawat &amp; Terjangkau.</span>
            </h2>

            <p
              data-reveal
              style="--reveal-delay: 160ms"
              class="text-base leading-relaxed font-medium text-[#162017]"
            >
              Merayau Adventure adalah tempat penyewaan alat camping dan mendaki gunung di Kota Pontianak, berkomitmen memudahkan pendaki menyiapkan perlengkapan berkualitas tanpa harus membeli mahal.
            </p>
            <p
              data-reveal
              style="--reveal-delay: 220ms"
              class="text-sm leading-relaxed text-[#1B261C] sm:text-base"
            >
              Seluruh tenda, carrier, sepatu, jaket, hingga alat masak dicek kondisi fisiknya bersama penyewa saat pengambilan. Stok dan harga di website ini tersambung langsung dengan catatan operasional basecamp.
            </p>

            <div
              data-reveal
              style="--reveal-delay: 280ms"
              class="rounded-2xl border border-[#121613]/20 bg-white/85 p-4 backdrop-blur-xs"
            >
              <div class="mry-mono text-[11px] font-semibold tracking-wider text-[#1E4D36] uppercase">
                Alamat Pengambilan &amp; Pengembalian Alat
              </div>
              <div class="mt-1 text-sm font-semibold text-[#121613]">
                {{ kontak.alamat }}
              </div>
            </div>

            <div
              data-reveal
              style="--reveal-delay: 340ms"
              class="flex flex-wrap gap-3 pt-1"
            >
              <a
                :href="kontak.mapsUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[#121613] px-6 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1E4D36]"
              >
                Buka Google Maps ↗
              </a>
              <NuxtLink
                to="/katalog"
                class="inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#121613]/35 bg-white/90 px-6 text-sm font-semibold text-[#121613] transition-colors hover:bg-white"
              >
                Pilih Perlengkapan
              </NuxtLink>
            </div>
          </div>

          <div class="group relative mx-auto w-full min-w-0 max-w-lg lg:col-span-6">
            <div data-parallax-float="-0.08" class="mry-parallax-layer">
              <div
                data-reveal-clip
                style="--reveal-delay: 120ms"
                class="overflow-hidden rounded-3xl border-4 border-white/85 bg-[#EAE5DA] shadow-xl"
              >
                <img
                  src="/images/landing/store-pontianak.jpg"
                  alt="Basecamp fisik Merayau Adventure di Pontianak"
                  class="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </div>
            </div>
            <div
              data-parallax-float="0.13"
              class="mry-parallax-layer mt-4 sm:absolute sm:-bottom-6 sm:-left-6 sm:mt-0 sm:max-w-[270px]"
            >
              <div
                data-reveal-scale
                style="--reveal-delay: 260ms"
                class="flex items-center gap-3.5 rounded-2xl border border-[#D6D0C4] bg-white p-3.5 shadow-lg transition-transform duration-500 ease-out group-hover:-translate-y-1.5"
              >
                <img
                  src="/images/logo.jpeg"
                  alt="Emblem Merayau Adventure"
                  class="h-14 w-14 shrink-0 rounded-xl border border-[#EAE5DA] object-contain p-1"
                />
                <div>
                  <div class="text-xs font-bold text-[#121613]">Basecamp Tanray 2</div>
                  <div class="text-[11px] leading-snug text-[#5C645E]">
                    Fitting ukuran H-1 · Samping Mr. DIY Tanray 2
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 01c · KETERANGAN RINGKAS 4 KOLOM -->
      <section class="overflow-x-clip border-b border-[#EAE5DA] bg-white py-10 sm:py-14">
        <div ref="metricsRef" class="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div data-reveal-stagger class="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-8 lg:grid-cols-4">
            <div style="--stagger-delay: 0ms" class="mry-stagger-item min-w-0 space-y-1.5 border-l-2 border-[#EAE5DA] pl-3.5 sm:pl-5">
              <div class="mry-mono text-[11px] font-semibold tracking-[0.12em] text-[#1E4D36] uppercase">
                Berdiri Sejak
              </div>
              <div class="mry-serif text-2xl font-semibold text-[#121613] sm:text-3xl">{{ metricYear }}</div>
              <div class="text-sm font-semibold text-[#2E3530] sm:text-base">Basecamp</div>
              <p class="text-xs leading-relaxed text-[#5C645E]">
                Melayani sewa alat camping &amp; perlengkapan mendaki gunung di Kota Pontianak.
              </p>
            </div>

            <div style="--stagger-delay: 90ms" class="mry-stagger-item min-w-0 space-y-1.5 border-l-2 border-[#EAE5DA] pl-3.5 sm:pl-5">
              <div class="mry-mono text-[11px] font-semibold tracking-[0.12em] text-[#1E4D36] uppercase">
                Katalog Live
              </div>
              <div class="mry-serif mry-mono text-2xl font-semibold text-[#121613] sm:text-3xl">
                {{ metricStok }}+
              </div>
              <div class="text-sm font-semibold text-[#2E3530] sm:text-base">
                Unit ({{ stats.totalAlatAktif }} Jenis)
              </div>
              <p class="text-xs leading-relaxed text-[#5C645E]">
                Tenda, carrier, sepatu gunung, cooking set, dan lampu siap disewa.
              </p>
            </div>

            <div style="--stagger-delay: 180ms" class="mry-stagger-item min-w-0 space-y-1.5 border-l-2 border-[#EAE5DA] pl-3.5 sm:pl-5">
              <div class="mry-mono text-[11px] font-semibold tracking-[0.12em] text-[#1E4D36] uppercase">
                Promo Multi-Hari
              </div>
              <div class="mry-serif mry-mono text-2xl font-semibold text-[#121613] sm:text-3xl">
                {{ metricPromo }}%
              </div>
              <div class="text-sm font-semibold text-[#2E3530] sm:text-base">Otomatis</div>
              <p class="text-xs leading-relaxed text-[#5C645E]">
                Diskon langsung di sistem untuk penyewaan durasi minimal {{ aturan.minHariPromo }} hari.
              </p>
            </div>

            <div style="--stagger-delay: 270ms" class="mry-stagger-item min-w-0 space-y-1.5 border-l-2 border-[#EAE5DA] pl-3.5 sm:pl-5">
              <div class="mry-mono text-[11px] font-semibold tracking-[0.12em] text-[#1E4D36] uppercase">
                Paket Tektok
              </div>
              <div class="mry-serif mry-mono text-2xl font-semibold text-[#121613] sm:text-3xl">{{ metricBundel }}%</div>
              <div class="text-sm font-semibold text-[#2E3530] sm:text-base">Lebih Hemat</div>
              <p class="text-xs leading-relaxed text-[#5C645E]">
                Bundel perlengkapan siap jalan mulai {{ formatRupiah(stats.hargaPaketMulai) }} / 24 jam.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 01d · GALERI DOKUMENTASI OPEN TRIP (FanGallery) -->
      <div id="galeri-trip">
        <PublicFanTripGallery :groups="fanTripGroups" @select-trip="openTripById" />
      </div>

      <!-- 02 · BERANGKAT TRIP BERSAMA MERAYAU ADVENTURE (Scroll Choreography Stage + Schedule Ledger) -->
      <section id="open-trip" class="overflow-x-clip bg-white scroll-mt-0">
        <PublicScrollChoreography
          :images="choreographyImages"
          :labels="choreographyLabels"
        >
          <template #top-hud="{ progress }">
            <div
              :style="{ opacity: Math.max(0, Math.min(1, 1 - (progress - 0.56) / 0.14)) }"
              class="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"
            >
              <div>
                <p class="mry-mono text-[11px] font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
                  Ekspedisi Terjadwal · Live Database
                </p>
                <h2 class="mry-serif mt-1 text-2xl leading-tight font-semibold text-[#121613] sm:text-3xl lg:text-4xl">
                  Berangkat Trip Bersama Merayau Adventure
                </h2>
              </div>
              <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                <span class="mry-mono rounded-full border border-[#D6D0C4] bg-[#F5F2EB] px-3 py-1 text-[11px] font-medium text-[#2E3530]">
                  Scroll turun untuk jelajah rute ({{ Math.round(progress * 100) }}%)
                </span>
              </div>
            </div>
          </template>

          <template #hero-overlay="{ progress }">
            <div
              :style="{
                opacity: Math.max(0, Math.min(1, (progress - 0.80) / 0.10)),
                pointerEvents: progress >= 0.82 ? 'auto' : 'none',
              }"
              class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/30 to-transparent px-4 pt-6 pb-8 text-white sm:p-10 lg:p-14"
            >
              <div class="mx-auto flex w-full max-w-[1280px] flex-col justify-between gap-5 sm:flex-row sm:items-end sm:gap-6">
                <div class="min-w-0 max-w-2xl">
                  <p class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#93B47E] uppercase">
                    Destinasi Unggulan · {{ trips[0]?.detail?.elevation || '3.145 MDPL' }} · {{ trips[0]?.lokasi || 'Jawa Tengah' }}
                  </p>
                  <h3 class="mry-serif mt-2 text-2xl leading-tight font-semibold text-white sm:text-5xl">
                    {{ trips[0]?.judul || 'Merbabu via Selo (2D1N)' }}
                  </h3>
                  <p class="mt-2.5 text-sm leading-relaxed text-white/85 sm:text-base">
                    {{ trips[0]?.tanggalBerangkat || 'Jadwal Terbaru' }} · Sisa {{ trips[0]?.sisaKuota ?? 20 }} slot tersedia · Mulai {{ formatRupiah(trips[0]?.hargaMulai ?? 420000) }} (DP 50%)
                  </p>
                </div>

                <div class="flex flex-wrap gap-3">
                  <NuxtLink
                    v-if="trips[0]"
                    :to="`/trip/${trips[0].id}`"
                    class="inline-flex min-h-[46px] items-center rounded-full bg-[#93B47E] px-6 text-sm font-bold text-[#121613] transition-colors hover:bg-[#A6C493]"
                  >
                    Buka Detail {{ trips[0].judul }}
                  </NuxtLink>
                  <a
                    href="#open-trip-ledger"
                    class="inline-flex min-h-[46px] items-center rounded-full border border-white/35 bg-black/40 px-5 text-sm font-semibold text-white backdrop-blur-xs transition-colors hover:bg-white/20"
                  >
                    Lihat Daftar Jadwal ↓
                  </a>
                </div>
              </div>
            </div>
          </template>
        </PublicScrollChoreography>

        <!-- Right-aligned/Full Live Open Trip schedule ledger right below the choreography -->
        <div id="open-trip-ledger" class="border-t border-[#EAE5DA] bg-white py-12 sm:py-16">
          <div class="mx-auto grid max-w-[1280px] items-start gap-8 px-4 sm:gap-10 sm:px-6 lg:grid-cols-12 lg:px-8">
            <div class="min-w-0 lg:col-span-5">
              <p data-reveal style="--reveal-delay: 0ms" class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
                Jadwal Terbuka · Live Database
              </p>
              <h3 data-reveal style="--reveal-delay: 80ms" class="mry-serif mt-2 text-2xl leading-tight font-semibold text-[#121613] sm:text-3xl">
                Pilih Paket &amp; Jadwal Keberangkatan
              </h3>
              <p data-reveal style="--reveal-delay: 140ms" class="mt-3 text-sm leading-relaxed text-[#2E3530] sm:text-base">
                Pilih Paket A, B, atau C sesuai fasilitas yang dibutuhkan. Titik kumpul tersedia sesuai jadwal trip dan booking kursi bisa DP 50%.
              </p>

              <div data-reveal style="--reveal-delay: 220ms" class="mt-6 flex flex-wrap gap-3">
                <NuxtLink
                  v-if="trips[0]"
                  :to="`/trip/${trips[0].id}`"
                  class="inline-flex min-h-[46px] items-center rounded-full bg-[#121613] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1E4D36]"
                >
                  Buka Detail {{ trips[0].judul }}
                </NuxtLink>
                <a
                  :href="buildWaLink(kontak.whatsapp, 'Halo Admin Merayau, saya ingin tanya kuota Open Trip terbaru.')"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[#D6D0C4] bg-white px-5 text-sm font-semibold text-[#121613] hover:bg-[#F5F2EB]"
                >
                  <WaIcon :size="16" />
                  <span>Tanya Kuota via WA</span>
                </a>
              </div>
            </div>

            <div class="min-w-0 lg:col-span-7">
              <div v-if="pending && !trips.length" class="space-y-3">
                <div v-for="n in 3" :key="n" class="h-16 animate-pulse rounded-xl bg-[#F5F2EB]" />
              </div>

              <div v-else-if="trips.length" data-reveal-stagger class="divide-y divide-[#EAE5DA] border-y border-[#EAE5DA]">
                <NuxtLink
                  v-for="(trip, idx) in trips"
                  :key="trip.id"
                  :to="`/trip/${trip.id}`"
                  :style="`--stagger-delay: ${Math.min(idx, 5) * 75}ms`"
                  class="mry-stagger-item group flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-[#FDFCFA]"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="mry-mono text-xs font-medium text-[#5C645E]">
                        {{ trip.tanggalBerangkat }}
                      </span>
                      <span class="rounded bg-[#E6F0EA] px-2 py-0.5 text-[11px] font-semibold text-[#1E4D36]">
                        Sisa {{ trip.sisaKuota }} slot
                      </span>
                    </div>
                    <div class="mt-1 text-base font-semibold text-[#121613] group-hover:text-[#1E4D36]">
                      {{ trip.judul }}
                    </div>
                    <div class="text-xs text-[#5C645E]">
                      {{ trip.lokasi }} · {{ trip.durasi }} · Kuota {{ trip.kuota }}
                    </div>
                  </div>

                  <div class="shrink-0 text-right">
                    <div class="mry-mono text-sm font-bold text-[#121613]">
                      {{ formatRupiah(trip.hargaMulai) }}
                    </div>
                    <div class="text-xs font-medium text-[#1E4D36]">
                      {{ trip.statusPublish }} →
                    </div>
                  </div>
                </NuxtLink>
              </div>

              <div v-else class="rounded-xl border border-dashed border-[#D6D0C4] bg-[#FDFCFA] p-5 text-sm text-[#5C645E]">
                Belum ada jadwal Open Trip berstatus Published saat ini. Hubungi admin basecamp untuk private trip.
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 02b · PILIHAN OPEN TRIP CAROUSEL (Gallery4 Style) -->
      <section v-if="trips.length" class="overflow-x-clip border-y border-[#EAE5DA] bg-[#F5F2EB] py-12 sm:py-20">
        <div class="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end" data-reveal>
            <div>
              <p class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
                02b · Jadwal Keberangkatan Aktif
              </p>
              <h2 class="mry-serif mt-2 text-3xl font-semibold text-[#121613] sm:text-4xl">
                Pilihan Open Trip
              </h2>
              <p class="mt-2 max-w-xl text-sm text-[#2E3530]">
                Pilih jadwal pendakian, bandingkan fasilitas Paket A/B/C, dan amankan kuota dengan DP 50%.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="!canScrollPrev"
                class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] transition-colors hover:bg-[#1E4D36] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#121613]"
                aria-label="Trip sebelumnya"
                @click="scrollTripCarousel(-1)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                :disabled="!canScrollNext"
                class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] transition-colors hover:bg-[#1E4D36] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#121613]"
                aria-label="Trip berikutnya"
                @click="scrollTripCarousel(1)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref="tripCarouselRef"
            data-reveal-carousel
            class="mry-no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3"
            @scroll="onCarouselScroll"
          >
            <NuxtLink
              v-for="(trip, idx) in trips"
              :key="`card-${trip.id}`"
              :to="`/trip/${trip.id}`"
              :style="`--stagger-delay: ${Math.min(idx, 4) * 90}ms`"
              class="mry-carousel-card group relative flex min-h-[410px] w-[85vw] max-w-[360px] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl border border-[#D6D0C4] bg-[#121613] p-6 text-left shadow-md"
            >
              <img
                :src="trip.fotoUrl"
                :alt="trip.judul"
                class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

              <div class="relative z-10 space-y-2.5 text-white">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="mry-mono rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur-xs">
                    {{ trip.tanggalBerangkat }} · {{ trip.durasi }}
                  </span>
                  <span class="mry-mono rounded-full bg-[#1E4D36] px-2.5 py-1 text-[11px] font-semibold">
                    Sisa {{ trip.sisaKuota }}
                  </span>
                </div>
                <h3 class="mry-serif text-2xl leading-tight font-semibold">
                  {{ trip.judul }}
                </h3>
                <p class="line-clamp-2 text-xs leading-relaxed text-white/85">
                  {{ trip.detail?.deskripsi || `${trip.lokasi} · Tersedia pilihan Paket A, B, dan C dengan meeting point fleksibel.` }}
                </p>
                <div class="flex items-center justify-between border-t border-white/20 pt-3">
                  <div>
                    <div class="text-[11px] text-white/75">Mulai dari</div>
                    <div class="mry-mono text-base font-bold text-white">{{ formatRupiah(trip.hargaMulai) }}</div>
                  </div>
                  <span class="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span>Lihat Paket</span>
                    <span class="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                </div>
              </div>
            </NuxtLink>
          </div>

          <div v-if="trips.length > 1" data-reveal style="--reveal-delay: 160ms" class="mt-5 flex justify-center gap-2">
            <button
              v-for="(trip, idx) in trips"
              :key="`dot-${trip.id}`"
              type="button"
              class="h-2.5 cursor-pointer rounded-full transition-all"
              :class="activeCarouselSlide === idx ? 'w-7 bg-[#1E4D36]' : 'w-2.5 bg-[#D6D0C4] hover:bg-[#5C645E]'"
              :aria-label="`Pilih slide ${trip.judul}`"
              @click="goToCarouselSlide(idx)"
            />
          </div>
        </div>
      </section>

      <!-- 03 · PAKET TEKTOK OBSIDIAN BAND -->
      <section id="paket-tektok" class="overflow-x-clip bg-[#121613] py-12 text-white sm:py-20">
        <div class="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div class="mb-6 flex flex-wrap items-center justify-between gap-4 sm:mb-8">
            <div data-reveal style="--reveal-delay: 0ms" class="min-w-0">
              <p class="mry-mono text-xs font-medium tracking-[0.14em] text-[#93B47E] uppercase">
                03 · Paket Bundel Alat
              </p>
              <h2 class="mry-serif mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Paket Tektok &amp; Bundel Siap Berangkat
              </h2>
            </div>

            <div v-if="packages.length > 1" data-reveal style="--reveal-delay: 120ms" class="flex flex-wrap gap-2">
              <button
                v-for="(pkg, idx) in packages"
                :key="pkg.id"
                type="button"
                class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors"
                :class="
                  activePackageIdx === idx
                    ? 'border-[#93B47E] bg-[#93B47E] text-[#121613]'
                    : 'border-white/20 bg-white/5 text-white hover:border-white/50'
                "
                @click="activePackageIdx = idx"
              >
                <span>{{ pkg.namaPaket }}</span>
                <span
                  v-if="pkg.tipePaket === 'bundle'"
                  class="mry-mono rounded px-1.5 py-0.5 text-[10px]"
                  :class="activePackageIdx === idx ? 'bg-[#121613]/15 text-[#121613]' : 'bg-[#93B47E]/20 text-[#93B47E]'"
                >
                  Bundle
                </span>
              </button>
            </div>
          </div>

          <div
            v-if="currentPackage"
            class="grid items-center gap-6 rounded-3xl border border-white/15 bg-[#191E1A] p-4 sm:gap-10 sm:p-8 lg:grid-cols-12 lg:p-10"
          >
            <div data-reveal-left style="--reveal-delay: 60ms" class="min-w-0 lg:col-span-5">
              <div data-parallax-float="-0.09" class="mry-parallax-layer overflow-hidden rounded-2xl border border-white/10 bg-[#121613]">
                <img
                  :src="currentPackage.fotoUrl"
                  :alt="currentPackage.namaPaket"
                  class="block h-auto max-h-[580px] w-full object-contain"
                />
              </div>
            </div>

            <div class="min-w-0 space-y-6 lg:col-span-7">
              <div data-reveal-right style="--reveal-delay: 110ms">
                <div class="mb-2.5 flex flex-wrap items-center gap-2">
                  <span
                    v-if="currentPackage.promoAktif?.label || currentPackage.tipePaket === 'bundle'"
                    class="mry-mono rounded-full bg-[#93B47E] px-3 py-1 text-xs font-bold text-[#121613]"
                  >
                    {{
                      currentPackage.promoAktif?.label ||
                      currentPackage.labelPromo ||
                      (currentPackage.diskonPersen > 0 ? `HEMAT ${currentPackage.diskonPersen}%` : 'ITEM BUNDLE')
                    }}
                  </span>
                  <span
                    v-else-if="currentPackage.upcomingPromo"
                    class="mry-mono rounded-full border border-[#93B47E]/50 bg-[#93B47E]/15 px-3 py-1 text-xs font-semibold text-[#93B47E]"
                  >
                    Promo Terjadwal: {{ currentPackage.upcomingPromo.namaPromo }} ({{ currentPackage.upcomingPromo.label }}) · {{ formatPromoDateRangeId(currentPackage.upcomingPromo.tanggalMulai, currentPackage.upcomingPromo.tanggalSelesai) }}
                  </span>
                  <span class="mry-mono rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                    Tersedia {{ currentPackage.kuotaTersedia }} {{ currentPackage.tipePaket === 'bundle' ? 'bundle' : 'paket' }} siap ambil
                  </span>
                </div>
                <h3 class="mry-serif text-2xl font-semibold text-white sm:text-3xl">
                  {{ currentPackage.namaPaket }}
                </h3>
                <p class="mt-2 text-sm leading-relaxed text-[#D6D0C4]">
                  {{ currentPackage.deskripsi || 'Paket perlengkapan mendaki siap pakai dari basecamp Merayau Adventure.' }}
                </p>
              </div>

              <div data-reveal-stagger class="grid gap-2.5 sm:grid-cols-2">
                <div
                  v-for="(item, idx) in currentPackage.items"
                  :key="item.idAlat"
                  :style="`--stagger-delay: ${Math.min(idx, 7) * 45}ms`"
                  class="mry-stagger-item flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm"
                >
                  <span class="truncate text-white">
                    <span class="mry-mono font-semibold text-[#93B47E]">{{ item.jumlah }}x</span>
                    {{ item.namaAlat }}
                  </span>
                  <span class="mry-mono shrink-0 text-xs text-[#D6D0C4]">
                    {{ formatRupiah(item.hargaHarian * item.jumlah) }}
                  </span>
                </div>
              </div>

              <div data-reveal style="--reveal-delay: 200ms" class="flex flex-col justify-between gap-5 border-t border-white/15 pt-5 sm:flex-row sm:items-end">
                <div>
                  <div
                    v-if="(currentPackage.hargaEfektif ?? currentPackage.tarifPaket) < (currentPackage.tipePaket === 'bundle' ? currentPackage.totalNormal : currentPackage.tarifPaket)"
                    class="text-xs text-[#D6D0C4]"
                  >
                    Harga normal:
                    <span class="mry-mono line-through opacity-75">
                      {{ formatRupiah(currentPackage.tipePaket === 'bundle' ? currentPackage.totalNormal : currentPackage.tarifPaket) }}
                    </span>
                  </div>
                  <div v-else class="text-xs text-[#D6D0C4]">Tarif paket sewa</div>
                  <div class="mt-1 flex items-baseline gap-2">
                    <span class="mry-mono text-3xl font-bold text-[#93B47E]">
                      {{ formatRupiah(currentPackage.hargaEfektif ?? currentPackage.tarifPaket) }}
                    </span>
                    <span class="text-sm text-[#D6D0C4]">/ 24 jam</span>
                  </div>
                </div>

                <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    class="min-h-[46px] w-full cursor-pointer rounded-full bg-[#93B47E] px-6 text-sm font-bold text-[#121613] transition-colors hover:bg-[#A6C493] sm:w-auto"
                    :disabled="currentPackage.kuotaTersedia <= 0"
                    @click="cart.addPaket(currentPackage, true)"
                  >
                    + Tambah ke Daftar Sewa
                  </button>
                  <a
                    :href="packageWaUrl(currentPackage)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
                  >
                    <WaIcon :size="16" />
                    <span>Booking via WA</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-[#D6D0C4]">
            Belum ada paket bundel aktif. Tambah atau aktifkan paket di Portal Admin untuk menampilkannya di sini.
          </div>
        </div>
      </section>

      <!-- 04 · KATALOG ALAT BASECAMP - INFINITE HORIZONTAL MARQUEE -->
      <section id="katalog-marquee" class="overflow-x-clip border-b border-[#EAE5DA] bg-[#FDFCFA] py-12 sm:py-20">
        <div class="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div data-reveal style="--reveal-delay: 0ms" class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
                04 · Katalog Basecamp Live
              </p>
              <h2 class="mry-serif mt-2 text-3xl font-semibold text-[#121613] sm:text-4xl">
                Perlengkapan Sewa Siap Pakai
              </h2>
              <p class="mt-2 max-w-xl text-sm text-[#2E3530]">
                {{ stats.totalAlatAktif }} jenis alat aktif langsung dari inventori basecamp. Klik + Sewa pada kartu untuk menambahkan ke daftar sewa.
              </p>
            </div>
            <NuxtLink
              to="/katalog"
              class="inline-flex min-h-[44px] items-center rounded-full border border-[#121613] bg-white px-5 text-sm font-semibold text-[#121613] transition-colors hover:bg-[#121613] hover:text-white"
            >
              Lihat Katalog &amp; Filter Lengkap →
            </NuxtLink>
          </div>
        </div>

        <!-- Infinite Marquee Track (2x duplicated for seamless -50% loop) -->
        <div v-if="marqueeItems.length" data-reveal-media style="--reveal-delay: 100ms" class="mry-marquee-wrap mt-10 py-2">
          <div class="mry-marquee-track px-4">
            <article
              v-for="(item, idx) in [...marqueeItems, ...marqueeItems]"
              :key="`${item.id}-${idx}`"
              :aria-hidden="idx >= marqueeItems.length"
              class="flex w-[275px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-[#D6D0C4] bg-white p-4 shadow-xs transition-shadow hover:border-[#1E4D36] hover:shadow-md sm:w-[295px]"
            >
              <div>
                <div class="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#EAE5DA] bg-[#F5F2EB]">
                  <img
                    v-if="item.fotoUrl"
                    :src="item.fotoUrl"
                    :alt="item.namaAlat"
                    loading="lazy"
                    class="h-full w-full object-cover"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center p-8">
                    <GearArtThumb :kind="item.namaKategori" />
                  </div>
                  <span class="mry-mono absolute top-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-[#121613] shadow-xs">
                    {{ item.namaKategori }}
                  </span>
                  <span
                    class="mry-mono absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                    :class="item.stokTersedia > 0 ? 'bg-[#E6F0EA] text-[#1E4D36]' : 'bg-red-100 text-red-700'"
                  >
                    Stok {{ item.stokTersedia }}
                  </span>
                  <span
                    v-if="item.promoAktif"
                    class="mry-mono absolute bottom-2.5 left-2.5 rounded-full bg-[#1E4D36] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs"
                  >
                    {{ item.promoAktif.label }}
                  </span>
                </div>

                <div class="mt-3.5">
                  <div class="mry-mono text-[11px] text-[#5C645E]">{{ item.kodeAlat }}</div>
                  <h3 class="mt-0.5 line-clamp-1 text-base font-semibold text-[#121613]">
                    {{ item.namaAlat }}
                  </h3>
                  <div class="mry-mono mt-1 text-xs text-[#5C645E]">
                    {{ item.tarifNote }}
                  </div>
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
                  <div class="mry-mono text-base font-bold text-[#1E4D36]">
                    {{ formatRupiah(item.hargaEfektif ?? item.hargaHarian) }}
                  </div>
                  <div class="text-[11px] text-[#5C645E]">per 24 jam</div>
                </div>

                <button
                  type="button"
                  :disabled="item.stokTersedia <= 0"
                  :tabindex="idx >= marqueeItems.length ? -1 : 0"
                  class="min-h-[40px] cursor-pointer rounded-full px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  :class="
                    cart.getAlatQty(item.id) > 0
                      ? 'bg-[#E6F0EA] text-[#1E4D36] ring-1 ring-[#1E4D36]'
                      : 'bg-[#121613] text-white hover:bg-[#1E4D36]'
                  "
                  @click="cart.addAlat(item, false)"
                >
                  {{ cart.getAlatQty(item.id) > 0 ? `Di Daftar (${cart.getAlatQty(item.id)})` : '+ Sewa' }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- 04b · ALUR & ATURAN SEWA (Light Theme) -->
      <section id="aturan-sewa" class="overflow-x-clip bg-white py-12 sm:py-20">
        <div class="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
          <div data-reveal style="--reveal-delay: 0ms" class="max-w-2xl">
            <p class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
              04b · Prosedur &amp; Ketentuan · Basecamp Pontianak
            </p>
            <h2 class="mry-serif mt-2 text-3xl font-semibold text-[#121613] sm:text-4xl">
              Alur &amp; Aturan Sewa
            </h2>
            <p class="mt-2.5 text-sm leading-relaxed text-[#2E3530] sm:text-base">
              Ikuti alur booking online lewat katalog web atau datang langsung ke Basecamp Tanjung Raya 2, serta pahami ketentuan sewa sebelum membawa perlengkapan.
            </p>
          </div>

          <!-- Two 5-step vertical timelines -->
          <div class="mt-8 grid gap-6 sm:mt-10 sm:gap-10 lg:grid-cols-2 lg:gap-12">
            <div
              v-for="(flow, flowIdx) in [
                { label: '01 · Alur Booking Online (Sistem Web)', steps: onlineSteps },
                { label: '02 · Alur Datang Langsung (Offline)', steps: offlineSteps },
              ]"
              :key="flow.label"
              :data-reveal-left="flowIdx === 0 ? '' : undefined"
              :data-reveal-right="flowIdx === 1 ? '' : undefined"
              :style="`--reveal-delay: ${flowIdx * 120}ms`"
              class="min-w-0 rounded-2xl border border-[#EAE5DA] bg-[#FDFCFA] p-4 sm:p-7"
            >
              <div class="mry-mono border-b border-[#EAE5DA] pb-3 text-xs font-semibold tracking-[0.1em] text-[#1E4D36] uppercase">
                {{ flow.label }}
              </div>
              <ol data-reveal-stagger class="mt-6">
                <li
                  v-for="(step, idx) in flow.steps"
                  :key="step.title"
                  :style="`--stagger-delay: ${idx * 70 + flowIdx * 90}ms`"
                  class="mry-stagger-item group relative flex gap-4"
                  :class="idx < flow.steps.length - 1 ? 'pb-7' : ''"
                >
                  <div
                    v-if="idx < flow.steps.length - 1"
                    class="absolute top-7 bottom-0 left-[13px] w-[2px] bg-[#D6D0C4]"
                    aria-hidden="true"
                  />
                  <div
                    class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-transform duration-200 group-hover:scale-110"
                    :class="step.completed ? 'border-[#1E4D36] text-[#1E4D36]' : 'border-[#9CA3AF] text-[#6B7280]'"
                  >
                    <svg v-if="step.completed" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                  <div class="min-w-0">
                    <div class="text-base font-medium text-[#121613]">{{ step.title }}</div>
                    <div class="mt-0.5 text-sm leading-relaxed text-[#5C645E]">{{ step.time }}</div>
                  </div>
                </li>
              </ol>
            </div>
          </div>

          <!-- 8 Semantic Outlined Rule Toast/Alert Cards (Dismissible + Reset) -->
          <div class="mt-12">
            <div data-reveal style="--reveal-delay: 0ms" class="flex flex-wrap items-center justify-between gap-3">
              <h3 class="text-lg font-semibold text-[#121613]">
                Aturan Sewa Merayau Adventure ({{ visibleRentalRules.length }} / {{ rentalRules.length }})
              </h3>
              <button
                v-if="dismissedRuleIds.length > 0"
                type="button"
                class="min-h-[38px] cursor-pointer rounded-full border border-[#D6D0C4] bg-white px-4 text-xs font-semibold text-[#121613] transition-colors hover:border-[#1E4D36] hover:bg-[#F5F2EB]"
                @click="resetRules"
              >
                Reset Semua Aturan ({{ rentalRules.length }})
              </button>
            </div>

            <div data-reveal-stagger>
              <TransitionGroup
                name="mry-toast-list"
                tag="div"
                class="mt-4 grid gap-4 md:grid-cols-2"
              >
                <div
                  v-for="(rule, idx) in visibleRentalRules"
                  :key="rule.id"
                  :style="`--stagger-delay: ${(idx % 2) * 80 + Math.floor(idx / 2) * 55}ms`"
                  class="mry-stagger-item flex items-start gap-4 rounded-xl border bg-white p-4 transition-shadow duration-200 hover:shadow-sm sm:p-5"
                :class="{
                  'border-blue-200 bg-blue-50/35': rule.tone === 'info',
                  'border-emerald-200 bg-emerald-50/35': rule.tone === 'good',
                  'border-amber-200 bg-amber-50/35': rule.tone === 'warn',
                  'border-red-200 bg-red-50/35': rule.tone === 'bad',
                }"
              >
                <div
                  class="mt-0.5 shrink-0"
                  :class="{
                    'text-blue-700': rule.tone === 'info',
                    'text-emerald-700': rule.tone === 'good',
                    'text-amber-700': rule.tone === 'warn',
                    'text-red-700': rule.tone === 'bad',
                  }"
                >
                  <svg v-if="rule.tone === 'good'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
                    <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <svg v-else-if="rule.tone === 'info'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
                    <path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  <svg v-else-if="rule.tone === 'warn'" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3L2.5 19.5h19L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    <path d="M12 9.5v4.5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  </svg>
                  <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                    <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-bold text-[#121613]">{{ rule.title }}</div>
                  <p class="mt-1 text-sm leading-relaxed text-[#2E3530]">{{ rule.desc }}</p>
                </div>
                <button
                  type="button"
                  class="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#5C645E] transition-colors hover:bg-black/5 hover:text-[#121613]"
                  :aria-label="`Tutup ${rule.title}`"
                  @click="dismissRule(rule.id)"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                  </svg>
                </button>
              </div>
              </TransitionGroup>
            </div>

            <div data-reveal style="--reveal-delay: 100ms" class="mry-mono mt-5 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-center text-xs font-medium text-red-900">
              DENGAN MELAKUKAN PENYEWAAN, PENYEWA DIANGGAP TELAH MEMBACA DAN MENYETUJUI SELURUH ATURAN YANG BERLAKU.
            </div>
          </div>
        </div>
      </section>

      <!-- 05 · KONTAK BASECAMP -->
      <section id="kontak" class="overflow-x-clip border-t border-[#EAE5DA] bg-[#F5F2EB] py-12 sm:py-20">
        <div class="mx-auto grid max-w-[1280px] gap-8 px-4 sm:gap-10 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div data-reveal-left style="--reveal-delay: 0ms" class="min-w-0 space-y-5 lg:col-span-5">
            <p class="mry-mono text-xs font-semibold tracking-[0.14em] text-[#1E4D36] uppercase">
              05 · Kontak Basecamp
            </p>
            <h2 class="mry-serif text-3xl font-semibold text-[#121613] sm:text-4xl">
              Mau ngobrol dulu?
            </h2>
            <p class="text-sm leading-relaxed text-[#2E3530] sm:text-base">
              WhatsApp paling cepat dibalas setiap hari pukul 08.00 - 21.00 WIB. Atau isi form di kanan untuk menyiapkan pesan tanya stok atau konsultasi trip.
            </p>

            <div data-reveal-stagger class="space-y-3 pt-2">
              <a
                :href="buildWaLink(kontak.whatsapp, 'Halo Admin Merayau Adventure Pontianak!')"
                target="_blank"
                rel="noopener noreferrer"
                style="--stagger-delay: 60ms"
                class="mry-stagger-item flex items-center gap-4 rounded-2xl border border-[#D6D0C4] bg-white p-4 transition-colors hover:border-[#1E4D36]"
              >
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F0EA] text-[#1E4D36]">
                  <WaIcon :size="20" />
                </div>
                <div class="min-w-0">
                  <div class="mry-mono text-[11px] font-semibold tracking-wider text-[#5C645E] uppercase">WhatsApp</div>
                  <div class="mry-mono truncate text-sm font-bold text-[#121613]">{{ kontak.whatsappDisplay }}</div>
                </div>
              </a>

              <a
                :href="`mailto:${kontak.email}`"
                style="--stagger-delay: 140ms"
                class="mry-stagger-item flex items-center gap-4 rounded-2xl border border-[#D6D0C4] bg-white p-4 transition-colors hover:border-[#1E4D36]"
              >
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5F2EB] text-[#121613]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8" />
                    <path d="M4 7l8 6 8-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="mry-mono text-[11px] font-semibold tracking-wider text-[#5C645E] uppercase">Email Resmi</div>
                  <div class="truncate text-sm font-bold text-[#121613]">{{ kontak.email }}</div>
                </div>
              </a>

              <a
                :href="kontak.mapsUrl"
                target="_blank"
                rel="noopener noreferrer"
                style="--stagger-delay: 220ms"
                class="mry-stagger-item flex items-center gap-4 rounded-2xl border border-[#D6D0C4] bg-white p-4 transition-colors hover:border-[#1E4D36]"
              >
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F5F2EB] text-[#121613]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 21s7-6.2 7-11.5A7 7 0 1 0 5 9.5C5 14.8 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" />
                    <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" stroke-width="1.8" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <div class="mry-mono text-[11px] font-semibold tracking-wider text-[#5C645E] uppercase">Basecamp</div>
                  <div class="text-sm font-bold text-[#121613]">
                    Merayau Adventure Pontianak · {{ kontak.alamatSingkat }}
                  </div>
                </div>
              </a>
            </div>
          </div>

          <div data-reveal-right style="--reveal-delay: 150ms" class="min-w-0 lg:col-span-7">
            <form
              class="rounded-3xl border border-[#D6D0C4] bg-white p-4 shadow-xs sm:p-8"
              novalidate
              @submit.prevent="submitContactForm"
            >
              <h3 class="mry-serif text-2xl font-semibold text-[#121613]">Kirim pesan</h3>

              <div class="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label for="c-nama" class="mb-1.5 block text-xs font-semibold text-[#121613]">
                    Nama *
                  </label>
                  <input
                    id="c-nama"
                    v-model="contactForm.nama"
                    type="text"
                    required
                    placeholder="Nama lengkap"
                    class="min-h-[44px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3.5 text-sm text-[#121613]"
                  />
                </div>
                <div>
                  <label for="c-wa" class="mb-1.5 block text-xs font-semibold text-[#121613]">
                    WA/HP *
                  </label>
                  <input
                    id="c-wa"
                    v-model="contactForm.wa"
                    type="tel"
                    required
                    placeholder="08123456789"
                    class="min-h-[44px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3.5 text-sm text-[#121613]"
                  />
                  <div class="mt-1 text-[11px] text-[#5C645E]">Awali 08, 62, atau +62 tanpa spasi</div>
                </div>
              </div>

              <div class="mt-4">
                <label for="c-email" class="mb-1.5 block text-xs font-semibold text-[#121613]">
                  Email *
                </label>
                <input
                  id="c-email"
                  v-model="contactForm.email"
                  type="email"
                  required
                  placeholder="nama@email.com"
                  class="min-h-[44px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3.5 text-sm text-[#121613]"
                />
              </div>

              <div class="mt-4">
                <label for="c-topik" class="mb-1.5 block text-xs font-semibold text-[#121613]">
                  Topik
                </label>
                <select
                  id="c-topik"
                  v-model="contactForm.topik"
                  class="min-h-[44px] w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] px-3.5 text-sm text-[#121613]"
                >
                  <option value="Tanya sewa perlengkapan">Tanya sewa perlengkapan</option>
                  <option value="Tanya Open Trip & Kuota">Tanya Open Trip &amp; Kuota</option>
                  <option value="Booking Paket Tektok">Booking Paket Tektok</option>
                  <option value="Kerja sama & Komunitas">Kerja sama &amp; Komunitas</option>
                </select>
              </div>

              <div class="mt-4">
                <label for="c-pesan" class="mb-1.5 block text-xs font-semibold text-[#121613]">
                  Pesan *
                </label>
                <textarea
                  id="c-pesan"
                  v-model="contactForm.pesan"
                  rows="4"
                  required
                  placeholder="Ceritakan tanggal berangkat, jumlah tim, atau alat yang dicari"
                  class="w-full rounded-xl border border-[#D6D0C4] bg-[#FDFCFA] p-3.5 text-sm text-[#121613]"
                />
              </div>

              <div
                v-if="contactError"
                role="alert"
                class="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
              >
                {{ contactError }}
              </div>
              <div
                v-if="contactSent"
                role="status"
                class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800"
              >
                Pesan sudah disiapkan untuk dikirim ke WhatsApp Basecamp Merayau Adventure.
              </div>

              <button
                type="submit"
                class="mt-5 inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1E4D36] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#163B29]"
              >
                <WaIcon :size="16" />
                <span>Kirim Pesan via WhatsApp</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      <!-- 06 · ULASAN PENGGUNA GOOGLE MAPS (Marquee Blur-Word Reveal) -->
      <PublicTestimonialsMarquee :reviews="googleReviews" :maps-url="googleMapsReviewsUrl" />
    </main>

    <!-- 06 · LIGHT 4-COLUMN EDITORIAL FOOTER -->
    <PublicFooter
      :total-alat="stats.totalAlatAktif"
      :whatsapp="kontak.whatsapp"
      :whatsapp-display="kontak.whatsappDisplay"
      :email="kontak.email"
      :alamat="kontak.alamat"
      :maps-url="kontak.mapsUrl"
    />

    <!-- Slide-Over Nota Estimasi Sewa -->
    <PublicRentalCartDrawer :aturan="aturan" :whatsapp="kontak.whatsapp" :promos="data?.promos" />

    <!-- Floating Toast & Cart Pill -->
    <div
      v-if="cart.toastMessage.value"
      role="status"
      class="fixed bottom-20 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full border border-[#1E4D36]/30 bg-[#121613] px-5 py-2.5 text-center text-xs font-semibold text-white shadow-lg"
    >
      {{ cart.toastMessage.value }}
    </div>

    <button
      v-if="cart.totalCount.value > 0"
      type="button"
      class="fixed right-4 bottom-4 z-40 inline-flex min-h-[48px] max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-2.5 rounded-full bg-[#1E4D36] px-5 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-[1.02] hover:bg-[#163B29]"
      @click="cart.drawerOpen.value = true"
    >
      <span>Daftar Sewa ({{ cart.totalCount.value }})</span>
      <span class="mry-mono rounded-full bg-white/20 px-2.5 py-0.5 text-xs">
        {{ formatRupiah(cart.computeEstimate(aturan, data?.promos).grandTotal) }}
      </span>
    </button>
  </div>
</template>
