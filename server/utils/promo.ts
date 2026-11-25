import { desc, eq } from 'drizzle-orm'
import { promoDiskon } from '../database/schema'
import type { DbExecutor } from './db'

export type PromoRow = typeof promoDiskon.$inferSelect

export interface AppliedPromo {
  id: number
  namaPromo: string
  label: string
  tipePotongan: 'persen' | 'nominal'
  nilaiPotongan: number
  hematNominal: number
}

export function isPromoLive(promo: PromoRow, now = new Date()): boolean {
  if (!promo.statusAktif) return false
  if (promo.tanggalMulai && now < new Date(promo.tanggalMulai)) return false
  if (promo.tanggalSelesai && now > new Date(promo.tanggalSelesai)) return false
  return true
}

export function getPromoRuntimeStatus(
  promo: PromoRow,
  now = new Date(),
): 'Aktif' | 'Terjadwal' | 'Berakhir' | 'Nonaktif' {
  if (!promo.statusAktif) return 'Nonaktif'
  if (promo.tanggalMulai && now < new Date(promo.tanggalMulai)) return 'Terjadwal'
  if (promo.tanggalSelesai && now > new Date(promo.tanggalSelesai)) return 'Berakhir'
  return 'Aktif'
}

export function computePromoSaving(basePrice: number, promo: PromoRow): number {
  if (basePrice <= 0) return 0
  if (promo.tipePotongan === 'persen') {
    const pct = Math.min(95, Math.max(0, promo.nilaiPotongan))
    return Math.min(basePrice, Math.round((basePrice * pct) / 100))
  }
  return Math.min(basePrice, Math.max(0, promo.nilaiPotongan))
}

export function formatPromoBadgeLabel(promo: PromoRow): string {
  const custom = (promo.labelBadge ?? '').trim()
  if (custom) return custom
  if (promo.tipePotongan === 'persen') return `Diskon ${promo.nilaiPotongan}%`
  return `Hemat Rp ${promo.nilaiPotongan.toLocaleString('id-ID')}`
}

function pickBestPromo(basePrice: number, candidates: PromoRow[]): {
  hargaEfektif: number
  promoAktif: AppliedPromo | null
} {
  let bestPromo: PromoRow | null = null
  let bestSaving = 0
  for (const promo of candidates) {
    const saving = computePromoSaving(basePrice, promo)
    if (saving > bestSaving) {
      bestSaving = saving
      bestPromo = promo
    }
  }
  if (!bestPromo || bestSaving <= 0) {
    return { hargaEfektif: basePrice, promoAktif: null }
  }
  return {
    hargaEfektif: Math.max(0, basePrice - bestSaving),
    promoAktif: {
      id: bestPromo.id,
      namaPromo: bestPromo.namaPromo,
      label: formatPromoBadgeLabel(bestPromo),
      tipePotongan: bestPromo.tipePotongan,
      nilaiPotongan: bestPromo.nilaiPotongan,
      hematNominal: bestSaving,
    },
  }
}

export function resolveBestPromoForAlat(
  alat: { id: number; idKategori: number; hargaHarian: number },
  activePromos: PromoRow[],
): { hargaEfektif: number; promoAktif: AppliedPromo | null } {
  const matching = activePromos.filter(
    (p) =>
      p.targetTipe === 'semua_alat' ||
      (p.targetTipe === 'kategori' && p.targetId === alat.idKategori) ||
      (p.targetTipe === 'alat' && p.targetId === alat.id),
  )
  return pickBestPromo(alat.hargaHarian, matching)
}

export function resolveBestPromoForPaket(
  pkg: { id: number; tarifPaket: number },
  activePromos: PromoRow[],
): { hargaEfektif: number; promoAktif: AppliedPromo | null } {
  const matching = activePromos.filter(
    (p) => p.targetTipe === 'paket' && p.targetId === pkg.id,
  )
  return pickBestPromo(pkg.tarifPaket, matching)
}

export async function getLivePromos(executor: DbExecutor, now = new Date()): Promise<PromoRow[]> {
  const rows = await executor
    .select()
    .from(promoDiskon)
    .where(eq(promoDiskon.statusAktif, true))
    .orderBy(desc(promoDiskon.id))
  return rows.filter((r) => isPromoLive(r, now))
}

export async function getEnabledPromos(executor: DbExecutor, now = new Date()): Promise<PromoRow[]> {
  const rows = await executor
    .select()
    .from(promoDiskon)
    .where(eq(promoDiskon.statusAktif, true))
    .orderBy(desc(promoDiskon.id))
  return rows.filter((r) => !r.tanggalSelesai || new Date(r.tanggalSelesai) >= now)
}

export interface UpcomingPromoInfo {
  id: number
  namaPromo: string
  label: string
  tipePotongan: 'persen' | 'nominal'
  nilaiPotongan: number
  tanggalMulai: Date | null
  tanggalSelesai: Date | null
}

function pickNearestScheduledPromo(candidates: PromoRow[], now = new Date()): UpcomingPromoInfo | null {
  const scheduled = candidates
    .filter((p) => getPromoRuntimeStatus(p, now) === 'Terjadwal')
    .sort((a, b) => {
      const ta = a.tanggalMulai ? new Date(a.tanggalMulai).getTime() : Infinity
      const tb = b.tanggalMulai ? new Date(b.tanggalMulai).getTime() : Infinity
      return ta - tb
    })
  const first = scheduled[0]
  if (!first) return null
  return {
    id: first.id,
    namaPromo: first.namaPromo,
    label: formatPromoBadgeLabel(first),
    tipePotongan: first.tipePotongan,
    nilaiPotongan: first.nilaiPotongan,
    tanggalMulai: first.tanggalMulai,
    tanggalSelesai: first.tanggalSelesai,
  }
}

export function resolveUpcomingPromoForAlat(
  alat: { id: number; idKategori: number },
  enabledPromos: PromoRow[],
  now = new Date(),
): UpcomingPromoInfo | null {
  const matching = enabledPromos.filter(
    (p) =>
      p.targetTipe === 'semua_alat' ||
      (p.targetTipe === 'kategori' && p.targetId === alat.idKategori) ||
      (p.targetTipe === 'alat' && p.targetId === alat.id),
  )
  return pickNearestScheduledPromo(matching, now)
}

export function resolveUpcomingPromoForPaket(
  pkg: { id: number },
  enabledPromos: PromoRow[],
  now = new Date(),
): UpcomingPromoInfo | null {
  const matching = enabledPromos.filter(
    (p) => p.targetTipe === 'paket' && p.targetId === pkg.id,
  )
  return pickNearestScheduledPromo(matching, now)
}

