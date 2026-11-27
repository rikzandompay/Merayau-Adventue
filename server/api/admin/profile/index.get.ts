import { eq } from 'drizzle-orm'
import { admins } from '../../../database/schema'

export default defineEventHandler(async (event) => {
  const adminId = event.context.admin?.id as number
  const db = useDb()

  const [row] = await db
    .select({
      id: admins.id,
      nama: admins.nama,
      email: admins.email,
      noTelepon: admins.noTelepon,
      role: admins.role,
      createdAt: admins.createdAt,
    })
    .from(admins)
    .where(eq(admins.id, adminId))
    .limit(1)

  if (!row) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Akun admin tidak ditemukan.',
    })
  }

  const normalized = normalizeWhatsappNumber(row.noTelepon || '')
  const whatsappNormalized = isValidWhatsappNumber(normalized)
    ? normalized
    : DEFAULT_CONTACT_WHATSAPP

  return {
    profile: {
      id: row.id,
      nama: row.nama,
      email: row.email,
      noTelepon: row.noTelepon || DEFAULT_CONTACT_WHATSAPP,
      whatsappNormalized,
      whatsappDisplay: formatWhatsappDisplay(whatsappNormalized),
      role: row.role,
      createdAt: row.createdAt,
    },
  }
})
