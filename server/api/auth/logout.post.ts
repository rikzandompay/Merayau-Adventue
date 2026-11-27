import { eq, sql } from 'drizzle-orm'
import { admins } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const session = await getVerifiedAdminSession(event)
  if (session) {
    const db = useDb()
    await db
      .update(admins)
      .set({ tokenVersion: sql`${admins.tokenVersion} + 1` })
      .where(eq(admins.id, session.id))

    await recordSecurityAudit(event, {
      eventType: 'auth.logout',
      severity: 'info',
      adminId: session.id,
      actorEmail: session.email,
    })
  }

  clearAdminSessionCookie(event)
  return { ok: true }
})
