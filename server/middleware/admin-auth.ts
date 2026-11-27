import type { H3Event } from 'h3'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function resolveExpectedHost(event: H3Event): string {
  const fwd = getRequestHeader(event, 'x-forwarded-host')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim().toLowerCase()
    if (first) return first
  }
  return (getRequestHeader(event, 'host') || '').trim().toLowerCase()
}

function enforceSameOriginMutation(event: H3Event): void {
  const method = (event.method || 'GET').toUpperCase()
  if (!MUTATING_METHODS.has(method)) return

  const cleanPath = (event.path.split('?')[0] || '').toLowerCase()
  if (!cleanPath.startsWith('/api/')) return

  const secFetchSite = (getRequestHeader(event, 'sec-fetch-site') || '').trim().toLowerCase()
  if (secFetchSite === 'cross-site') {
    void recordSecurityAudit(event, {
      eventType: 'security.csrf_blocked',
      severity: 'warn',
      metadata: { reason: 'sec-fetch-site-cross-site', method },
    })
    throw createError({
      statusCode: 403,
      statusMessage: 'Permintaan lintas-situs ditolak.',
    })
  }

  const expectedHost = resolveExpectedHost(event)
  if (!expectedHost) return

  const origin = getRequestHeader(event, 'origin')?.trim()
  if (origin) {
    let originHost = ''
    try {
      originHost = new URL(origin).host.toLowerCase()
    } catch {
      originHost = ''
    }
    if (!originHost || originHost !== expectedHost) {
      void recordSecurityAudit(event, {
        eventType: 'security.csrf_blocked',
        severity: 'warn',
        metadata: { reason: 'origin-mismatch', origin, expectedHost, method },
      })
      throw createError({
        statusCode: 403,
        statusMessage: 'Origin permintaan tidak diizinkan.',
      })
    }
    return
  }

  const referer = getRequestHeader(event, 'referer')?.trim()
  if (referer) {
    let refererHost = ''
    try {
      refererHost = new URL(referer).host.toLowerCase()
    } catch {
      refererHost = ''
    }
    if (!refererHost || refererHost !== expectedHost) {
      void recordSecurityAudit(event, {
        eventType: 'security.csrf_blocked',
        severity: 'warn',
        metadata: { reason: 'referer-mismatch', expectedHost, method },
      })
      throw createError({
        statusCode: 403,
        statusMessage: 'Referer permintaan tidak diizinkan.',
      })
    }
  }
}

export default defineEventHandler(async (event) => {
  enforceSameOriginMutation(event)

  const cleanPath = (event.path.split('?')[0] || '').toLowerCase()
  if (cleanPath !== '/api/admin' && !cleanPath.startsWith('/api/admin/')) return

  const session = await requireAdminSession(event)
  event.context.admin = session
})
