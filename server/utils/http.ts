import type { H3Event } from 'h3'
import type { z } from 'zod'

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

