import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile?.()
} catch {
  // Continue with existing environment variables when .env is absent.
}

function getDbCredentials() {
  const rawUrl = process.env.DATABASE_URL || ''
  const sslFlag = String(process.env.DB_SSL || '').trim().toLowerCase()

  if (rawUrl) {
    const u = new URL(rawUrl)
    const host = u.hostname
    const port = Number(u.port || 3306)
    const useSsl =
      sslFlag === 'true' ||
      sslFlag === '1' ||
      host.toLowerCase().includes('tidbcloud.com') ||
      port === 4000 ||
      rawUrl.toLowerCase().includes('ssl=')
    return {
      host,
      port,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password) || undefined,
      database: u.pathname.replace(/^\//, ''),
      ...(useSsl ? { ssl: { rejectUnauthorized: true } } : {}),
    }
  }

  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT || 3307)
  const useSsl =
    sslFlag === 'true' ||
    sslFlag === '1' ||
    host.toLowerCase().includes('tidbcloud.com') ||
    port === 4000

  return {
    host,
    port,
    user: process.env.DB_USER || 'merayau',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'merayau_outdoor',
    ...(useSsl ? { ssl: { rejectUnauthorized: true } } : {}),
  }
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dialect: 'mysql',
  dbCredentials: getDbCredentials(),
})
