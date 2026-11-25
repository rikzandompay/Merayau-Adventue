export function formatRupiah(amount: number | string | null | undefined): string {
  const val = Number(amount ?? 0)
  return `Rp ${Math.round(val).toLocaleString('id-ID')}`
}

export function formatCompactRupiah(amount: number | null | undefined): string {
  const val = Number(amount ?? 0)
  if (val >= 1_000_000) {
    return `Rp ${(val / 1_000_000).toFixed(1).replace('.', ',')} jt`
  }
  if (val >= 1_000) {
    return `Rp ${Math.round(val / 1_000)} rb`
  }
  return formatRupiah(val)
}

export function formatDateShort(input: string | Date | null | undefined): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return String(input)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTimeShort(input: string | Date | null | undefined): string {
  if (!input) return '-'
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return String(input)
  return `${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function buildWaLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`
  const base = `https://wa.me/${normalized}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

