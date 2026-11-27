import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { pengaturanSewa } from '../../../database/schema'

const updateSchema = z.object({
  namaAturan: z.string().trim().min(2).max(100),
  durasiDasarJam: z.coerce.number().int().min(1).max(168),
  minHariPromo: z.coerce.number().int().min(0).max(90),
  diskonPersen: z.coerce.number().int().min(0).max(90),
  toleransiTelatJam: z.coerce.number().int().min(0).max(48),
  dendaPersenHarian: z.coerce.number().int().min(0).max(300),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, updateSchema)
  const db = useDb()
  const rule = await getDefaultSetting(db)
  if (!rule) {
    const [ins] = await db.insert(pengaturanSewa).values({ ...body, isDefault: true })
    const [created] = await db
      .select()
      .from(pengaturanSewa)
      .where(eq(pengaturanSewa.id, Number(ins.insertId)))
      .limit(1)
    return created
  }

  await db.update(pengaturanSewa).set(body).where(eq(pengaturanSewa.id, rule.id))
  const [updated] = await db
    .select()
    .from(pengaturanSewa)
    .where(eq(pengaturanSewa.id, rule.id))
    .limit(1)

  invalidateChatbotSnapshotCache()
  await recordSecurityAudit(event, {
    eventType: 'admin.settings_updated',
    severity: 'warn',
    targetType: 'pengaturan_sewa',
    targetId: rule.id,
    metadata: body,
    notify: true,
  })

  return updated
})

