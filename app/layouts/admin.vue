<script setup lang="ts">
const route = useRoute()
const { user, logout } = useAdminAuth()
const drawerOpen = ref(false)

interface NavItem {
  label: string
  to: string
  match: (path: string) => boolean
  icon: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'OPERASIONAL',
    items: [
      {
        label: 'Dashboard',
        to: '/admin',
        match: (p) => p === '/admin',
        icon: 'M2.5 2.5h4.5v4.5H2.5V2.5ZM9 2.5h4.5v4.5H9V2.5ZM2.5 9h4.5v4.5H2.5V9ZM9 9h4.5v4.5H9V9Z',
      },
      {
        label: 'Sewa Alat',
        to: '/admin/sewa',
        match: (p) => p.startsWith('/admin/sewa'),
        icon: 'M3.5 2.5h9v11l-2.2-1.5-2.3 1.5-2.3-1.5-2.2 1.5v-11ZM5.5 6h5M5.5 9h3.5',
      },
      {
        label: 'Alat Disewa',
        to: '/admin/alat-disewa',
        match: (p) => p.startsWith('/admin/alat-disewa'),
        icon: 'M8 3a5 5 0 1 0 5 5 5 5 0 0 0-5-5Zm0 2.5V8l2 1.2',
      },
      {
        label: 'Riwayat Transaksi',
        to: '/admin/transaksi',
        match: (p) => p.startsWith('/admin/transaksi'),
        icon: 'M3 5.5h9.5l-2-2M13 10.5H3.5l2 2',
      },
    ],
  },
  {
    title: 'INVENTORI ALAT',
    items: [
      {
        label: 'Master Alat',
        to: '/admin/master-alat',
        match: (p) => p.startsWith('/admin/master-alat'),
        icon: 'M8 2L13.5 5v6L8 14l-5.5-3V5L8 2Zm0 6v6M2.5 5L8 8l5.5-3',
      },
      {
        label: 'Paket Alat',
        to: '/admin/paket-alat',
        match: (p) => p.startsWith('/admin/paket-alat'),
        icon: 'M8 2L2.5 5 8 8l5.5-3L8 2ZM2.5 8L8 11l5.5-3M2.5 11L8 14l5.5-3',
      },
      {
        label: 'Item Bundle',
        to: '/admin/item-bundle',
        match: (p) => p.startsWith('/admin/item-bundle'),
        icon: 'M2.5 5.5h11v7.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5.5ZM2.5 5.5l1.5-3h8l1.5 3M6.5 8.5h3',
      },
      {
        label: 'Diskon & Promo',
        to: '/admin/diskon-promo',
        match: (p) => p.startsWith('/admin/diskon-promo'),
        icon: 'M13.5 8.5L8.5 13.5a1.4 1.4 0 0 1-2 0L2.5 9.5V2.5h7l4 4a1.4 1.4 0 0 1 0 2ZM5.5 5.5h.01',
      },
    ],
  },
  {
    title: 'RIWAYAT PENYEWA ALAT',
    items: [
      {
        label: 'Penyewa',
        to: '/admin/penyewa',
        match: (p) => p.startsWith('/admin/penyewa'),
        icon: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 13.5c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5M11 4.5a2 2 0 0 1 0 4M12 10.2c1.2.4 2 1.5 2 3.3',
      },
      {
        label: 'Riwayat Penyewa',
        to: '/admin/riwayat-penyewa',
        match: (p) => p.startsWith('/admin/riwayat-penyewa'),
        icon: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 13.5c0-2 1.8-3.5 4-3.5M11.5 9.2v2.1l1.4.8M14 11.3a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
      },
    ],
  },
  {
    title: 'DATA & PESERTA TRIP',
    items: [
      {
        label: 'Data Trip',
        to: '/admin/data-trip',
        match: (p) => p.startsWith('/admin/data-trip'),
        icon: 'M2.5 4.5h11v9h-11v-9ZM5 2.5v3M11 2.5v3M2.5 7.5h11',
      },
      {
        label: 'Peserta Trip',
        to: '/admin/peserta-trip',
        match: (p) => p.startsWith('/admin/peserta-trip'),
        icon: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 13.5c0-2 1.8-3.5 4-3.5 1 0 1.9.3 2.6.8M10 11l1.5 1.5L14.5 9.5',
      },
      {
        label: 'Galeri Trip',
        to: '/admin/galeri-trip',
        match: (p) => p.startsWith('/admin/galeri-trip'),
        icon: 'M2.5 3.5h11v9h-11v-9Zm1.5 7 2.5-2.5 2 2 2-2.5 2 3M5.8 6.2h.01',
      },
    ],
  },
  {
    title: 'PENGATURAN',
    items: [
      {
        label: 'Pengaturan Profil',
        to: '/admin/profil',
        match: (p) => p.startsWith('/admin/profil'),
        icon: 'M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 13.5c0-2.2 2.2-3.5 5-3.5s5 1.3 5 3.5',
      },
    ],
  },
]

watch(
  () => route.path,
  () => {
    drawerOpen.value = false
  },
)
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row" style="background-color: var(--srf-bg)">
    <header class="flex items-center justify-between border-b px-4 py-3 lg:hidden"
      style="background-color: var(--srf-surface); border-color: var(--srf-line)">
      <div class="flex items-center gap-2.5">
        <div class="h-8 w-8 shrink-0 overflow-hidden rounded-md border bg-white p-0.5"
          style="border-color: var(--srf-line)">
          <img src="/images/logo.jpeg" alt="Merayau Outdoor" class="h-full w-full object-contain" />
        </div>
        <div>
          <div class="text-sm font-semibold leading-tight" style="color: var(--srf-ink)">
            Merayau Outdoor
          </div>
          <div class="text-[11px]" style="color: var(--srf-ink-3)">Catatan Basecamp</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <ThemeToggle class="shrink-0" />
        <button type="button" class="ed-btn-secondary !px-3 !py-1.5 !text-xs" @click="drawerOpen = !drawerOpen">
          {{ drawerOpen ? 'Tutup Menu' : 'Menu' }}
        </button>
      </div>
    </header>

    <div v-if="drawerOpen" class="fixed inset-0 z-30 bg-black/40 lg:hidden" @click="drawerOpen = false" />

    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[248px] shrink-0 flex-col justify-between border-r px-4 py-6 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
      :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'"
      style="background-color: var(--srf-surface); border-color: var(--srf-line)">
      <div class="space-y-6 overflow-y-auto pr-0.5">
        <div class="flex items-center justify-between gap-2 px-1">
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-white p-0.5"
              style="border-color: var(--srf-line)">
              <img src="/images/logo.jpeg" alt="Logo Merayau Outdoor" class="h-full w-full object-contain" />
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold" style="color: var(--srf-ink)">
                Merayau Outdoor
              </div>
              <div class="truncate text-xs" style="color: var(--srf-ink-3)">Catatan Basecamp</div>
            </div>
          </div>
          <ThemeToggle class="hidden shrink-0 lg:inline-flex" />
        </div>

        <nav class="space-y-5" aria-label="Navigasi Portal Admin">
          <div v-for="group in navGroups" :key="group.title" class="space-y-1">
            <div class="ed-label px-3 pb-1">{{ group.title }}</div>
            <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to"
              class="flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
              :style="item.match(route.path)
                  ? {
                    backgroundColor: 'var(--srf-raised)',
                    borderColor: 'var(--srf-line)',
                    color: 'var(--srf-accent)',
                    fontWeight: 600,
                  }
                  : {
                    borderColor: 'transparent',
                    color: 'var(--srf-ink-2)',
                  }
                ">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path :d="item.icon" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              {{ item.label }}
            </NuxtLink>
          </div>
        </nav>
      </div>

      <div class="mt-6 space-y-2.5 border-t pt-3" style="border-color: var(--srf-line)">
        <NuxtLink
          to="/"
          target="_blank"
          class="ed-btn-secondary w-full !min-h-[34px] !py-1.5 !text-xs"
        >
          Lihat Website Publik ↗
        </NuxtLink>
        <div class="ed-well flex items-center justify-between gap-2 px-3 py-2.5">
          <NuxtLink
            to="/admin/profil"
            class="min-w-0 flex-1 rounded transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
            style="outline-color: var(--srf-accent)"
          >
            <div class="truncate text-xs font-semibold" style="color: var(--srf-ink)">
              {{ user?.nama || 'Admin Basecamp' }}
            </div>
            <div class="truncate text-[11px]" style="color: var(--srf-ink-3)">
              {{ user?.email || 'Pengaturan Profil' }}
            </div>
          </NuxtLink>
          <button type="button" class="cursor-pointer rounded px-2 py-1 text-xs font-semibold hover:underline"
            style="color: var(--srf-bad)" @click="logout">
            Keluar
          </button>
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
      <div class="mx-auto max-w-[1160px]">
        <slot />
      </div>
    </main>
  </div>
</template>
