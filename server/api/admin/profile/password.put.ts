import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { admins } from '../../../database/schema'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.').max(128),
  newPassword: z.string().min(12, 'Kata sandi baru minimal 12 karakter.').max(128),
  confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.').max(128),
})

export default defineEventHandler(async (event) => {
  const adminId = event.context.admin?.id as number
  const ip = getClientIp(event)

  enforceRateLimit(event, {
    namespace: 'admin-password-change',
    key: `${adminId}:${ip}`,
    max: 5,
    windowSec: 15 * 60,
    message: 'Terlalu banyak percobaan ganti kata sandi. Coba lagi dalam 15 menit.',
  })

  const body = await parseValidatedBody(event, changePasswordSchema)

  const policyError = validateStrongPassword(body.newPassword)
  if (policyError) {
    throw createError({
      statusCode: 400,
      statusMessage: policyError,
    })
  }

  if (body.newPassword !== body.confirmPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Konfirmasi kata sandi baru tidak cocok.',
    })
  }

  if (body.newPassword === body.currentPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
    })
  }

  const db = useDb()
  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      nama: admins.nama,
      role: admins.role,
      passwordHash: admins.passwordHash,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1)

  if (!admin) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Akun admin tidak ditemukan.',
    })
  }

  if (!(await verifyPassword(body.currentPassword, admin.passwordHash))) {
    await recordSecurityAudit(event, {
      eventType: 'admin.password_change_failed',
      severity: 'warn',
      adminId: admin.id,
      actorEmail: admin.email,
      targetType: 'admin',
      targetId: admin.id,
    })
    throw createError({
      statusCode: 400,
      statusMessage: 'Kata sandi saat ini tidak sesuai.',
    })
  }

  const nextHash = await hashPassword(body.newPassword)
  await db
    .update(admins)
    .set({
      passwordHash: nextHash,
      tokenVersion: sql`${admins.tokenVersion} + 1`,
    })
    .where(eq(admins.id, adminId))

  const [updated] = await db
    .select({
      id: admins.id,
      email: admins.email,
      nama: admins.nama,
      role: admins.role,
      tokenVersion: admins.tokenVersion,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1)

  if (updated) {
    setAdminSessionCookie(event, {
      id: updated.id,
      email: updated.email,
      nama: updated.nama,
      role: updated.role,
      ver: updated.tokenVersion,
    })
  }

  await recordSecurityAudit(event, {
    eventType: 'admin.password_changed',
    severity: 'warn',
    adminId: admin.id,
    actorEmail: admin.email,
    targetType: 'admin',
    targetId: admin.id,
    notify: true,
  })

  return {
    ok: true,
    message: 'Kata sandi berhasil diperbarui dan sesi perangkat lain telah dicabut.',
  }
})
