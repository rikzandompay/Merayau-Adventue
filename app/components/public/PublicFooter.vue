<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    totalAlat?: number
    whatsapp?: string
    whatsappDisplay?: string
    email?: string
    alamat?: string
    mapsUrl?: string
  }>(),
  {
    totalAlat: 58,
    whatsapp: '6285156549003',
    whatsappDisplay: '+62 851-5654-9003',
    email: 'halo@merayau.id',
    alamat:
      'Jl. Tanjung Raya 2 Gg. Nusa Abadi No. 22b (gang tepat di samping Mr. DIY Tanray 2), Pontianak, Kalimantan Barat',
    mapsUrl:
      'https://www.google.com/maps/search/?api=1&query=Jl.+Tanjung+Raya+2+Gg.+Nusa+Abadi+No.+22b+Pontianak',
  },
)

const copiedKey = ref<'bca' | 'bri' | null>(null)

async function copyRekening(key: 'bca' | 'bri', text: string) {
  if (!import.meta.client) return
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 2200)
  } catch {
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 2200)
  }
}

const waUrl = computed(() =>
  buildWaLink(props.whatsapp, 'Halo Admin Merayau Adventure Pontianak, saya ingin menanyakan sewa alat / open trip.'),
)

const mapsEmbedUrl = computed(() => {
  let query = ''
  try {
    const parsed = new URL(props.mapsUrl)
    query = parsed.searchParams.get('query') || parsed.searchParams.get('q') || ''
  } catch {
    query = ''
  }
  if (!query) {
    query = props.alamat.replace(/\s*\([^)]*\)/g, '').trim()
  }
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`
})
</script>

<template>
  <footer class="overflow-x-clip border-t border-white/10 bg-[#121613] text-[#F5F2EB]">
    <div class="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <!-- Top Brand & Trust Strip -->
      <div data-reveal style="--reveal-delay: 0ms" class="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-8">
        <div class="flex items-center gap-3.5">
          <div class="h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-white p-1">
            <img src="/images/logo.jpeg" alt="Logo Merayau Adventure" class="h-full w-full object-contain" />
          </div>
          <div>
            <div class="mry-serif text-lg font-semibold text-white">Merayau Adventure</div>
            <div class="text-xs text-[#B8C0BA]">Basecamp Sewa Alat Gunung, Camping &amp; Open Trip Pontianak</div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <span class="mry-mono rounded-full border border-white/15 bg-[#191E1A] px-3.5 py-1.5 text-xs font-medium text-[#E5E9E6]">
            Est. 2019 · Pontianak
          </span>
          <span class="mry-mono rounded-full border border-white/15 bg-[#191E1A] px-3.5 py-1.5 text-xs font-medium text-[#E5E9E6]">
            {{ totalAlat }}+ Jenis Alat Siap Pakai
          </span>
          <span class="mry-mono rounded-full border border-[#93B47E]/35 bg-[#1E4D36]/40 px-3.5 py-1.5 text-xs font-medium text-[#B7E1A1]">
            Terintegrasi Admin Real-Time
          </span>
        </div>
      </div>

      <!-- 4 Columns Grid -->
      <div data-reveal-stagger class="grid gap-8 py-8 sm:gap-10 sm:py-10 md:grid-cols-2 lg:grid-cols-12">
        <!-- Col 1: Lokasi Basecamp -->
        <div class="mry-stagger-item min-w-0 space-y-3.5 lg:col-span-4" style="--stagger-delay: 0ms">
          <div class="flex items-center justify-between">
            <h3 class="mry-mono text-xs font-semibold tracking-[0.12em] text-white uppercase">
              Lokasi Basecamp
            </h3>
            <a
              :href="mapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs font-semibold text-[#93B47E] underline underline-offset-4 hover:text-[#B7E1A1]"
            >
              Buka di Maps ↗
            </a>
          </div>

          <div class="relative overflow-hidden rounded-xl border border-white/15 bg-[#191E1A]">
            <iframe
              :src="mapsEmbedUrl"
              title="Peta Lokasi Basecamp Merayau Adventure"
              class="block h-[220px] w-full border-0"
              loading="lazy"
              referrerpolicy="no-referrer-when-downgrade"
              allowfullscreen
            />
            <a
              :href="mapsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-[#1A73E8] shadow-md transition-colors hover:bg-[#F1F5F9]"
            >
              <span>Buka di Maps</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M14 3h7v7m0-7L10 14M20 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </a>
          </div>

          <p class="text-xs leading-relaxed text-[#D6D0C4]">
            <span class="font-semibold text-white">Alamat Basecamp:</span> {{ alamat }}
          </p>
        </div>

        <!-- Col 2: Menu Pilihan -->
        <div class="mry-stagger-item min-w-0 lg:col-span-2" style="--stagger-delay: 80ms">
          <h3 class="mry-mono text-xs font-semibold tracking-[0.12em] text-white uppercase">
            Menu Pilihan
          </h3>
          <ul class="mt-4 space-y-2.5 text-sm text-[#D6D0C4]">
            <li><NuxtLink to="/" class="transition-colors hover:text-[#93B47E] hover:underline">Beranda</NuxtLink></li>
            <li><NuxtLink to="/#profil-merayau" class="transition-colors hover:text-[#93B47E] hover:underline">Profil Basecamp</NuxtLink></li>
            <li><NuxtLink to="/#galeri-trip" class="transition-colors hover:text-[#93B47E] hover:underline">Galeri Dokumentasi</NuxtLink></li>
            <li><NuxtLink to="/#open-trip" class="transition-colors hover:text-[#93B47E] hover:underline">Jadwal Open Trip</NuxtLink></li>
            <li><NuxtLink to="/#paket-tektok" class="transition-colors hover:text-[#93B47E] hover:underline">Paket Bundel Tektok</NuxtLink></li>
            <li><NuxtLink to="/katalog" class="transition-colors hover:text-[#93B47E] hover:underline">Katalog Alat ({{ totalAlat }})</NuxtLink></li>
            <li><NuxtLink to="/#aturan-sewa" class="transition-colors hover:text-[#93B47E] hover:underline">Alur &amp; Aturan Sewa</NuxtLink></li>
            <li><NuxtLink to="/#kontak" class="transition-colors hover:text-[#93B47E] hover:underline">Kontak Basecamp</NuxtLink></li>
            <li><NuxtLink to="/#ulasan" class="transition-colors hover:text-[#93B47E] hover:underline">Ulasan Pelanggan</NuxtLink></li>
          </ul>
        </div>

        <!-- Col 3: Rekening Pembayaran -->
        <div class="mry-stagger-item min-w-0 space-y-3.5 lg:col-span-4" style="--stagger-delay: 160ms">
          <h3 class="mry-mono text-xs font-semibold tracking-[0.12em] text-white uppercase">
            Rekening Pembayaran Resmi
          </h3>
          <p class="text-xs leading-relaxed text-[#B8C0BA]">
            Booking DP sewa perlengkapan maupun DP 50% Open Trip hanya melalui rekening resmi berikut:
          </p>

          <div class="rounded-2xl border border-white/15 bg-[#191E1A] p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="mry-mono rounded border border-[#93B47E]/30 bg-[#1E4D36]/45 px-2 py-0.5 text-[11px] font-bold text-[#B7E1A1]">
                BANK BCA
              </span>
              <span class="text-xs font-medium text-[#B8C0BA]">a.n. Merayau Adventure</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3">
              <div class="mry-mono text-base font-bold tracking-wide text-white">
                7840-5192-88
              </div>
              <button
                type="button"
                class="min-h-[44px] cursor-pointer rounded-lg border px-3.5 text-xs font-semibold transition-colors"
                :class="
                  copiedKey === 'bca'
                    ? 'border-[#93B47E] bg-[#1E4D36] text-white'
                    : 'border-white/20 bg-[#121613] text-[#F5F2EB] hover:border-[#93B47E] hover:bg-[#1E4D36]'
                "
                @click="copyRekening('bca', '7840519288')"
              >
                {{ copiedKey === 'bca' ? 'Tersalin!' : 'Salin' }}
              </button>
            </div>
          </div>

          <div class="rounded-2xl border border-white/15 bg-[#191E1A] p-4">
            <div class="flex items-center justify-between gap-2">
              <span class="mry-mono rounded border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-bold text-[#F5F2EB]">
                BANK BRI
              </span>
              <span class="text-xs font-medium text-[#B8C0BA]">a.n. Merayau Adventure</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3">
              <div class="mry-mono text-base font-bold tracking-wide text-white">
                0071-01-029481-53-9
              </div>
              <button
                type="button"
                class="min-h-[44px] cursor-pointer rounded-lg border px-3.5 text-xs font-semibold transition-colors"
                :class="
                  copiedKey === 'bri'
                    ? 'border-[#93B47E] bg-[#1E4D36] text-white'
                    : 'border-white/20 bg-[#121613] text-[#F5F2EB] hover:border-[#93B47E] hover:bg-[#1E4D36]'
                "
                @click="copyRekening('bri', '007101029481539')"
              >
                {{ copiedKey === 'bri' ? 'Tersalin!' : 'Salin' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Col 4: Kontak & Media Sosial -->
        <div class="mry-stagger-item min-w-0 space-y-4 lg:col-span-2" style="--stagger-delay: 240ms">
          <h3 class="mry-mono text-xs font-semibold tracking-[0.12em] text-white uppercase">
            Kontak Kami
          </h3>
          <div class="space-y-2.5 text-sm">
            <div>
              <div class="text-xs text-[#B8C0BA]">WhatsApp Basecamp</div>
              <a :href="waUrl" target="_blank" rel="noopener noreferrer" class="mry-mono font-semibold text-white hover:text-[#93B47E] hover:underline">
                {{ whatsappDisplay }}
              </a>
            </div>
            <div>
              <div class="text-xs text-[#B8C0BA]">Email Resmi</div>
              <a :href="`mailto:${email}`" class="font-semibold text-white hover:text-[#93B47E] hover:underline">
                {{ email }}
              </a>
            </div>
            <div>
              <div class="text-xs text-[#B8C0BA]">Jam Operasional</div>
              <div class="text-xs font-medium text-[#E5E9E6]">Setiap Hari · 08.00 - 21.00 WIB</div>
            </div>
          </div>

          <div class="border-t border-white/10 pt-4">
            <div class="mry-mono text-xs font-semibold tracking-[0.12em] text-white uppercase">
              Media Sosial
            </div>
            <div class="mt-3 flex items-center gap-2.5">
              <a
                :href="waUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#191E1A] text-[#93B47E] transition-colors hover:border-[#93B47E] hover:bg-[#1E4D36] hover:text-white"
                aria-label="WhatsApp Merayau Adventure"
              >
                <WaIcon :size="17" />
              </a>
              <a
                href="https://www.instagram.com/merayauadventure/"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#191E1A] text-[#E5E9E6] transition-colors hover:border-[#93B47E] hover:bg-[#1E4D36] hover:text-white"
                aria-label="Instagram Merayau Adventure"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.8" />
                  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </a>
              <a
                href="https://www.tiktok.com/@merayauadventure"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#191E1A] text-[#E5E9E6] transition-colors hover:border-[#93B47E] hover:bg-[#1E4D36] hover:text-white"
                aria-label="TikTok Merayau Adventure"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c1 2.5 3 4 5.5 4.2"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Bar -->
      <div data-reveal style="--reveal-delay: 140ms" class="flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-[#B8C0BA] sm:flex-row sm:items-center">
        <div>
          © {{ new Date().getFullYear() }} Merayau Adventure Pontianak. Perlengkapan Gunung &amp; Open Trip.
        </div>
        <div class="flex flex-wrap items-center gap-5">
          <NuxtLink to="/#aturan-sewa" class="transition-colors hover:text-white hover:underline">Aturan Sewa</NuxtLink>
          <NuxtLink to="/katalog" class="transition-colors hover:text-white hover:underline">Katalog Alat</NuxtLink>
          <NuxtLink to="/admin/login" class="font-semibold text-[#93B47E] transition-colors hover:text-[#B7E1A1] hover:underline">Login Admin</NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>

