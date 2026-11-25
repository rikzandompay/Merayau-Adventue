import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  try {
    const db = useDb()
    await db.execute(sql`SELECT 1`)
    return { ok: true, database: 'connected' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error'
    throw createError({
      statusCode: 500,
      statusMessage: `Database connection failed: ${message}`,
    })
  }
})

