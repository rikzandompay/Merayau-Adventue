import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { admins } from '../../database/schema'

const loginSchema = z.object({
  email: z.string().trim().email('Format email tidak valid.'),
  password: z.string().min(4, 'Kata sandi minimal 4 karakter.'),
})

export default defineEventHandler(async (event) => {
  const body = await parseValidatedBody(event, loginSchema)
  const db = useDb()
  const [admin] = await db.select().from(admins).where(eq(admins.email, body.email)).limit(1)

  if (!admin || !verifyPassword(body.password, admin.passwordHash)) {
    throw createError({ statusCode: 401, statusMessage: 'Email atau kata sandi salah.' })
  }

  const user = { id: admin.id, email: admin.email, nama: admin.nama, role: admin.role }
  setAdminSessionCookie(event, user)
  return { ok: true, user }
})

