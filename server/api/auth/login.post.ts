import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { admins } from '../../database/schema'

const loginSchema = z.object({
  email: z.string().trim().email('Format email tidak valid.').max(160),
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(128),
})

export default defineEventHandler(async (event) => {
  const ip = getClientIp(event)
  try {
    enforceRateLimit(event, {
      namespace: 'auth-login-ip',
      key: ip,
      max: 15,
      windowSec: 15 * 60,
      message: 'Terlalu banyak percobaan login dari jaringan ini. Coba lagi beberapa menit lagi.',
    })
  } catch (err) {
    await recordSecurityAudit(event, {
      eventType: 'auth.rate_limited',
      severity: 'warn',
      metadata: { scope: 'ip' },
    })
    throw err
  }

  const body = await parseValidatedBody(event, loginSchema)
  const emailClean = body.email.toLowerCase()
  const accountRateKey = `${ip}:${emailClean}`

  try {
    enforceRateLimit(event, {
      namespace: 'auth-login-account',
      key: accountRateKey,
      max: 5,
      windowSec: 15 * 60,
      message: 'Terlalu banyak percobaan login gagal untuk akun ini. Tunggu 15 menit lalu coba lagi.',
    })
  } catch (err) {
    await recordSecurityAudit(event, {
      eventType: 'auth.rate_limited',
      severity: 'warn',
      actorEmail: emailClean,
      metadata: { scope: 'ip+email' },
    })
    throw err
  }

  const db = useDb()
  const [admin] = await db.select().from(admins).where(eq(admins.email, emailClean)).limit(1)

  if (!admin) {
    await verifyDummyPassword(body.password)
    await recordSecurityAudit(event, {
      eventType: 'auth.login_failed',
      severity: 'warn',
      actorEmail: emailClean,
      metadata: { reason: 'unknown_email' },
    })
    throw createError({ statusCode: 401, statusMessage: 'Email atau kata sandi salah.' })
  }

  const valid = await verifyPassword(body.password, admin.passwordHash)
  if (!valid || admin.role !== 'admin') {
    await recordSecurityAudit(event, {
      eventType: 'auth.login_failed',
      severity: 'warn',
      adminId: admin.id,
      actorEmail: admin.email,
      metadata: { reason: valid ? 'invalid_role' : 'wrong_password' },
    })
    throw createError({ statusCode: 401, statusMessage: 'Email atau kata sandi salah.' })
  }

  clearRateLimit('auth-login-account', accountRateKey)

  const sessionUser = {
    id: admin.id,
    email: admin.email,
    nama: admin.nama,
    role: admin.role,
    ver: admin.tokenVersion,
  }
  setAdminSessionCookie(event, sessionUser)

  await recordSecurityAudit(event, {
    eventType: 'auth.login_success',
    severity: 'info',
    adminId: admin.id,
    actorEmail: admin.email,
  })

  return {
    ok: true,
    user: {
      id: admin.id,
      email: admin.email,
      nama: admin.nama,
      role: admin.role,
    },
  }
})
