import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { admins } from '../../../database/schema'

const updateProfileSchema = z.object({
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(120),
  email: z.string().trim().email('Format email tidak valid.').max(160),
  noTelepon: z.string().trim().min(8, 'Nomor telepon minimal 8 digit.').max(30),
})

export default defineEventHandler(async (event) => {
  const adminId = event.context.admin?.id as number
  const body = await parseValidatedBody(event, updateProfileSchema)

  const normalized = normalizeWhatsappNumber(body.noTelepon)
  if (!isValidWhatsappNumber(normalized)) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'Nomor telepon / WhatsApp tidak valid. Gunakan format seperti 085156549003 atau 6285156549003.',
    })
  }

  const db = useDb()
  const emailClean = body.email.toLowerCase()

  const [before] = await db
    .select({
      email: admins.email,
      noTelepon: admins.noTelepon,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1)

  try {
    await db
      .update(admins)
      .set({
        nama: body.nama,
        email: emailClean,
        noTelepon: normalized,
      })
      .where(eq(admins.id, adminId))
  } catch (err) {
    rethrowDbConflict(err, 'Email sudah digunakan oleh akun admin lain.')
  }

  const [updated] = await db
    .select({
      id: admins.id,
      nama: admins.nama,
      email: admins.email,
      noTelepon: updatedPhoneSelect(),
      role: admins.role,
      tokenVersion: admins.tokenVersion,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1)

  if (!updated) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Akun admin tidak ditemukan.',
    })
  }

  setAdminSessionCookie(event, {
    id: updated.id,
    email: updated.email,
    nama: updated.nama,
    role: updated.role,
    ver: updated.tokenVersion,
  })

  const contactChanged = before?.email !== updated.email || before?.noTelepon !== normalized
  await recordSecurityAudit(event, {
    eventType: 'admin.profile_updated',
    severity: contactChanged ? 'warn' : 'info',
    adminId: updated.id,
    actorEmail: updated.email,
    targetType: 'admin',
    targetId: updated.id,
    metadata: {
      emailChanged: before?.email !== updated.email,
      phoneChanged: before?.noTelepon !== normalized,
      whatsappNormalized: normalized,
    },
    notify: contactChanged,
  })

  invalidateChatbotSnapshotCache()

  return {
    ok: true,
    profile: {
      id: updated.id,
      nama: updated.nama,
      email: updated.email,
      noTelepon: updated.noTelepon || normalized,
      whatsappNormalized: normalized,
      whatsappDisplay: formatWhatsappDisplay(normalized),
      role: updated.role,
      createdAt: updated.createdAt,
    },
  }
})

function updatedPhoneSelect() {
  return admins.noTelepon
}
