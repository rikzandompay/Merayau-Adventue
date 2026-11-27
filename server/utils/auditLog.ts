import type { H3Event } from 'h3'
import { securityAuditLogs } from '../database/schema'
import { useDb } from './db'
import { getClientIp } from './rateLimit'

export type AuditSeverity = 'info' | 'warn' | 'critical'

export interface SecurityAuditInput {
  eventType: string
  severity?: AuditSeverity
  adminId?: number | null
  actorEmail?: string | null
  targetType?: string | null
  targetId?: string | number | null
  metadata?: Record<string, unknown> | null
  notify?: boolean
}

const SENSITIVE_KEY_RE = /password|secret|token|cookie|authorization|apikey|api_key/i
const ALERT_COOLDOWN_MS = 60_000
const lastAlertByKey = new Map<string, number>()

export function maskIdentityNumber(raw: string | null | undefined): string {
  const clean = String(raw || '').trim()
  if (!clean) return ''
  if (clean.length <= 6) return `${clean.slice(0, 1)}***${clean.slice(-1)}`
  return `${clean.slice(0, 4)}${'*'.repeat(Math.min(8, clean.length - 6))}${clean.slice(-2)}`
}

function sanitizeAuditValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_RE.test(key)) return '[REDACTED]'
  if (/noidentitas|nik/i.test(key) && typeof value === 'string') {
    return maskIdentityNumber(value)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeAuditValue(key, item))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeAuditValue(k, v)
    }
    return out
  }
  if (typeof value === 'string' && value.length > 300) {
    return `${value.slice(0, 300)}...`
  }
  return value
}

function resolveAlertWebhookUrl(): string {
  try {
    const cfg = useRuntimeConfig()
    return String(cfg.securityAlertWebhookUrl || process.env.SECURITY_ALERT_WEBHOOK_URL || '').trim()
  } catch {
    return String(process.env.SECURITY_ALERT_WEBHOOK_URL || '').trim()
  }
}

async function dispatchSecurityAlert(payload: {
  eventType: string
  severity: AuditSeverity
  actorEmail: string | null
  ipAddress: string | null
  path: string | null
  targetType: string | null
  targetId: string | null
  metadata: Record<string, unknown> | null
  timestamp: string
}): Promise<void> {
  const webhookUrl = resolveAlertWebhookUrl()
  if (!webhookUrl) return

  const dedupKey = `${payload.eventType}:${payload.ipAddress || 'none'}`
  const now = Date.now()
  const prev = lastAlertByKey.get(dedupKey) || 0
  if (now - prev < ALERT_COOLDOWN_MS) return
  lastAlertByKey.set(dedupKey, now)

  const summary = `[Merayau Security ${payload.severity.toUpperCase()}] ${payload.eventType} | actor=${payload.actorEmail || '-'} | ip=${payload.ipAddress || '-'} | target=${payload.targetType || '-'}:${payload.targetId || '-'}`

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: summary,
        content: summary,
        ...payload,
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // Prevent webhook failures from impacting application availability.
  }
}

export async function recordSecurityAudit(
  event: H3Event | null,
  input: SecurityAuditInput,
): Promise<void> {
  const severity: AuditSeverity = input.severity ?? 'info'
  const sessionAdmin = event?.context?.admin as
    | { id?: number; email?: string }
    | undefined

  const adminId = input.adminId !== undefined ? input.adminId : (sessionAdmin?.id ?? null)
  const actorEmail =
    (input.actorEmail !== undefined ? input.actorEmail : sessionAdmin?.email)?.slice(0, 160) ?? null
  const ipAddress = event ? getClientIp(event) : null
  const userAgent = event ? (getRequestHeader(event, 'user-agent') || '').slice(0, 255) || null : null
  const path = event ? (event.path.split('?')[0] || '').slice(0, 160) : null
  const targetType = input.targetType ? input.targetType.slice(0, 60) : null
  const targetId =
    input.targetId !== undefined && input.targetId !== null
      ? String(input.targetId).slice(0, 64)
      : null

  const cleanMeta = input.metadata
    ? (sanitizeAuditValue('root', input.metadata) as Record<string, unknown>)
    : null
  const timestamp = new Date().toISOString()

  const structuredLine = JSON.stringify({
    channel: 'security_audit',
    ts: timestamp,
    severity,
    eventType: input.eventType,
    adminId,
    actorEmail,
    ip: ipAddress,
    path,
    targetType,
    targetId,
    meta: cleanMeta,
  })

  if (severity === 'critical' || severity === 'warn') {
    console.warn(structuredLine)
  } else {
    console.info(structuredLine)
  }

  try {
    const db = useDb()
    await db.insert(securityAuditLogs).values({
      eventType: input.eventType.slice(0, 80),
      severity,
      adminId,
      actorEmail,
      ipAddress,
      userAgent,
      targetType,
      targetId,
      metadataJson: cleanMeta ? JSON.stringify(cleanMeta).slice(0, 4000) : null,
    })
  } catch {
    // Keep structured stdout audit intact even if audit table is not migrated yet.
  }

  if (input.notify || severity === 'critical' || severity === 'warn') {
    void dispatchSecurityAlert({
      eventType: input.eventType,
      severity,
      actorEmail,
      ipAddress,
      path,
      targetType,
      targetId,
      metadata: cleanMeta,
      timestamp,
    })
  }
}

