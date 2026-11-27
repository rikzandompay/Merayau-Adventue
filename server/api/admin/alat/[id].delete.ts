import { count, eq } from 'drizzle-orm'
import { detailSewa, masterAlat, paketAlatItem } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const id = parseRouteIntId(event)
  const db = useDb()
  const [existing] = await db.select().from(masterAlat).where(eq(masterAlat.id, id)).limit(1)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Alat tidak ditemukan.' })
  }

  const [[rentalRefs], [pkgRefs]] = await Promise.all([
    db.select({ total: count() }).from(detailSewa).where(eq(detailSewa.idAlat, id)),
    db.select({ total: count() }).from(paketAlatItem).where(eq(paketAlatItem.idAlat, id)),
  ])

  if (Number(rentalRefs?.total ?? 0) > 0 || Number(pkgRefs?.total ?? 0) > 0) {
    // Preserve historical transaction/package integrity using soft-disable instead of hard delete.
    await db.update(masterAlat).set({ statusAktif: false }).where(eq(masterAlat.id, id))
    invalidateChatbotSnapshotCache()
    await recordSecurityAudit(event, {
      eventType: 'admin.alat_soft_disabled',
      severity: 'info',
      targetType: 'master_alat',
      targetId: id,
      metadata: { kodeAlat: existing.kodeAlat },
    })
    return {
      ok: true,
      softDisabled: true,
      message: 'Alat terhubung ke riwayat sewa/paket sehingga dinonaktifkan (soft toggle).',
    }
  }

  await db.delete(masterAlat).where(eq(masterAlat.id, id))
  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.alat_deleted',
    severity: 'warn',
    targetType: 'master_alat',
    targetId: id,
    metadata: { kodeAlat: existing.kodeAlat },
  })
  return { ok: true, softDisabled: false }
})

