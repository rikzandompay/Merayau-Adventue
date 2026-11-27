import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'
import * as mysql from 'mysql2/promise'

try {
  process.loadEnvFile?.()
} catch {
  // Use environment variables already present in the shell.
}

function resolveRestoreConnectionOptions(): mysql.ConnectionOptions {
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
      multipleStatements: false,
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
    multipleStatements: false,
    ...(useSsl ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}),
  }
}

const RESTORE_ORDER = [
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

interface BackupArchive {
  version: number
  createdAt: string
  database: string
  rowCounts: Record<string, number>
  tables: Record<string, Array<Record<string, unknown>>>
  sha256: string
}

async function resolveBackupPath(args: string[]): Promise<string> {
  const backupDir = resolve(process.cwd(), 'backups')
  const fileIdx = args.indexOf('--file')
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    const candidate = resolve(process.cwd(), args[fileIdx + 1]!)
    if (!candidate.startsWith(`${backupDir}${sep}`) && !candidate.endsWith('.json.gz')) {
      throw new Error('File backup harus berformat .json.gz yang valid.')
    }
    return candidate
  }

  const entries = (await readdir(backupDir)).filter((f) => f.endsWith('.json.gz')).sort()
  if (!entries.length) {
    throw new Error('Tidak ada arsip backup ditemukan di folder backups/.')
  }
  return resolve(backupDir, entries[entries.length - 1]!)
}

async function main() {
  const args = process.argv.slice(2)
  const confirmed = args.includes('--confirm')
  const archivePath = await resolveBackupPath(args)

  const compressed = await readFile(archivePath)
  const rawJson = gunzipSync(compressed).toString('utf8')
  const archive = JSON.parse(rawJson) as BackupArchive

  if (archive.version !== 1 || !archive.tables || !archive.rowCounts || !archive.sha256) {
    throw new Error('Struktur arsip backup tidak dikenali.')
  }

  const computedHash = createHash('sha256')
    .update(JSON.stringify({ tables: archive.tables, rowCounts: archive.rowCounts }), 'utf8')
    .digest('hex')

  if (computedHash !== archive.sha256) {
    throw new Error('Verifikasi integritas SHA-256 gagal! Arsip backup rusak atau telah dimodifikasi.')
  }

  if (!confirmed) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'verify-only',
          archivePath,
          createdAt: archive.createdAt,
          sha256Verified: true,
          rowCounts: archive.rowCounts,
          hint: 'Tambahkan argumen --confirm untuk menjalankan pemulihan data ke database.',
        },
        null,
        2,
      ),
    )
    return
  }

  const conn = await mysql.createConnection(resolveRestoreConnectionOptions())

  try {
    const [existingTableRows] = await conn.query<mysql.RowDataPacket[]>('SHOW TABLES')
    const existingSet = new Set(existingTableRows.map((r) => String(Object.values(r)[0])))

    await conn.beginTransaction()
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')

    for (const table of [...RESTORE_ORDER].reverse()) {
      if (!existingSet.has(table)) continue
      await conn.query(`DELETE FROM \`${table}\``)
    }

    for (const table of RESTORE_ORDER) {
      if (!existingSet.has(table)) continue
      const rows = archive.tables[table] ?? []
      if (!rows.length) continue

      const cols = Object.keys(rows[0]!)
      const colSql = cols.map((c) => `\`${c.replace(/`/g, '``')}\``).join(', ')
      const rowPlaceholder = `(${cols.map(() => '?').join(', ')})`
      const batchSize = 50

      for (let i = 0; i < rows.length; i += batchSize) {
        const slice = rows.slice(i, i + batchSize)
        const placeholders = slice.map(() => rowPlaceholder).join(', ')
        const values: unknown[] = []
        for (const r of slice) {
          for (const c of cols) {
            values.push(r[c])
          }
        }
        await conn.query(`INSERT INTO \`${table}\` (${colSql}) VALUES ${placeholders}`, values)
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
    await conn.commit()

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'restored',
          archivePath,
          sha256Verified: true,
          restoredTables: RESTORE_ORDER.filter((t) => existingSet.has(t)).length,
        },
        null,
        2,
      ),
    )
  } catch (err) {
    await conn.rollback().catch(() => {})
    await conn.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {})
    throw err
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('Restore failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
