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

export function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as { data?: { statusMessage?: string }; statusMessage?: string }
  return e?.data?.statusMessage || e?.statusMessage || fallback
}

export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function rowDateKey(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : toLocalDateKey(d)
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  if (!rows.length || !import.meta.client) return
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [
    headers.map(esc).join(','),
    ...rows.map((r) => r.map(esc).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

