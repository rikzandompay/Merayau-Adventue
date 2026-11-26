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

