import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import { detailSewa, pengaturanSewa, transaksiSewa } from '../database/schema'
import type { DbExecutor, DbInstance } from './db'

export async function getActiveRentedMap(
  executor: DbExecutor,
  alatIds?: number[],
): Promise<Map<number, number>> {
  const filters = [inArray(transaksiSewa.statusSewa, ['Disewa', 'Terlambat'])]
  if (alatIds?.length) {
    filters.push(inArray(detailSewa.idAlat, alatIds))
  }

  const rows = await executor
    .select({
      idAlat: detailSewa.idAlat,
      totalKeluar: sql<number>`COALESCE(SUM(${detailSewa.jumlah}), 0)`,
    })
    .from(detailSewa)
    .innerJoin(transaksiSewa, eq(detailSewa.idSewa, transaksiSewa.id))
    .where(and(...filters))
    .groupBy(detailSewa.idAlat)

  const map = new Map<number, number>()
  for (const row of rows) {
    map.set(row.idAlat, Number(row.totalKeluar))
  }
  return map
}

export function computePackageQuota(
  items: Array<{ idAlat: number; jumlah: number }>,
  availableMap: Map<number, number>,
): number {
  if (!items.length) return 0
  let minQuota = Infinity
  for (const item of items) {
    const avail = Math.max(0, availableMap.get(item.idAlat) ?? 0)
    const perPkg = Math.max(1, item.jumlah)
    minQuota = Math.min(minQuota, Math.floor(avail / perPkg))
  }
  return Number.isFinite(minQuota) ? minQuota : 0
}

export function computeDurationDays(start: Date, end: Date, baseHours = 24): number {
  const ms = end.getTime() - start.getTime()
  if (ms <= 0) return 1
  return Math.max(1, Math.ceil(ms / (Math.max(1, baseHours) * 3_600_000)))
}

export function computeLatePenalty(
  plannedReturn: Date,
  actualReturn: Date,
  toleransiJam: number,
  dailyTotal: number,
  dendaPersenHarian: number,
): { lateHours: number; lateDays: number; dendaTelat: number } {
  const cutoffMs = plannedReturn.getTime() + Math.max(0, toleransiJam) * 3_600_000
  const overdueMs = actualReturn.getTime() - cutoffMs
  if (overdueMs <= 0) {
    return { lateHours: 0, lateDays: 0, dendaTelat: 0 }
  }
  const lateHours = Math.ceil(overdueMs / 3_600_000)
  const lateDays = Math.max(1, Math.ceil(lateHours / 24))
  const perDayPenalty = Math.round((dailyTotal * dendaPersenHarian) / 100)
  return {
    lateHours,
    lateDays,
    dendaTelat: perDayPenalty * lateDays,
  }
}

export async function getDefaultSetting(executor: DbExecutor) {
  const rows = await executor.select().from(pengaturanSewa)
  return rows.find((r) => r.isDefault) || rows[0] || null
}

export async function syncOverdueTransactions(db: DbInstance): Promise<void> {
  const rule = await getDefaultSetting(db)
  const tolJam = rule?.toleransiTelatJam ?? 2
  const cutoff = new Date(Date.now() - tolJam * 3_600_000)
  await db
    .update(transaksiSewa)
    .set({ statusSewa: 'Terlambat' })
    .where(
      and(
        eq(transaksiSewa.statusSewa, 'Disewa'),
        isNull(transaksiSewa.tanggalKembaliAktual),
        lt(transaksiSewa.tanggalKembaliRencana, cutoff),
      ),
    )
}

