import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from '../database/schema'

let pool: mysql.Pool | null = null
let db: MySql2Database<typeof schema> | null = null

function resolveDbConfig() {
  try {
    const config = useRuntimeConfig()
    return {
      databaseUrl: config.databaseUrl || process.env.DATABASE_URL || '',
      host: config.dbHost || process.env.DB_HOST || '127.0.0.1',
      port: Number(config.dbPort || process.env.DB_PORT || 3307),
      user: config.dbUser || process.env.DB_USER || 'merayau',
      password: config.dbPassword ?? process.env.DB_PASSWORD ?? '',
      database: config.dbName || process.env.DB_NAME || 'merayau_outdoor',
      dbSsl: String(config.dbSsl || process.env.DB_SSL || ''),
    }
  } catch {
    // Allow standalone CLI scripts such as seed.ts to run outside Nitro context.
    return {
      databaseUrl: process.env.DATABASE_URL || '',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3307),
      user: process.env.DB_USER || 'merayau',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'merayau_outdoor',
      dbSsl: String(process.env.DB_SSL || ''),
    }
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

export function shouldUseSsl(
  host: string,
  port: number,
  sslFlag: string,
  rawUrl: string,
): boolean {
  const flag = sslFlag.trim().toLowerCase()
  if (flag === 'false' || flag === '0') return false
  if (flag === 'true' || flag === '1') return true
  const hostLower = host.trim().toLowerCase()
  if (hostLower.includes('tidbcloud.com')) return true
  if (port === 4000) return true
  const urlLower = rawUrl.toLowerCase()
  if (urlLower.includes('tidbcloud.com') || urlLower.includes('ssl=')) return true
  if (process.env.NODE_ENV === 'production' && hostLower && !LOOPBACK_HOSTS.has(hostLower)) {
    return true
  }
  return false
}

export function buildPoolOptionsFromEnv(): mysql.PoolOptions {
  const cfg = resolveDbConfig()
  const poolLimit = Math.max(1, Number(process.env.DB_POOL_LIMIT || 5))

  if (cfg.databaseUrl) {
    const u = new URL(cfg.databaseUrl)
    const host = u.hostname
    const port = Number(u.port || 3306)
    const useSsl = shouldUseSsl(host, port, cfg.dbSsl, cfg.databaseUrl)
    return {
      host,
      port,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: poolLimit,
      enableKeepAlive: true,
      ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
    }
  }

  const useSsl = shouldUseSsl(cfg.host, cfg.port, cfg.dbSsl, '')
  return {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password || undefined,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: poolLimit,
    enableKeepAlive: true,
    ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
  }
}

export function getPool(): mysql.Pool {
  if (pool) return pool
  pool = mysql.createPool(buildPoolOptionsFromEnv())
  return pool
}

export function useDb(): MySql2Database<typeof schema> {
  if (db) return db
  db = drizzle(getPool(), { schema, mode: 'default' })
  return db
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
    db = null
  }
}

export type DbInstance = MySql2Database<typeof schema>
export type DbExecutor = Pick<DbInstance, 'select' | 'insert' | 'update' | 'delete' | 'execute'>
