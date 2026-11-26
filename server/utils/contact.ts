import { asc } from 'drizzle-orm'
import { admins } from '../database/schema'
import { getPool, useDb } from './db'

export const DEFAULT_CONTACT_WHATSAPP = '6285156549003'
export const DEFAULT_CONTACT_EMAIL = 'admin@merayau.id'

export function normalizeWhatsappNumber(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`
  }
  if (digits.startsWith('8')) {
    return `62${digits}`
  }
  return digits
}

export function isValidWhatsappNumber(normalized: string): boolean {
  return /^\d{10,15}$/.test(normalized)
}

export function formatWhatsappDisplay(rawOrNormalized: string): string {
  const normalized = normalizeWhatsappNumber(rawOrNormalized)
  if (!normalized) return '+62 851-5654-9003'
  if (normalized.startsWith('62') && normalized.length >= 10) {
    const rest = normalized.slice(2)
    const part1 = rest.slice(0, 3)
    const part2 = rest.slice(3, 7)
    const part3 = rest.slice(7)
    return part3 ? `+62 ${part1}-${part2}-${part3}` : `+62 ${part1}-${part2}`
  }
  return `+${normalized}`
}

let ensurePhoneColumnPromise: Promise<void> | null = null

export async function ensureAdminPhoneColumn(): Promise<void> {
  if (!ensurePhoneColumnPromise) {
    ensurePhoneColumnPromise = (async () => {
      const pool = getPool()
      const [cols] = await pool.query<Array<{ Field: string }>>(
        "SHOW COLUMNS FROM `admins` LIKE 'no_telepon'",
      )
      if (!Array.isArray(cols) || cols.length === 0) {
        try {
          await pool.query(
            'ALTER TABLE `admins` ADD COLUMN `no_telepon` varchar(30) DEFAULT NULL AFTER `email`',
          )
        } catch (err: unknown) {
          const e = err as { code?: string; errno?: number }
          if (e?.code !== 'ER_DUP_FIELDNAME' && e?.errno !== 1060) {
            throw err
          }
        }
        await pool.query(
          "UPDATE `admins` SET `no_telepon` = ? WHERE `no_telepon` IS NULL OR TRIM(`no_telepon`) = ''",
          [DEFAULT_CONTACT_WHATSAPP],
        )
      }
    })().catch((err) => {
      ensurePhoneColumnPromise = null
      throw err
    })
  }
  return ensurePhoneColumnPromise
}

export async function getPrimaryAdminContact(): Promise<{
  whatsapp: string
  whatsappDisplay: string
  email: string
}> {
  try {
    await ensureAdminPhoneColumn()
    const db = useDb()
    const [primaryAdmin] = await db
      .select({
        email: admins.email,
        noTelepon: admins.noTelepon,
      })
      .from(admins)
      .orderBy(asc(admins.id))
      .limit(1)

    const normalizedWa = normalizeWhatsappNumber(primaryAdmin?.noTelepon || '')
    const whatsapp = isValidWhatsappNumber(normalizedWa)
      ? normalizedWa
      : DEFAULT_CONTACT_WHATSAPP
    return {
      whatsapp,
      whatsappDisplay: formatWhatsappDisplay(whatsapp),
      email: primaryAdmin?.email?.trim() || DEFAULT_CONTACT_EMAIL,
    }
  } catch (err) {
    console.warn('[contact] Failed to resolve primary admin contact, using default:', err)
    return {
      whatsapp: DEFAULT_CONTACT_WHATSAPP,
      whatsappDisplay: formatWhatsappDisplay(DEFAULT_CONTACT_WHATSAPP),
      email: DEFAULT_CONTACT_EMAIL,
    }
  }
}
