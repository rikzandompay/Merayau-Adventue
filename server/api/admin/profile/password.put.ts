import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { admins } from '../../../database/schema'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
  newPassword: z.string().min(6, 'Kata sandi baru minimal 6 karakter.').max(128),
  confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
})

export default defineEventHandler(async (event) => {
  const adminId = event.context.admin?.id as number
  const body = await parseValidatedBody(event, changePasswordSchema)

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

  if (!verifyPassword(body.currentPassword, admin.passwordHash)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kata sandi saat ini tidak sesuai.',
    })
  }

  await db
    .update(admins)
    .set({
      passwordHash: hashPassword(body.newPassword),
    })
    .where(eq(admins.id, adminId))

  return {
    ok: true,
    message: 'Kata sandi berhasil diperbarui.',
  }
})

