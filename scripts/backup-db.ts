import { createHash } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import * as mysql from 'mysql2/promise'

try {
  process.loadEnvFile?.()
} catch {
  // Use environment variables already present in the shell.
}

function resolveBackupPoolOptions(): mysql.PoolOptions {
  const rawUrl = (process.env.DATABASE_URL || '').trim()
  const sslFlag = (process.env.DB_SSL || '').trim().toLowerCase()
  const loopback = new Set(['127.0.0.1', 'localhost', '::1'])

  if (rawUrl) {
    const u = new URL(rawUrl)
    const host = u.hostname
    const port = Number(u.port || 3306)
    const useSsl =
      sslFlag === 'true' ||
      sslFlag === '1' ||
      (sslFlag !== 'false' &&
        sslFlag !== '0' &&
        (host.toLowerCase().includes('tidbcloud.com') ||
          port === 4000 ||
          rawUrl.toLowerCase().includes('ssl=') ||
          (process.env.NODE_ENV === 'production' && !loopback.has(host.toLowerCase()))))
    return {
      host,
      port,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password) || undefined,
      database: u.pathname.replace(/^\//, ''),
      dateStrings: true,
      ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
    }
  }

  const host = process.env.DB_HOST || '127.0.0.1'
  const port = Number(process.env.DB_PORT || 3307)
  const useSsl =
    sslFlag === 'true' ||
    sslFlag === '1' ||
    (sslFlag !== 'false' &&
      sslFlag !== '0' &&
      (host.toLowerCase().includes('tidbcloud.com') ||
        port === 4000 ||
        (process.env.NODE_ENV === 'production' && !loopback.has(host.toLowerCase()))))

  return {
    host,
    port,
    user: process.env.DB_USER || 'merayau',
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME || 'merayau_outdoor',
    dateStrings: true,
    ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
  }
}

const BACKUP_TABLES = [
  'admins',
  'kategori_alat',
  'master_alat',
  'paket_alat',
  'paket_alat_item',
  'promo_diskon',
  'pengaturan_sewa',
  'penyewa',
  'transaksi_sewa',
  'detail_sewa',
  'info_trip',
  'trip_paket',
  'trip_meeting_point',
  'peserta_trip',
  'riwayat_penyewa',
  'security_audit_logs',
] as const

export interface BackupArchive {
  version: 1
  createdAt: string
  database: string
  rowCounts: Record<string, number>
  tables: Record<string, Array<Record<string, unknown>>>
  sha256: string
}

async function main() {
  const poolOpts = resolveBackupPoolOptions()
  const pool = mysql.createPool(poolOpts)

  try {
    const [existingTableRows] = await pool.query<mysql.RowDataPacket[]>('SHOW TABLES')
    const existingSet = new Set(existingTableRows.map((r) => String(Object.values(r)[0])))

    const tables: Record<string, Array<Record<string, unknown>>> = {}
    const rowCounts: Record<string, number> = {}

    for (const table of BACKUP_TABLES) {
      if (!existingSet.has(table)) {
        tables[table] = []
        rowCounts[table] = 0
        continue
      }
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT * FROM \`${table}\` ORDER BY \`id\` ASC`,
      )
      tables[table] = rows as Array<Record<string, unknown>>
      rowCounts[table] = rows.length
    }

    const canonicalPayload = JSON.stringify({ tables, rowCounts })
    const sha256 = createHash('sha256').update(canonicalPayload, 'utf8').digest('hex')

    const archive: BackupArchive = {
      version: 1,
      createdAt: new Date().toISOString(),
      database: String(poolOpts.database || 'merayau_outdoor'),
      rowCounts,
      tables,
      sha256,
    }

    const backupDir = resolve(process.cwd(), 'backups')
    await mkdir(backupDir, { recursive: true, mode: 0o700 })

    const stamp = archive.createdAt.replace(/[:.]/g, '-')
    const outPath = resolve(backupDir, `merayau-backup-${stamp}.json.gz`)
    const compressed = gzipSync(Buffer.from(JSON.stringify(archive), 'utf8'), { level: 9 })

    await writeFile(outPath, compressed, { mode: 0o600 })
    await chmod(outPath, 0o600)
    await writeFile(`${outPath}.sha256`, `${sha256}  merayau-backup-${stamp}.json.gz\n`, {
      mode: 0o600,
    })

    const totalRows = Object.values(rowCounts).reduce((s, n) => s + n, 0)
    console.log(
      JSON.stringify(
        {
          ok: true,
          backupFile: outPath,
          sizeBytes: compressed.length,
          totalTables: BACKUP_TABLES.length,
          totalRows,
          sha256,
        },
        null,
        2,
      ),
    )
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Backup failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
