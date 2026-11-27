import { desc, eq } from 'drizzle-orm'
import { securityAuditLogs } from '../../../database/schema'

const VALID_SEVERITIES = new Set(['info', 'warn', 'critical'])

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rawLimit = Number(query.limit || 50)
  const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.trunc(rawLimit))) : 50
  const severityFilter = String(query.severity || '').trim().toLowerCase()

  const db = useDb()
  const rows = VALID_SEVERITIES.has(severityFilter)
    ? await db
        .select()
        .from(securityAuditLogs)
        .where(
          eq(
            securityAuditLogs.severity,
            severityFilter as 'info' | 'warn' | 'critical',
          ),
        )
        .orderBy(desc(securityAuditLogs.createdAt), desc(securityAuditLogs.id))
        .limit(limit)
    : await db
        .select()
        .from(securityAuditLogs)
        .orderBy(desc(securityAuditLogs.createdAt), desc(securityAuditLogs.id))
        .limit(limit)

  return {
    items: rows.map((r) => ({
      ...r,
      metadata: r.metadataJson ? safeParseJson(r.metadataJson) : null,
    })),
  }
})

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

