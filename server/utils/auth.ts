import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export interface AdminSessionUser {
  id: number
  email: string
  nama: string
  role: string
  exp: number
}

export const SESSION_COOKIE_NAME = 'merayau_admin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

function getAuthSecret(): string {
  try {
    return useRuntimeConfig().authSecret || process.env.AUTH_SECRET || 'dev-merayau-secret'
  } catch {
    return process.env.AUTH_SECRET || 'dev-merayau-secret'
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = scryptSync(password, salt, 64)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', getAuthSecret()).update(payloadB64).digest('base64url')
}

export function createSessionToken(user: Omit<AdminSessionUser, 'exp'>): string {
  const payload: AdminSessionUser = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${encoded}.${signPayload(encoded)}`
}

export function verifySessionToken(token: string | undefined | null): AdminSessionUser | null {
  if (!token) return null
  const [encoded, sig] = token.split('.')
  if (!encoded || !sig) return null

  const expectedSig = signPayload(encoded)
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AdminSessionUser
    if (!parsed?.id || typeof parsed.exp !== 'number') return null
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

export function setAdminSessionCookie(event: H3Event, user: Omit<AdminSessionUser, 'exp'>): void {
  const token = createSessionToken(user)
  setCookie(event, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  })
}

export function clearAdminSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' })
}

export function getAdminSession(event: H3Event): AdminSessionUser | null {
  const raw = getCookie(event, SESSION_COOKIE_NAME)
  return verifySessionToken(raw)
}

export function requireAdminSession(event: H3Event): AdminSessionUser {
  const session = getAdminSession(event)
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Autentikasi admin diperlukan.',
    })
  }
  return session
}

