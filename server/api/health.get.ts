import { sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  try {
    const db = useDb()
    await db.execute(sql`SELECT 1`)
    return { ok: true, database: 'connected' }
  } catch (error) {
    const code = (error as { code?: string })?.code || 'DB_UNAVAILABLE'
    console.error('[health] Database connectivity check failed:', code)
    setResponseStatus(event, 503)
    return { ok: false, database: 'unavailable' }
  }
})
