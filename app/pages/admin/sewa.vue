<script setup lang="ts">
definePageMeta({ layout: 'admin' })

interface KategoriOption {
  id: number
  namaKategori: string
}

interface AlatOption {
  id: number
  kodeAlat: string
  idKategori: number
  namaKategori: string
  namaAlat: string
  hargaHarian: number
  hargaEfektif?: number
  stokTersedia: number
  statusAktif: boolean
}

interface PaketOption {
  id: number
  kodePaket: string
  namaPaket: string
  tipePaket?: 'paket' | 'bundle'
  tarifPaket: number
  hargaEfektif?: number
  kuotaTersedia: number
  statusAktif: boolean
  items: Array<{ idAlat: number; namaAlat: string; jumlah: number; hargaHarian: number }>
}

interface PenyewaOption {
  id: number
  nama: string
  noWa: string
  alamat: string
}

interface SewaSetting {
  durasiDasarJam: number
  minHariPromo: number
  diskonPersen: number
  toleransiTelatJam: number
  dendaPersenHarian: number
}

const [
  { data: alatRes },
  { data: paketRes },
  { data: promoRes },
  { data: penyewaRes, refresh: refreshPenyewa },
  { data: settingRes },
] = await Promise.all([
  useFetch<{ items: AlatOption[]; categories: KategoriOption[] }>('/api/admin/alat'),
  useFetch<PaketOption[]>('/api/admin/paket-alat'),
  useFetch<Array<{
    id: number
    targetTipe: 'semua_alat' | 'kategori' | 'alat' | 'paket'
    targetId: number | null
    tipePotongan: 'persen' | 'nominal'
    nilaiPotongan: number
    tanggalMulai: string | null
    tanggalSelesai: string | null
    statusAktif: boolean
  }>>('/api/admin/promo-diskon'),
  useFetch<PenyewaOption[]>('/api/admin/penyewa'),
  useFetch<SewaSetting>('/api/admin/pengaturan-sewa'),
])

const now = new Date()
const inTwoDays = new Date(now.getTime() + 2 * 86_400_000)

const quickPickId = ref(0)
const form = reactive({
  namaPenyewa: '',
  noWa: '',
  alamat: '',
  jenisJaminan: 'KTP' as 'KTP' | 'SIM' | 'Kartu Pelajar',
  tanggalPinjam: toDatetimeLocalValue(now),
  tanggalKembaliRencana: toDatetimeLocalValue(inTwoDays),
})

watch(quickPickId, (id) => {
  if (!id) return
  const cust = (penyewaRes.value ?? []).find((p) => p.id === id)
  if (cust) {
    form.namaPenyewa = cust.nama
    form.noWa = cust.noWa
    form.alamat = cust.alamat
  }
  quickPickId.value = 0
})

const itemLines = ref<Array<{ idKategori: number; idAlat: number; jumlah: number }>>([])
const paketLines = ref<Array<{ idPaket: number; qtyPaket: number }>>([])
const saving = ref(false)
const feedback = ref<{ type: 'ok' | 'err'; msg: string } | null>(null)

const activeAlatOptions = computed(() =>
  (alatRes.value?.items ?? []).filter((a) => a.statusAktif && a.stokTersedia > 0),
)
const activePaketOptions = computed(() =>
  (paketRes.value ?? []).filter((p) => p.statusAktif && p.kuotaTersedia > 0),
)
const categoriesWithStock = computed(() =>
  (alatRes.value?.categories ?? []).filter((c) =>
    activeAlatOptions.value.some((a) => a.idKategori === c.id),
  ),
)

function activeAlatByCategory(catId: number) {
  return activeAlatOptions.value.filter((a) => a.idKategori === catId)
}

function onCategoryChange(line: { idKategori: number; idAlat: number }) {
  line.idAlat = line.idKategori ? (activeAlatByCategory(line.idKategori)[0]?.id ?? 0) : 0
}

if (activeAlatOptions.value.length && !itemLines.value.length) {
  itemLines.value.push({ idKategori: 0, idAlat: 0, jumlah: 1 })
}

function addToolLine() {
  if (!activeAlatOptions.value.length) return
  itemLines.value.push({ idKategori: 0, idAlat: 0, jumlah: 1 })
}

function addPaketLine() {
  const first = activePaketOptions.value[0]
  if (!first) return
  paketLines.value.push({ idPaket: first.id, qtyPaket: 1 })
}

const setting = computed<SewaSetting>(() => ({
  durasiDasarJam: settingRes.value?.durasiDasarJam ?? 24,
  minHariPromo: settingRes.value?.minHariPromo ?? 3,
  diskonPersen: settingRes.value?.diskonPersen ?? 15,
  toleransiTelatJam: settingRes.value?.toleransiTelatJam ?? 2,
  dendaPersenHarian: settingRes.value?.dendaPersenHarian ?? 50,
}))

const durationDays = computed(() => {
  const start = new Date(form.tanggalPinjam)
  const end = new Date(form.tanggalKembaliRencana)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 1
  return Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (setting.value.durasiDasarJam * 3_600_000)),
  )
})

function bestDatePromoRate(
  baseRate: number,
  targetCheck: (p: { targetTipe: string; targetId: number | null }) => boolean,
  refDateMs: number,
): number {
  let bestSaving = 0
  for (const p of promoRes.value ?? []) {
    if (!p.statusAktif || !targetCheck(p)) continue
    const s = p.tanggalMulai ? new Date(p.tanggalMulai).getTime() : null
    const e = p.tanggalSelesai ? new Date(p.tanggalSelesai).getTime() : null
    if (s !== null && Number.isFinite(s) && refDateMs < s) continue
    if (e !== null && Number.isFinite(e) && refDateMs > e) continue
    const saving =
      p.tipePotongan === 'persen'
        ? Math.min(baseRate, Math.round((baseRate * Math.min(95, p.nilaiPotongan)) / 100))
        : Math.min(baseRate, p.nilaiPotongan)
    if (saving > bestSaving) bestSaving = saving
  }
  return Math.max(0, baseRate - bestSaving)
}

const summary = computed(() => {
  const alatMap = new Map((alatRes.value?.items ?? []).map((a) => [a.id, a]))
  const paketMap = new Map((paketRes.value ?? []).map((p) => [p.id, p]))
  const pinjamTime = new Date(form.tanggalPinjam).getTime()
  const refMs = Number.isFinite(pinjamTime) ? pinjamTime : Date.now()

  const regularSub = itemLines.value.reduce((acc, l) => {
    if (!l.idAlat) return acc
    const a = alatMap.get(l.idAlat)
    if (!a) return acc
    const rate = bestDatePromoRate(
      a.hargaHarian,
      (p) =>
        p.targetTipe === 'semua_alat' ||
        (p.targetTipe === 'kategori' && p.targetId === a.idKategori) ||
        (p.targetTipe === 'alat' && p.targetId === a.id),
      refMs,
    )
    return acc + rate * l.jumlah * durationDays.value
  }, 0)
  const bundleSub = paketLines.value.reduce((acc, p) => {
    const pkg = paketMap.get(p.idPaket)
    if (!pkg) return acc
    const rate = bestDatePromoRate(
      pkg.tarifPaket,
      (pr) => pr.targetTipe === 'paket' && pr.targetId === pkg.id,
      refMs,
    )
    return acc + rate * p.qtyPaket * durationDays.value
  }, 0)
  const fullSub = regularSub + bundleSub
  const promoDiskon =
    durationDays.value >= setting.value.minHariPromo && setting.value.minHariPromo > 0
      ? Math.round((fullSub * setting.value.diskonPersen) / 100)
      : 0
  return {
    subtotal: fullSub,
    promoDiskon,
    totalBayar: Math.max(0, fullSub - promoDiskon),
  }
})

async function submitRental() {
  feedback.value = null
  if (
    !form.namaPenyewa.trim() ||
    !form.noWa.trim() ||
    !form.alamat.trim()
  ) {
    feedback.value = {
      type: 'err',
      msg: 'Lengkapi nama, no. WhatsApp, dan alamat penyewa.',
    }
    return
  }
  const validItemLines = itemLines.value
    .filter((l) => l.idAlat > 0)
    .map(({ idAlat, jumlah }) => ({ idAlat, jumlah }))

  if (!validItemLines.length && !paketLines.value.length) {
    feedback.value = {
      type: 'err',
      msg: 'Pilih kategori & alat satuan, atau tambahkan minimal 1 paket.',
    }
    return
  }

  saving.value = true
  try {
    const created = await $fetch<{ kodeSewa: string }>('/api/admin/transaksi', {
      method: 'POST',
      body: {
        penyewa: {
          nama: form.namaPenyewa.trim(),
          noWa: form.noWa.trim(),
          alamat: form.alamat.trim(),
        },
        jenisJaminan: form.jenisJaminan,
        tanggalPinjam: new Date(form.tanggalPinjam).toISOString(),
        tanggalKembaliRencana: new Date(form.tanggalKembaliRencana).toISOString(),
        items: validItemLines,
        paketItems: paketLines.value,
      },
    })
    feedback.value = { type: 'ok', msg: `Transaksi ${created.kodeSewa} tersimpan.` }
    form.namaPenyewa = ''
    form.noWa = ''
    form.alamat = ''
    await Promise.all([refreshPenyewa(), refreshNuxtData()])
  } catch (err: unknown) {
    feedback.value = {
      type: 'err',
      msg: extractErrorMessage(err, 'Gagal menyimpan transaksi sewa.'),
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p class="ed-label" style="color: var(--srf-accent)">
          TRANSAKSI SEWA BARU
        </p>
        <h1 class="font-serif-display text-3xl font-bold tracking-tight">
          Catat Sewa Alat
        </h1>
        <p class="mt-1 text-sm" style="color: var(--srf-ink-2)">
          Catat penyewaan alat satuan atau paket alat dengan pengecekan stok otomatis. Pengembalian &amp; denda dikelola di menu Alat Disewa.
        </p>
      </div>
      <NuxtLink to="/admin/alat-disewa" class="ed-btn-secondary !text-xs">
        Kelola Pengembalian di Alat Disewa →
      </NuxtLink>
    </div>

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div class="ed-card p-5 space-y-5 lg:col-span-8">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold">1. Data Penyewa &amp; Jaminan Fisik</h2>
          <div class="flex flex-wrap items-center gap-2">
            <select
              v-if="penyewaRes?.length"
              v-model="quickPickId"
              class="ed-select !w-auto !py-1.5 !text-xs"
              aria-label="Isi cepat dari penyewa lama"
            >
              <option :value="0">Isi dari penyewa lama...</option>
              <option v-for="p in penyewaRes" :key="p.id" :value="p.id">
                {{ p.nama }} · {{ p.noWa }}
              </option>
            </select>
            <NuxtLink to="/admin/penyewa" class="ed-btn-secondary !px-3 !py-1.5 !text-xs">
              + Kelola Penyewa
            </NuxtLink>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <label class="ed-label">NAMA PENYEWA</label>
            <input
              v-model="form.namaPenyewa"
              type="text"
              class="ed-input"
              placeholder="Nama lengkap penyewa"
            />
          </div>
          <div class="space-y-1.5">
            <label class="ed-label">NO. WHATSAPP</label>
            <input
              v-model="form.noWa"
              type="text"
              class="ed-input tabular"
              placeholder="0812xxxxxxxx"
            />
          </div>
          <div class="space-y-1.5">
            <label class="ed-label">JAMINAN FISIK</label>
            <select v-model="form.jenisJaminan" class="ed-select">
              <option value="KTP">KTP</option>
              <option value="SIM">SIM</option>
              <option value="Kartu Pelajar">Kartu Pelajar</option>
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="ed-label">ALAMAT</label>
            <input
              v-model="form.alamat"
              type="text"
              class="ed-input"
              placeholder="Alamat domisili penyewa"
            />
          </div>
          <div class="space-y-1.5">
            <label class="ed-label">TANGGAL &amp; JAM PINJAM</label>
            <input v-model="form.tanggalPinjam" type="datetime-local" class="ed-input tabular" />
          </div>
          <div class="space-y-1.5">
            <label class="ed-label">RENCANA KEMBALI ({{ durationDays }} HARI)</label>
            <input
              v-model="form.tanggalKembaliRencana"
              type="datetime-local"
              class="ed-input tabular"
            />
          </div>
        </div>

        <div class="border-t pt-4 space-y-3" style="border-color: var(--srf-line)">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">2. Daftar Alat &amp; Paket yang Disewa</h2>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="ed-btn-secondary !px-3 !py-1.5 !text-xs"
                :disabled="!activePaketOptions.length"
                @click="addPaketLine"
              >
                + Tambah Paket
              </button>
              <button
                type="button"
                class="ed-btn-secondary !px-3 !py-1.5 !text-xs"
                :disabled="!activeAlatOptions.length"
                @click="addToolLine"
              >
                + Tambah Alat Satuan
              </button>
            </div>
          </div>

          <div v-if="paketLines.length" class="space-y-2">
            <div class="ed-label">PAKET ALAT</div>
            <div
              v-for="(pl, idx) in paketLines"
              :key="`p-${idx}`"
              class="ed-well flex flex-wrap items-center gap-2 p-2.5"
            >
              <select v-model="pl.idPaket" class="ed-select min-w-[220px] flex-1">
                <option v-for="pkg in activePaketOptions" :key="pkg.id" :value="pkg.id">
                  {{ pkg.tipePaket === 'bundle' ? '[Bundle]' : '[Paket]' }} {{ pkg.namaPaket }} · {{ formatRupiah(pkg.hargaEfektif ?? pkg.tarifPaket) }}/24j (Kuota {{ pkg.kuotaTersedia }})
                </option>
              </select>
              <input
                v-model.number="pl.qtyPaket"
                type="number"
                min="1"
                class="ed-input tabular !w-24"
                placeholder="Qty"
              />
              <button
                type="button"
                class="cursor-pointer px-2 text-xs font-semibold"
                style="color: var(--srf-bad)"
                @click="paketLines.splice(idx, 1)"
              >
                Hapus
              </button>
            </div>
          </div>

          <div v-if="itemLines.length" class="space-y-2">
            <div class="ed-label">ALAT SATUAN</div>
            <div
              v-for="(line, idx) in itemLines"
              :key="`i-${idx}`"
              class="flex flex-wrap items-center gap-2"
            >
              <select
                v-model.number="line.idKategori"
                class="ed-select w-full sm:w-44"
                aria-label="Kategori alat"
                @change="onCategoryChange(line)"
              >
                <option :value="0">Pilih kategori...</option>
                <option v-for="cat in categoriesWithStock" :key="cat.id" :value="cat.id">
                  {{ cat.namaKategori }}
                </option>
              </select>
              <select
                v-model.number="line.idAlat"
                :disabled="!line.idKategori"
                class="ed-select min-w-[200px] flex-1"
                aria-label="Pilih alat"
              >
                <option v-if="!line.idKategori" :value="0">Pilih kategori dulu...</option>
                <option
                  v-for="alat in activeAlatByCategory(line.idKategori)"
                  :key="alat.id"
                  :value="alat.id"
                >
                  {{ alat.namaAlat }} · {{ formatRupiah(alat.hargaEfektif ?? alat.hargaHarian) }}/24j (Stok {{ alat.stokTersedia }})
                </option>
              </select>
              <input
                v-model.number="line.jumlah"
                type="number"
                min="1"
                class="ed-input tabular !w-20"
              />
              <button
                type="button"
                class="cursor-pointer px-2 text-xs font-semibold"
                style="color: var(--srf-bad)"
                @click="itemLines.splice(idx, 1)"
              >
                Hapus
              </button>
            </div>
          </div>

          <div
            v-if="!itemLines.length && !paketLines.length"
            class="ed-well p-4 text-xs"
            style="color: var(--srf-ink-3)"
          >
            Belum ada item sewa dipilih. Klik tombol di atas untuk menambah alat atau paket.
          </div>
        </div>
      </div>

      <div class="space-y-5 lg:col-span-4">
        <div class="ed-card p-5 space-y-4">
          <div>
            <p class="ed-label" style="color: var(--srf-accent)">RINGKASAN NOTA SEWA</p>
            <h2 class="text-sm font-semibold">Total Tagihan Transaksi</h2>
          </div>

          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span style="color: var(--srf-ink-2)">Durasi sewa</span>
              <span class="tabular font-semibold">{{ durationDays }} hari ({{ setting.durasiDasarJam }}j/hari)</span>
            </div>
            <div class="flex justify-between">
              <span style="color: var(--srf-ink-2)">Subtotal sewa</span>
              <span class="tabular font-medium">{{ formatRupiah(summary.subtotal) }}</span>
            </div>
            <div class="flex justify-between">
              <span style="color: var(--srf-ink-2)">
                Promo durasi (&gt;= {{ setting.minHariPromo }} hr · {{ setting.diskonPersen }}%)
              </span>
              <span class="tabular font-semibold" style="color: var(--srf-good)">
                -{{ formatRupiah(summary.promoDiskon) }}
              </span>
            </div>
            <div class="flex justify-between">
              <span style="color: var(--srf-ink-2)">Jaminan fisik</span>
              <span class="font-semibold">{{ form.jenisJaminan }}</span>
            </div>
          </div>

          <div
            class="flex items-baseline justify-between border-t pt-3"
            style="border-color: var(--srf-line)"
          >
            <span class="text-xs font-semibold" style="color: var(--srf-ink-2)">Total Dibayar</span>
            <span class="font-serif-display tabular text-2xl font-bold">
              {{ formatRupiah(summary.totalBayar) }}
            </span>
          </div>

          <div
            v-if="feedback"
            class="rounded-md border px-3 py-2 text-xs font-medium"
            :style="{
              backgroundColor: 'var(--srf-well)',
              borderColor: feedback.type === 'ok' ? 'var(--srf-good)' : 'var(--srf-bad)',
              color: feedback.type === 'ok' ? 'var(--srf-good)' : 'var(--srf-bad)',
            }"
          >
            {{ feedback.msg }}
          </div>

          <button
            type="button"
            class="ed-btn-primary w-full"
            :disabled="saving"
            @click="submitRental"
          >
            {{ saving ? 'Menyimpan...' : 'Simpan Transaksi Sewa' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

