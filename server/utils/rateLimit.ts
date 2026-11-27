import type { H3Event } from 'h3'

interface RateBucket {
  timestamps: number[]
  expiresAt: number
}

export interface RateLimitOptions {
  namespace: string
  key: string
  max: number
  windowSec: number
  message?: string
}

const MAX_BUCKETS = 10_000
const buckets = new Map<string, RateBucket>()
let lastSweepAt = 0

function sweepExpired(now: number): void {
  if (now - lastSweepAt < 30_000 && buckets.size < MAX_BUCKETS) return
  lastSweepAt = now
  for (const [k, b] of buckets) {
    if (b.expiresAt <= now) {
      buckets.delete(k)
    }
  }
  if (buckets.size >= MAX_BUCKETS) {
    const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.8)
    let removed = 0
    for (const k of buckets.keys()) {
      buckets.delete(k)
      removed++
      if (removed >= overflow) break
    }
  }
}

export function getClientIp(event: H3Event): string {
  const xff = getRequestHeader(event, 'x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const realIp = getRequestHeader(event, 'x-real-ip')?.trim()
  if (realIp) return realIp.slice(0, 64)
  return (event.node.req.socket?.remoteAddress || 'unknown').slice(0, 64)
}

export function checkRateLimit(opts: RateLimitOptions): {
  allowed: boolean
  remaining: number
  retryAfterSec: number
  resetUnixSec: number
} {
  const now = Date.now()
  sweepExpired(now)

  const windowMs = opts.windowSec * 1000
  const cutoff = now - windowMs
  const fullKey = `${opts.namespace}:${opts.key}`
  const existing = buckets.get(fullKey)
  const active = existing ? existing.timestamps.filter((t) => t > cutoff) : []

  if (active.length >= opts.max) {
    const oldest = active[0] ?? now
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    const resetUnixSec = Math.ceil((oldest + windowMs) / 1000)
    buckets.set(fullKey, { timestamps: active, expiresAt: now + windowMs })
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      resetUnixSec,
    }
  }

  active.push(now)
  buckets.set(fullKey, { timestamps: active, expiresAt: now + windowMs })
  const oldest = active[0] ?? now
  return {
    allowed: true,
    remaining: Math.max(0, opts.max - active.length),
    retryAfterSec: 0,
    resetUnixSec: Math.ceil((oldest + windowMs) / 1000),
  }
}

export function enforceRateLimit(event: H3Event, opts: RateLimitOptions): void {
  const res = checkRateLimit(opts)
  setHeader(event, 'X-RateLimit-Limit', String(opts.max))
  setHeader(event, 'X-RateLimit-Remaining', String(res.remaining))
  setHeader(event, 'X-RateLimit-Reset', String(res.resetUnixSec))

  if (!res.allowed) {
    setHeader(event, 'Retry-After', String(res.retryAfterSec))
    throw createError({
      statusCode: 429,
      statusMessage:
        opts.message ||
        `Terlalu banyak permintaan. Coba lagi dalam ${res.retryAfterSec} detik.`,
    })
  }
}

export function clearRateLimit(namespace: string, key: string): void {
  buckets.delete(`${namespace}:${key}`)
}

