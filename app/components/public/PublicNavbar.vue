<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    totalAlat?: number
    whatsapp?: string
    activeSection?: string
    showScrollProgress?: boolean
  }>(),
  {
    totalAlat: 58,
    whatsapp: '6285156549003',
    activeSection: '',
    showScrollProgress: true,
  },
)

const route = useRoute()
const cart = usePublicCart()
const mobileOpen = ref(false)

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
)

function onNavbarKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && mobileOpen.value) {
    mobileOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onNavbarKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onNavbarKeydown)
})

const navLinks = computed(() => [
  { label: 'Profile', to: '/#profil-merayau', sectionId: 'profil-merayau', isRoute: false },
  { label: `Katalog Alat (${props.totalAlat})`, to: '/katalog', sectionId: '', isRoute: true },
  { label: 'Open Trip', to: '/#open-trip', sectionId: 'open-trip', isRoute: false },
  { label: 'Aturan Sewa', to: '/#aturan-sewa', sectionId: 'aturan-sewa', isRoute: false },
  { label: 'Kontak', to: '/#kontak', sectionId: 'kontak', isRoute: false },
])

function isLinkActive(link: { to: string; sectionId: string; isRoute: boolean }) {
  if (link.isRoute) return route.path === link.to
  if (route.path === '/' && props.activeSection && link.sectionId === props.activeSection) {
    return true
  }
  return false
}

const waUrl = computed(() =>
  buildWaLink(
    props.whatsapp,
    'Halo Admin Merayau Adventure Pontianak, saya ingin tanya stok perlengkapan gunung & open trip.',
  ),
)
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-[#EAE5DA] bg-white/95 backdrop-blur-md">
    <div class="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between gap-2 px-3 sm:h-[74px] sm:gap-4 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-0.5 sm:gap-3 sm:pr-2 lg:flex-none">
        <div class="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[#D6D0C4] bg-white p-0.5 shadow-xs sm:h-10 sm:w-10">
          <img src="/images/logo.jpeg" alt="Merayau Adventure" class="h-full w-full object-contain" />
        </div>
        <div class="min-w-0">
          <div class="truncate whitespace-nowrap text-[11px] font-bold tracking-[0.04em] text-[#121613] uppercase sm:text-sm sm:tracking-[0.06em]">
            Merayau Adventure
          </div>
          <div class="mry-mono truncate whitespace-nowrap text-[9px] font-medium tracking-[0.05em] text-[#5C645E] uppercase sm:text-[10px] sm:tracking-[0.08em]">
            <span class="hidden sm:inline">Est. 2019 · </span>Basecamp Pontianak
          </div>
        </div>
      </NuxtLink>

      <nav class="hidden items-center gap-6 lg:flex" aria-label="Navigasi Utama">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="relative py-1 text-sm font-medium transition-colors hover:text-[#1E4D36]"
          :class="isLinkActive(link) ? 'font-semibold text-[#1E4D36]' : 'text-[#2E3530]'"
        >
          <span>{{ link.label }}</span>
          <span
            class="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[#1E4D36] transition-transform duration-300 ease-out"
            :class="isLinkActive(link) ? 'scale-x-100' : 'scale-x-0'"
          />
        </NuxtLink>
      </nav>

      <div class="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          class="relative inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-[#D6D0C4] bg-[#FDFCFA] px-2.5 py-2 text-xs font-semibold text-[#121613] transition-colors hover:border-[#1E4D36] hover:bg-[#F5F2EB] sm:gap-2 sm:px-3.5"
          aria-label="Buka Daftar Sewa Kamu"
          @click="cart.drawerOpen.value = true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 7h12l-1 13H7L6 7Zm3 0V5a3 3 0 0 1 6 0v2"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="hidden sm:inline">Daftar Sewa</span>
          <span
            class="mry-mono inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
            :class="cart.totalCount.value > 0 ? 'bg-[#1E4D36] text-white' : 'bg-[#EAE5DA] text-[#2E3530]'"
          >
            {{ cart.totalCount.value }}
          </span>
        </button>

        <a
          :href="waUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hidden min-h-[44px] items-center gap-2 rounded-full bg-[#1E4D36] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#163B29] sm:inline-flex"
        >
          <WaIcon :size="16" />
          <span>WhatsApp Basecamp</span>
        </a>

        <button
          type="button"
          class="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#D6D0C4] bg-white px-2.5 text-xs font-semibold text-[#121613] sm:px-3 lg:hidden"
          :aria-expanded="mobileOpen"
          aria-label="Buka menu navigasi"
          @click="mobileOpen = !mobileOpen"
        >
          <svg v-if="!mobileOpen" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span>{{ mobileOpen ? 'Tutup' : 'Menu' }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="mobileOpen"
      class="border-t border-[#EAE5DA] bg-white px-4 py-4 lg:hidden"
    >
      <nav class="flex flex-col gap-1" aria-label="Menu Mobile">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-[#121613] hover:bg-[#F5F2EB]"
          @click="mobileOpen = false"
        >
          {{ link.label }}
        </NuxtLink>
        <a
          :href="waUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#1E4D36] px-4 text-sm font-semibold text-white"
        >
          <WaIcon :size="16" />
          <span>WhatsApp Basecamp</span>
        </a>
      </nav>
    </div>
    <div
      v-if="showScrollProgress"
      class="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-[#EAE5DA]/50"
      aria-hidden="true"
    >
      <div class="mry-scroll-progress h-full w-full bg-gradient-to-r from-[#1E4D36] via-[#2B6E4C] to-[#93B47E]" />
    </div>
  </header>
</template>

