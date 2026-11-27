import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { z } from 'zod'

const SAFE_LOCAL_MEDIA_RE = /^\/(?:uploads|images)\/[a-zA-Z0-9._/-]+\.(?:jpg|jpeg|png|webp|svg|avif)(?:\?v=[a-zA-Z0-9._-]+)?$/

export function isSafeMediaUrl(raw: string): boolean {
  const val = raw.trim()
  if (!val) return false
  if (val.includes('..') || val.includes('\\') || val.startsWith('//')) return false
  if (/[\x00-\x1F\x7F]/.test(val)) return false

  if (val.startsWith('/')) {
    return SAFE_LOCAL_MEDIA_RE.test(val)
  }

  try {
    const parsed = new URL(val)
    if (parsed.protocol !== 'https:') return false
    if (parsed.username || parsed.password) return false
    const host = parsed.hostname.toLowerCase()
    return (
      host.endsWith('.public.blob.vercel-storage.com') ||
      host.endsWith('.vercel-storage.com')
    )
  } catch {
    return false
  }
}

export function safeRequiredImageUrlSchema(maxLen = 500) {
  return z
    .string()
    .trim()
    .min(1, 'URL gambar wajib diisi.')
    .max(maxLen, `URL gambar maksimal ${maxLen} karakter.`)
    .refine(isSafeMediaUrl, {
      message: 'URL gambar harus berasal dari upload resmi (/uploads, /images, atau Vercel Blob HTTPS).',
    })
}

export function safeOptionalImageUrlSchema(maxLen = 255) {
  return z
    .string()
    .trim()
    .max(maxLen, `URL gambar maksimal ${maxLen} karakter.`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .refine((v) => v === null || v === undefined || isSafeMediaUrl(v), {
      message: 'URL gambar harus berasal dari upload resmi (/uploads, /images, atau Vercel Blob HTTPS).',
    })
}

export function generateUniqueKode(prefix: string): string {
  const ts = Date.now().toString(36).slice(-5).toUpperCase()
  const rand = randomBytes(4).toString('hex').toUpperCase()
  return `${prefix}-${ts}${rand}`
}

export async function parseValidatedBody<T extends z.ZodTypeAny>(
  event: H3Event,
  schema: T,
): Promise<z.infer<T>> {
  const body = await readBody(event)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const field = firstIssue?.path?.join('.') || 'input'
    const msg = firstIssue?.message || 'Data tidak valid.'
    throw createError({
      statusCode: 400,
      statusMessage: `${field}: ${msg}`,
    })
  }
  return parsed.data
}

export function parseRouteIntId(event: H3Event, param = 'id'): number {
  const raw = Number(getRouterParam(event, param))
  if (!Number.isInteger(raw) || raw <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'ID tidak valid.' })
  }
  return raw
}

export function rethrowDbConflict(error: unknown, duplicateMsg: string, fkMsg?: string): never {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    throw error
  }
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ||
    (error as { cause?: { code?: string } })?.cause?.code
  if (code === 'ER_DUP_ENTRY') {
    throw createError({ statusCode: 409, statusMessage: duplicateMsg })
  }
  if (code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED') {
    throw createError({
      statusCode: 409,
      statusMessage: fkMsg || 'Data masih direferensikan oleh catatan lain.',
    })
  }
  throw error
}
