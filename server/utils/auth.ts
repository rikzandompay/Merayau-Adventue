import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { admins } from '../database/schema'
import { useDb } from './db'

const scryptAsync = promisify(scryptCallback)

export interface AdminSessionUser {
  id: number
  email: string
  nama: string
  role: string
  ver: number
  exp: number
}

export const SESSION_COOKIE_NAME = 'merayau_admin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12

const WEAK_AUTH_SECRETS = new Set([
  'dev-merayau-secret',
  'change-this-to-a-long-random-secret',
  'changeme',
  'change-me',
  'secret',
])

const WEAK_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'admin1234567',
  'merayau12345',
  '123456789012',
  'qwertyuiop12',
])

let ephemeralDevSecret: string | null = null
let dummyHashCache: string | null = null

function getAuthSecret(): string {
  let raw = ''
  try {
    raw = String(useRuntimeConfig().authSecret || process.env.AUTH_SECRET || '').trim()
  } catch {
    raw = String(process.env.AUTH_SECRET || '').trim()
  }

  const isWeak = raw.length < 32 || WEAK_AUTH_SECRETS.has(raw.toLowerCase())
  if (!isWeak) return raw

  if (process.env.NODE_ENV === 'production') {
    throw createError({
      statusCode: 500,
      statusMessage: 'Konfigurasi keamanan server belum lengkap (AUTH_SECRET tidak valid).',
    })
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = randomBytes(32).toString('hex')
    console.warn(
      '[auth] AUTH_SECRET kosong atau terlalu pendek (<32 karakter). Menggunakan kunci sementara khusus mode development.',
    )
  }
  return ephemeralDevSecret
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHex] = stored.split(':')
  if (!salt || !expectedHex) return false
  const expected = Buffer.from(expectedHex, 'hex')
  const actual = (await scryptAsync(password, salt, 64)) as Buffer
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

export async function verifyDummyPassword(password: string): Promise<void> {
  if (!dummyHashCache) {
    dummyHashCache = await hashPassword('dummy-timing-equalizer-value-9f8a7b')
  }
  await verifyPassword(password, dummyHashCache)
}

export function validateStrongPassword(password: string): string | null {
  if (password.length < 12) {
    return 'Kata sandi baru minimal 12 karakter.'
  }
  if (password.length > 128) {
    return 'Kata sandi baru maksimal 128 karakter.'
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Kata sandi baru wajib mengandung kombinasi huruf dan angka.'
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return 'Kata sandi terlalu umum. Gunakan kombinasi yang lebih unik.'
  }
  return null
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
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<AdminSessionUser>
    if (!parsed?.id || typeof parsed.exp !== 'number') return null
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null
    return {
      id: parsed.id,
      email: String(parsed.email || ''),
      nama: String(parsed.nama || ''),
      role: String(parsed.role || ''),
      ver: typeof parsed.ver === 'number' && Number.isInteger(parsed.ver) ? parsed.ver : 1,
      exp: parsed.exp,
    }
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
  deleteCookie(event, SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
}

export async function getVerifiedAdminSession(event: H3Event): Promise<AdminSessionUser | null> {
  const raw = getCookie(event, SESSION_COOKIE_NAME)
  const parsed = verifySessionToken(raw)
  if (!parsed) return null

  const db = useDb()
  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      nama: admins.nama,
      role: admins.role,
      tokenVersion: admins.tokenVersion,
    })
    .from(admins)
    .where(eq(admins.id, parsed.id))
    .limit(1)

  if (!admin || admin.role !== 'admin' || admin.tokenVersion !== parsed.ver) {
    return null
  }

  return {
    id: admin.id,
    email: admin.email,
    nama: admin.nama,
    role: admin.role,
    ver: admin.tokenVersion,
    exp: parsed.exp,
  }
}

export async function requireAdminSession(event: H3Event): Promise<AdminSessionUser> {
  const session = await getVerifiedAdminSession(event)
  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Autentikasi admin diperlukan.',
    })
  }
  return session
}
