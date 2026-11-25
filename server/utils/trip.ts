import { z } from 'zod'

export interface TripItinerarySchedule {
  time: string
  event: string
}

export interface TripItineraryDay {
  day: string
  title: string
  desc?: string
  schedules: TripItinerarySchedule[]
}

export interface TripRouteFilter {
  id: string
  label: string
}

export interface TripFeatureComparison {
  feature: string
  pkgA: string
  pkgB: string
  pkgC: string
}

export interface TripMepoPrice {
  mepo: string
  isCustom?: boolean
  pkgA: string
  pkgB: string
  pkgC: string
}

export interface TripPackageCard {
  kodePaket: string
  namaPaket: string
  durasiKeterangan: string
  harga: number
  tag?: string
}

export interface TripGalleryItem {
  src: string
  label?: string
  tag?: string
}

export interface TripDetailData {
  elevation?: string
  difficulty?: string
  tipeTrip?: string
  deskripsi?: string
  gallery?: string[]
  galleryItems?: TripGalleryItem[]
  packageCards?: TripPackageCard[]
  comparisons?: TripFeatureComparison[]
  mepoPrices?: TripMepoPrice[]
  routeFilters?: TripRouteFilter[]
  itineraryDays?: TripItineraryDay[]
  routeItineraries?: Record<string, TripItineraryDay[]>
}

const tripItineraryScheduleSchema = z.object({
  time: z.string().trim().max(80).default(''),
  event: z.string().trim().max(300).default(''),
})

const tripItineraryDaySchema = z.object({
  day: z.string().trim().max(60).default(''),
  title: z.string().trim().max(180).default(''),
  desc: z.string().trim().max(1500).optional().default(''),
  schedules: z.array(tripItineraryScheduleSchema).default([]),
})

const tripRouteFilterSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().max(140).default(''),
})

const tripFeatureComparisonSchema = z.object({
  feature: z.string().trim().max(160).default(''),
  pkgA: z.string().trim().max(200).default(''),
  pkgB: z.string().trim().max(200).default(''),
  pkgC: z.string().trim().max(200).default(''),
})

const tripMepoPriceSchema = z.object({
  mepo: z.string().trim().max(180).default(''),
  isCustom: z.boolean().optional().default(false),
  pkgA: z.string().trim().max(80).default('-'),
  pkgB: z.string().trim().max(80).default('-'),
  pkgC: z.string().trim().max(80).default('-'),
})

const tripPackageCardSchema = z.object({
  kodePaket: z.string().trim().min(1).max(30),
  namaPaket: z.string().trim().max(120).default(''),
  durasiKeterangan: z.string().trim().max(120).default(''),
  harga: z.coerce.number().int().min(0).max(50_000_000).default(0),
  tag: z.string().trim().max(40).optional(),
})

export const tripGalleryItemSchema = z.object({
  src: z.string().trim().min(1).max(500),
  label: z.string().trim().max(120).optional().default(''),
  tag: z.string().trim().max(60).optional().default(''),
})

export const tripDetailSchema = z.object({
  elevation: z.string().trim().max(80).optional().default(''),
  difficulty: z.string().trim().max(40).optional().default('Menengah'),
  tipeTrip: z.string().trim().max(120).optional().default(''),
  deskripsi: z.string().trim().max(3000).optional().default(''),
  gallery: z.array(z.string().trim().max(500)).max(8).optional().default([]),
  galleryItems: z.array(tripGalleryItemSchema).max(5).optional(),
  packageCards: z.array(tripPackageCardSchema).max(10).optional().default([]),
  comparisons: z.array(tripFeatureComparisonSchema).max(40).optional().default([]),
  mepoPrices: z.array(tripMepoPriceSchema).max(30).optional().default([]),
  routeFilters: z.array(tripRouteFilterSchema).max(20).optional().default([]),
  itineraryDays: z.array(tripItineraryDaySchema).max(20).optional().default([]),
  routeItineraries: z.record(z.string(), z.array(tripItineraryDaySchema)).optional().default({}),
})

export function parseTripDetail(raw: string | null | undefined): Partial<TripDetailData> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Partial<TripDetailData>) : {}
  } catch {
    return {}
  }
}

export function summarizeItineraryText(
  detail?: Partial<TripDetailData> | null,
  fallback?: string | null,
): string {
  const days =
    (detail?.itineraryDays?.length ? detail.itineraryDays : undefined) ??
    (detail?.routeItineraries ? Object.values(detail.routeItineraries).find((d) => d.length > 0) : undefined)

  if (days?.length) {
    const lines = days
      .map((d) => {
        const header = [d.day, d.title].filter(Boolean).join(' - ')
        const scheds = (d.schedules ?? [])
          .filter((s) => s.time || s.event)
          .map((s) => `${s.time ? `${s.time} ` : ''}${s.event}`.trim())
          .join('; ')
        const parts = [header, d.desc?.trim(), scheds].filter(Boolean)
        return parts.join(': ')
      })
      .filter(Boolean)
    if (lines.length) {
      return lines.join('\n').slice(0, 4800)
    }
  }

  const fb = fallback?.trim()
  return fb && fb.length >= 3 ? fb.slice(0, 4800) : 'Itinerary pendakian akan diinformasikan.'
}

