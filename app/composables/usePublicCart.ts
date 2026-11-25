export interface PublicPromoRule {
  id: number
  namaPromo: string
  label: string
  targetTipe: 'semua_alat' | 'kategori' | 'alat' | 'paket'
  targetId: number | null
  tipePotongan: 'persen' | 'nominal'
  nilaiPotongan: number
  tanggalMulai: string | null
  tanggalSelesai: string | null
  statusBerjalan?: 'Aktif' | 'Terjadwal' | 'Berakhir' | 'Nonaktif'
}

export interface CartAlatItem {
  id: number
  idKategori?: number
  kodeAlat: string
  namaAlat: string
  namaKategori: string
  hargaHarian: number
  qty: number
  maxStok: number
  fotoUrl: string
}

export interface CartPaketItem {
  id: number
  namaPaket: string
  tipePaket?: 'paket' | 'bundle'
  tarifPaket: number
  qty: number
  maxKuota: number
  ringkasanIsi: string
}

export interface PublicAturan {
  durasiMinimalJam: number
  toleransiTelatJam: number
  dendaPersenHarian: number
  minHariPromo: number
  diskonPersen: number
}

const STORAGE_KEY = 'merayau_public_cart_v1'

function formatLocalIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoUtcMs(dateStr: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim())
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function addDaysIso(dateStr: string, days: number): string {
  const ms = parseIsoUtcMs(dateStr)
  if (ms === null) {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return formatLocalIsoDate(d)
  }
  const next = new Date(ms + days * 86400000)
  return next.toISOString().slice(0, 10)
}

function diffDaysIso(startStr: string, endStr: string): number {
  const startMs = parseIsoUtcMs(startStr)
  const endMs = parseIsoUtcMs(endStr)
  if (startMs === null || endMs === null) return 1
  return Math.max(1, Math.round((endMs - startMs) / 86400000))
}

function isPromoInSchedule(
  promo: PublicPromoRule,
  rentalStartMs: number,
  rentalEndMs: number,
): boolean {
  if (promo.statusBerjalan === 'Nonaktif' || promo.statusBerjalan === 'Berakhir') return false
  const pStart = promo.tanggalMulai ? new Date(promo.tanggalMulai).getTime() : null
  const pEnd = promo.tanggalSelesai ? new Date(promo.tanggalSelesai).getTime() : null
  if (pStart !== null && Number.isFinite(pStart) && rentalEndMs < pStart) return false
  if (pEnd !== null && Number.isFinite(pEnd) && rentalStartMs > pEnd) return false
  return true
}

function computeRuleSaving(basePrice: number, promo: PublicPromoRule): number {
  if (basePrice <= 0) return 0
  if (promo.tipePotongan === 'persen') {
    const pct = Math.min(95, Math.max(0, promo.nilaiPotongan))
    return Math.min(basePrice, Math.round((basePrice * pct) / 100))
  }
  return Math.min(basePrice, Math.max(0, promo.nilaiPotongan))
}

function pickBestSchedulePromo(
  basePrice: number,
  candidates: PublicPromoRule[],
  rentalStartMs: number,
  rentalEndMs: number,
) {
  let bestPromo: PublicPromoRule | null = null
  let bestSaving = 0
  for (const p of candidates) {
    if (!isPromoInSchedule(p, rentalStartMs, rentalEndMs)) continue
    const saving = computeRuleSaving(basePrice, p)
    if (saving > bestSaving) {
      bestSaving = saving
      bestPromo = p
    }
  }
  return { bestPromo, bestSaving }
}

export function formatPromoDateRangeId(startIso: string | null, endIso: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  if (startIso && endIso) return `${fmt(startIso)} - ${fmt(endIso)}`
  if (startIso) return `Mulai ${fmt(startIso)}`
  if (endIso) return `Sampai ${fmt(endIso)}`
  return 'Berlaku terus'
}

export function usePublicCart() {
  const alatItems = useState<CartAlatItem[]>('mry-cart-alat', () => [])
  const paketItems = useState<CartPaketItem[]>('mry-cart-paket', () => [])
  const catalogPromos = useState<PublicPromoRule[]>('mry-cart-promos', () => [])
  const tanggalAmbil = useState<string>('mry-cart-tanggal', () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatLocalIsoDate(d)
  })
  const tanggalKembali = useState<string>('mry-cart-tanggal-kembali', () =>
    addDaysIso(tanggalAmbil.value, 2),
  )
  const durasiHari = useState<number>('mry-cart-durasi', () =>
    diffDaysIso(tanggalAmbil.value, tanggalKembali.value),
  )
  const drawerOpen = useState<boolean>('mry-cart-open', () => false)
  const toastMessage = useState<string>('mry-cart-toast', () => '')
  const hydrated = useState<boolean>('mry-cart-hydrated', () => false)

  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function flashToast(msg: string) {
    toastMessage.value = msg
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toastMessage.value = ''
    }, 2800)
  }

  function saveStorage() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          alatItems: alatItems.value,
          paketItems: paketItems.value,
          durasiHari: durasiHari.value,
          tanggalAmbil: tanggalAmbil.value,
          tanggalKembali: tanggalKembali.value,
        }),
      )
    } catch {
      // ignore quota / private mode
    }
  }

  function initClientCart() {
    if (!import.meta.client || hydrated.value) return
    hydrated.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.alatItems)) alatItems.value = parsed.alatItems
      if (Array.isArray(parsed.paketItems)) paketItems.value = parsed.paketItems
      if (typeof parsed.tanggalAmbil === 'string' && parseIsoUtcMs(parsed.tanggalAmbil) !== null) {
        tanggalAmbil.value = parsed.tanggalAmbil
      }
      if (
        typeof parsed.tanggalKembali === 'string' &&
        parseIsoUtcMs(parsed.tanggalKembali) !== null &&
        parsed.tanggalKembali > tanggalAmbil.value
      ) {
        tanggalKembali.value = parsed.tanggalKembali
      } else {
        const savedDays =
          typeof parsed.durasiHari === 'number' && parsed.durasiHari >= 1
            ? Math.min(30, Math.round(parsed.durasiHari))
            : 2
        tanggalKembali.value = addDaysIso(tanggalAmbil.value, savedDays)
      }
      durasiHari.value = diffDaysIso(tanggalAmbil.value, tanggalKembali.value)
    } catch {
      // ignore corrupted storage
    }
  }

  function setCatalogPromos(list: PublicPromoRule[] | undefined | null) {
    if (Array.isArray(list)) {
      catalogPromos.value = list
    }
  }

  function syncCatalogPrices(
    alatList: Array<{ id: number; idKategori?: number; hargaHarian: number; stokTersedia?: number }> = [],
    pkgList: Array<{
      id: number
      tarifPaket: number
      tipePaket?: 'paket' | 'bundle'
      kuotaTersedia?: number
    }> = [],
  ) {
    let changed = false
    const alatMap = new Map(alatList.map((a) => [a.id, a]))
    const pkgMap = new Map(pkgList.map((p) => [p.id, p]))
    for (const item of alatItems.value) {
      const live = alatMap.get(item.id)
      if (!live) continue
      if (item.hargaHarian !== live.hargaHarian) {
        item.hargaHarian = live.hargaHarian
        changed = true
      }
      if (live.idKategori !== undefined && item.idKategori !== live.idKategori) {
        item.idKategori = live.idKategori
        changed = true
      }
      if (live.stokTersedia !== undefined && item.maxStok !== live.stokTersedia) {
        item.maxStok = live.stokTersedia
        changed = true
      }
    }
    for (const p of paketItems.value) {
      const live = pkgMap.get(p.id)
      if (!live) continue
      if (p.tarifPaket !== live.tarifPaket) {
        p.tarifPaket = live.tarifPaket
        changed = true
      }
      if (live.tipePaket && p.tipePaket !== live.tipePaket) {
        p.tipePaket = live.tipePaket
        changed = true
      }
      if (live.kuotaTersedia !== undefined && p.maxKuota !== live.kuotaTersedia) {
        p.maxKuota = live.kuotaTersedia
        changed = true
      }
    }
    if (changed) saveStorage()
  }

  function addAlat(
    item: {
      id: number
      idKategori?: number
      kodeAlat: string
      namaAlat: string
      namaKategori: string
      hargaHarian: number
      stokTersedia: number
      fotoUrl: string
    },
    openDrawer = false,
  ) {
    if (item.stokTersedia <= 0) {
      flashToast(`Stok ${item.namaAlat} sedang habis disewa`)
      return
    }
    const existing = alatItems.value.find((x) => x.id === item.id)
    if (existing) {
      if (existing.qty >= item.stokTersedia) {
        flashToast(`Maksimal ${item.stokTersedia} unit untuk ${item.namaAlat}`)
        return
      }
      existing.qty += 1
      existing.hargaHarian = item.hargaHarian
      existing.idKategori = item.idKategori ?? existing.idKategori
      existing.maxStok = item.stokTersedia
    } else {
      alatItems.value.push({
        id: item.id,
        idKategori: item.idKategori,
        kodeAlat: item.kodeAlat,
        namaAlat: item.namaAlat,
        namaKategori: item.namaKategori,
        hargaHarian: item.hargaHarian,
        qty: 1,
        maxStok: item.stokTersedia,
        fotoUrl: item.fotoUrl,
      })
    }
    saveStorage()
    flashToast(`+1 ${item.namaAlat} masuk daftar sewa`)
    if (openDrawer) drawerOpen.value = true
  }

  function setAlatQty(id: number, qty: number) {
    const idx = alatItems.value.findIndex((x) => x.id === id)
    if (idx === -1) return
    const target = alatItems.value[idx]
    if (!target) return
    if (qty <= 0) {
      alatItems.value.splice(idx, 1)
    } else {
      target.qty = Math.min(target.maxStok, qty)
    }
    saveStorage()
  }

  function addPaket(
    pkg: {
      id: number
      namaPaket: string
      tipePaket?: 'paket' | 'bundle'
      tarifPaket: number
      kuotaTersedia: number
      items: Array<{ namaAlat: string; jumlah: number }>
    },
    openDrawer = true,
  ) {
    if (pkg.kuotaTersedia <= 0) {
      flashToast(`Kuota ${pkg.namaPaket} sedang habis`)
      return
    }
    const existing = paketItems.value.find((p) => p.id === pkg.id)
    if (existing) {
      if (existing.qty >= pkg.kuotaTersedia) {
        flashToast(`Maksimal ${pkg.kuotaTersedia} paket untuk ${pkg.namaPaket}`)
        return
      }
      existing.qty += 1
      existing.tarifPaket = pkg.tarifPaket
      existing.tipePaket = pkg.tipePaket
      existing.maxKuota = pkg.kuotaTersedia
    } else {
      paketItems.value.push({
        id: pkg.id,
        namaPaket: pkg.namaPaket,
        tipePaket: pkg.tipePaket,
        tarifPaket: pkg.tarifPaket,
        qty: 1,
        maxKuota: pkg.kuotaTersedia,
        ringkasanIsi: pkg.items.map((it) => `${it.jumlah}x ${it.namaAlat}`).join(', '),
      })
    }
    saveStorage()
    flashToast(`+1 ${pkg.namaPaket} masuk daftar sewa`)
    if (openDrawer) drawerOpen.value = true
  }

  function setPaketQty(id: number, qty: number) {
    const idx = paketItems.value.findIndex((p) => p.id === id)
    if (idx === -1) return
    const target = paketItems.value[idx]
    if (!target) return
    if (qty <= 0) {
      paketItems.value.splice(idx, 1)
    } else {
      target.qty = Math.min(target.maxKuota, qty)
    }
    saveStorage()
  }

  const minTanggalAmbil = computed(() => formatLocalIsoDate(new Date()))
  const minTanggalKembali = computed(() => addDaysIso(tanggalAmbil.value, 1))

  function setDurasi(days: number) {
    const clamped = Math.max(1, Math.min(30, Math.round(days)))
    durasiHari.value = clamped
    tanggalKembali.value = addDaysIso(tanggalAmbil.value, clamped)
    saveStorage()
  }

  function setTanggal(dateStr: string) {
    if (parseIsoUtcMs(dateStr) === null) return
    tanggalAmbil.value = dateStr
    if (!tanggalKembali.value || tanggalKembali.value <= dateStr) {
      tanggalKembali.value = addDaysIso(dateStr, 1)
    }
    durasiHari.value = diffDaysIso(tanggalAmbil.value, tanggalKembali.value)
    saveStorage()
  }

  function setTanggalKembali(dateStr: string) {
    if (parseIsoUtcMs(dateStr) === null) return
    tanggalKembali.value = dateStr <= tanggalAmbil.value ? addDaysIso(tanggalAmbil.value, 1) : dateStr
    durasiHari.value = diffDaysIso(tanggalAmbil.value, tanggalKembali.value)
    saveStorage()
  }

  function clearCart() {
    alatItems.value = []
    paketItems.value = []
    saveStorage()
  }

  const totalCount = computed(
    () =>
      alatItems.value.reduce((s, x) => s + x.qty, 0) +
      paketItems.value.reduce((s, x) => s + x.qty, 0),
  )

  function getAlatQty(id: number): number {
    return alatItems.value.find((x) => x.id === id)?.qty ?? 0
  }

  function computeEstimate(
    aturan?: Partial<PublicAturan> | null,
    promosOverride?: PublicPromoRule[] | null,
  ) {
    const days = Math.max(1, durasiHari.value)
    const minPromo = aturan?.minHariPromo ?? 3
    const diskonPersen = aturan?.diskonPersen ?? 10
    const promos = promosOverride ?? catalogPromos.value

    const startParsed = new Date(`${tanggalAmbil.value}T00:00:00`).getTime()
    const endParsed = new Date(`${tanggalKembali.value}T23:59:59`).getTime()
    const rentalStartMs = Number.isFinite(startParsed) ? startParsed : Date.now()
    const rentalEndMs = Number.isFinite(endParsed) ? endParsed : rentalStartMs + days * 86_400_000

    let subtotalAlat = 0
    let subtotalPaket = 0
    let diskonItemPromoNominal = 0
    const appliedPromoMap = new Map<number, { namaPromo: string; label: string; nominal: number }>()
    const upcomingPromoMap = new Map<
      number,
      { namaPromo: string; label: string; tanggalMulai: string | null; tanggalSelesai: string | null }
    >()

    for (const x of alatItems.value) {
      subtotalAlat += x.hargaHarian * x.qty * days
      const matching = promos.filter(
        (p) =>
          p.targetTipe === 'semua_alat' ||
          (p.targetTipe === 'kategori' && x.idKategori !== undefined && p.targetId === x.idKategori) ||
          (p.targetTipe === 'alat' && p.targetId === x.id),
      )
      const { bestPromo, bestSaving } = pickBestSchedulePromo(
        x.hargaHarian,
        matching,
        rentalStartMs,
        rentalEndMs,
      )
      if (bestPromo && bestSaving > 0) {
        const lineSaving = bestSaving * x.qty * days
        diskonItemPromoNominal += lineSaving
        const cur = appliedPromoMap.get(bestPromo.id)
        if (cur) {
          cur.nominal += lineSaving
        } else {
          appliedPromoMap.set(bestPromo.id, {
            namaPromo: bestPromo.namaPromo,
            label: bestPromo.label,
            nominal: lineSaving,
          })
        }
      } else {
        for (const p of matching) {
          if (p.statusBerjalan === 'Terjadwal' && !isPromoInSchedule(p, rentalStartMs, rentalEndMs)) {
            upcomingPromoMap.set(p.id, {
              namaPromo: p.namaPromo,
              label: p.label,
              tanggalMulai: p.tanggalMulai,
              tanggalSelesai: p.tanggalSelesai,
            })
          }
        }
      }
    }

    for (const p of paketItems.value) {
      subtotalPaket += p.tarifPaket * p.qty * days
      const matching = promos.filter(
        (rule) => rule.targetTipe === 'paket' && rule.targetId === p.id,
      )
      const { bestPromo, bestSaving } = pickBestSchedulePromo(
        p.tarifPaket,
        matching,
        rentalStartMs,
        rentalEndMs,
      )
      if (bestPromo && bestSaving > 0) {
        const lineSaving = bestSaving * p.qty * days
        diskonItemPromoNominal += lineSaving
        const cur = appliedPromoMap.get(bestPromo.id)
        if (cur) {
          cur.nominal += lineSaving
        } else {
          appliedPromoMap.set(bestPromo.id, {
            namaPromo: bestPromo.namaPromo,
            label: bestPromo.label,
            nominal: lineSaving,
          })
        }
      } else {
        for (const rule of matching) {
          if (
            rule.statusBerjalan === 'Terjadwal' &&
            !isPromoInSchedule(rule, rentalStartMs, rentalEndMs)
          ) {
            upcomingPromoMap.set(rule.id, {
              namaPromo: rule.namaPromo,
              label: rule.label,
              tanggalMulai: rule.tanggalMulai,
              tanggalSelesai: rule.tanggalSelesai,
            })
          }
        }
      }
    }

    const baseSubtotal = subtotalAlat + subtotalPaket
    const afterItemPromo = Math.max(0, baseSubtotal - diskonItemPromoNominal)
    const isPromoEligible =
      afterItemPromo > 0 && minPromo > 0 && diskonPersen > 0 && days >= minPromo
    const diskonPromoNominal = isPromoEligible
      ? Math.round((afterItemPromo * diskonPersen) / 100)
      : 0
    const grandTotal = Math.max(0, afterItemPromo - diskonPromoNominal)

    return {
      days,
      isPromoEligible,
      minPromo,
      diskonPersen,
      subtotalAlat,
      subtotalPaket,
      diskonItemPromoNominal,
      appliedItemPromos: [...appliedPromoMap.values()],
      upcomingItemPromos: [...upcomingPromoMap.values()],
      diskonPromoNominal,
      grandTotal,
    }
  }

  function buildCartWaUrl(
    whatsapp: string,
    aturan?: Partial<PublicAturan> | null,
    promosOverride?: PublicPromoRule[] | null,
  ): string {
    const est = computeEstimate(aturan, promosOverride)
    const lines: string[] = [
      'Halo Admin Merayau Adventure Basecamp Pontianak,',
      'Saya mau booking perlengkapan berikut:',
      '',
    ]

    if (paketItems.value.length) {
      lines.push('*PAKET BUNDEL:*')
      for (const p of paketItems.value) {
        lines.push(`- ${p.qty}x ${p.namaPaket} (${formatRupiah(p.tarifPaket)}/24 jam)`)
      }
      lines.push('')
    }

    if (alatItems.value.length) {
      lines.push('*PERLENGKAPAN SATUAN:*')
      for (const a of alatItems.value) {
        lines.push(`- ${a.qty}x ${a.namaAlat} [${a.kodeAlat}] (${formatRupiah(a.hargaHarian)}/24 jam)`)
      }
      lines.push('')
    }

    lines.push(`Rencana ambil: ${tanggalAmbil.value || 'Akan dikonfirmasi'}`)
    lines.push(`Rencana kembali: ${tanggalKembali.value || 'Akan dikonfirmasi'}`)
    lines.push(`Durasi sewa: ${est.days} hari (${est.days * 24} jam)`)
    for (const p of est.appliedItemPromos) {
      lines.push(`Promo ${p.namaPromo} (${p.label}): -${formatRupiah(p.nominal)}`)
    }
    if (est.diskonPromoNominal > 0) {
      lines.push(`Diskon sewa >= ${est.minPromo} hari (${est.diskonPersen}%): -${formatRupiah(est.diskonPromoNominal)}`)
    }
    lines.push(`Estimasi total: *${formatRupiah(est.grandTotal)}*`)
    lines.push('')
    lines.push('Mohon konfirmasi ketersediaan stok ya Admin. Terima kasih!')

    return buildWaLink(whatsapp, lines.join('\n'))
  }

  return {
    alatItems,
    paketItems,
    catalogPromos,
    durasiHari,
    tanggalAmbil,
    tanggalKembali,
    minTanggalAmbil,
    minTanggalKembali,
    drawerOpen,
    toastMessage,
    totalCount,
    initClientCart,
    setCatalogPromos,
    syncCatalogPrices,
    addAlat,
    setAlatQty,
    addPaket,
    setPaketQty,
    setDurasi,
    setTanggal,
    setTanggalKembali,
    clearCart,
    getAlatQty,
    computeEstimate,
    buildCartWaUrl,
  }
}
