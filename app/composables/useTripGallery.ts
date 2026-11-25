export interface PublicTripPaket {
  id: number
  kodePaket: string
  deskripsiFasilitas: string | null
  harga: number
}

export interface PublicTripMepo {
  id: number
  namaLokasi: string
  isCustom: boolean
}

export interface PublicTripItem {
  id: number
  judul: string
  lokasi: string
  tanggalBerangkat: string
  durasi: string
  kuota: number
  pesertaCount: number
  sisaKuota: number
  hargaMulai: number
  itinerary: string
  statusPublish: string
  fotoUrl: string
  detail?: {
    elevation?: string
    difficulty?: string
    tipeTrip?: string
    deskripsi?: string
    gallery?: string[]
    galleryItems?: Array<{ src: string; label?: string; tag?: string }>
    packageCards?: Array<{
      kodePaket: string
      namaPaket: string
      durasiKeterangan: string
      harga: number
      tag?: string
    }>
    comparisons?: Array<{ feature: string; pkgA: string; pkgB: string; pkgC: string }>
    mepoPrices?: Array<{ mepo: string; isCustom?: boolean; pkgA: string; pkgB: string; pkgC: string }>
    routeFilters?: Array<{ id: string; label: string }>
    itineraryDays?: Array<{
      day: string
      title: string
      desc?: string
      schedules?: Array<{ time: string; event: string }>
    }>
    routeItineraries?: Record<
      string,
      Array<{
        day: string
        title: string
        desc?: string
        schedules?: Array<{ time: string; event: string }>
      }>
    >
  }
  pakets: PublicTripPaket[]
  meetingPoints: PublicTripMepo[]
}

export interface TripGallerySlide {
  src: string
  label: string
  tag: string
  isPreset?: boolean
}

export interface MountainGalleryPreset {
  match: string
  id: string
  judul: string
  tags: string[]
  photos: Array<{ src: string; label: string; tag: string }>
}

export const MOUNTAIN_GALLERY_SETS: MountainGalleryPreset[] = [
  {
    match: 'prau',
    id: 'trip-prau',
    judul: 'Gunung Prau via Patak Banteng',
    tags: ['Dieng · 2.565 MDPL', 'Favorit Pemula'],
    photos: [
      { src: '/images/landing/gallery/prau-5.webp', label: 'Basecamp Patak Banteng', tag: 'Registrasi & Persiapan' },
      { src: '/images/landing/gallery/prau-4.webp', label: 'Pendakian Jalur Patak Banteng', tag: 'Tim Merayau' },
      { src: '/images/landing/gallery/prau-2.webp', label: 'Puncak Gunung Prau 2.565 MDPL', tag: 'Foto Tim Puncak' },
      { src: '/images/landing/gallery/prau-3.webp', label: 'Camp Area Puncak Prau', tag: 'Dieng · 2.565 MDPL' },
      { src: '/images/landing/gallery/prau-1.webp', label: 'Sunrise Golden Hour Prau', tag: 'Samudra Awan' },
    ],
  },
  {
    match: 'merbabu',
    id: 'trip-merbabu',
    judul: 'Merbabu via Selo (2D1N)',
    tags: ['Boyolali · 3.145 MDPL', 'Sabana Terbuka'],
    photos: [
      { src: '/images/landing/gallery/merbabu-3.webp', label: 'Pos III Batu Tulis (2.595 MDPL)', tag: 'Jalur Selo' },
      { src: '/images/landing/gallery/merbabu-5.webp', label: 'Jalur Sabana Merbabu via Selo', tag: 'Trekking Tim' },
      { src: '/images/landing/gallery/merbabu-2.webp', label: 'Puncak Kenteng Songo 3.142 MDPL', tag: 'Boyolali · Merbabu' },
      { src: '/images/landing/gallery/merbabu-1.webp', label: 'Puncak Triangulasi 3.142 MDPL', tag: 'Foto Tim Puncak' },
      { src: '/images/landing/gallery/merbabu-4.webp', label: 'Camp Sabana Saat Senja', tag: 'View Gunung Merapi' },
    ],
  },
  {
    match: 'lawu',
    id: 'trip-lawu',
    judul: 'Gunung Lawu via Cetho',
    tags: ['Karanganyar · 3.265 MDPL', 'Jalur Klasik'],
    photos: [
      { src: '/images/landing/gallery/lawu-5.webp', label: 'Pos 1 Jalur Pendakian Lawu', tag: 'Hutan Tropis' },
      { src: '/images/landing/gallery/lawu-3.webp', label: 'Lintasan Hutan Berkabut Lawu', tag: 'Trekking Tim' },
      { src: '/images/landing/gallery/lawu-2.webp', label: 'Puncak Hargo Dumilah 3.265 MDPL', tag: 'Karanganyar · Lawu' },
      { src: '/images/landing/gallery/lawu-4.webp', label: 'Punggungan Berbatu Menuju Puncak', tag: 'Samudra Awan' },
      { src: '/images/landing/gallery/lawu-1.webp', label: 'Camp Area & Kopi Pagi di Puncak', tag: '3.265 MDPL' },
    ],
  },
]

export function findMountainGalleryPreset(judul: string, fallbackIndex = 0): MountainGalleryPreset {
  const lower = judul.toLowerCase()
  return (
    MOUNTAIN_GALLERY_SETS.find((p) => lower.includes(p.match)) ??
    MOUNTAIN_GALLERY_SETS[fallbackIndex % MOUNTAIN_GALLERY_SETS.length]!
  )
}

export interface TripGallerySource {
  judul: string
  lokasi: string
  fotoUrl?: string | null
  foto?: string | null
  detail?: {
    elevation?: string
    gallery?: string[]
    galleryItems?: Array<{ src: string; label?: string; tag?: string }>
  }
}

/**
 * Resolve 5 fan-gallery cards for a trip, preferring curated `galleryItems` with captions/tags,
 * then legacy `gallery` URLs + hero photo, and filling remaining slots from the matching preset.
 */
export function resolveTripGalleryCards(
  trip: TripGallerySource,
  fallbackIndex = 0,
): TripGallerySlide[] {
  const preset = findMountainGalleryPreset(trip.judul, fallbackIndex)
  const defaultTag = trip.detail?.elevation || trip.lokasi
  const heroSrc = (trip.fotoUrl ?? trip.foto ?? '').trim()

  const curated = (trip.detail?.galleryItems ?? [])
    .filter((item) => Boolean(item?.src?.trim()))
    .map((item) => ({
      src: item.src.trim(),
      label: item.label?.trim() || trip.judul,
      tag: item.tag?.trim() || defaultTag,
      isPreset: false,
    }))

  if (curated.length > 0) {
    const combined: TripGallerySlide[] = [...curated]
    if (combined.length < 5 && heroSrc && !combined.some((x) => x.src === heroSrc)) {
      combined.unshift({ src: heroSrc, label: trip.judul, tag: defaultTag, isPreset: false })
    }
    for (const p of preset.photos) {
      if (combined.length >= 5) break
      if (!combined.some((x) => x.src === p.src)) {
        combined.push({ ...p, isPreset: true })
      }
    }
    while (combined.length < 5) {
      const p = preset.photos[combined.length % preset.photos.length]!
      combined.push({ ...p, isPreset: true })
    }
    return combined.slice(0, 5)
  }

  const customPhotos: TripGallerySlide[] = []
  if (heroSrc) {
    customPhotos.push({ src: heroSrc, label: trip.judul, tag: defaultTag, isPreset: false })
  }
  for (const g of trip.detail?.gallery ?? []) {
    const clean = g?.trim()
    if (clean && !customPhotos.some((x) => x.src === clean)) {
      customPhotos.push({ src: clean, label: trip.judul, tag: trip.lokasi, isPreset: false })
    }
  }

  // When only the hero photo exists and a mountain preset matches, center it at index 2
  if (customPhotos.length === 1 && trip.judul.toLowerCase().includes(preset.match) && preset.photos.length === 5) {
    const five: TripGallerySlide[] = preset.photos.map((p) => ({ ...p, isPreset: true }))
    five[2] = { src: heroSrc || preset.photos[2]!.src, label: trip.judul, tag: defaultTag, isPreset: false }
    return five
  }

  const combined: TripGallerySlide[] = [...customPhotos]
  for (const p of preset.photos) {
    if (combined.length >= 5) break
    if (!combined.some((x) => x.src === p.src)) {
      combined.push({ ...p, isPreset: true })
    }
  }
  while (combined.length < 5) {
    const p = preset.photos[combined.length % preset.photos.length]!
    combined.push({ ...p, isPreset: true })
  }
  return combined.slice(0, 5)
}

