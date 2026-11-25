<script setup lang="ts">
withDefaults(
  defineProps<{
    kind?: string
  }>(),
  { kind: 'tent' },
)
</script>

<template>
  <svg v-if="kind === 'trip'" viewBox="0 0 64 44" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <path d="M4 36L20 14L31 28L41 18L60 36" stroke="var(--srf-good)" stroke-width="1.7" stroke-linecap="round"
      stroke-linejoin="round" />
    <circle cx="48" cy="11" r="4" stroke="var(--srf-gold)" stroke-width="1.4" />
    <path d="M2 39H62" stroke="var(--srf-line-strong)" stroke-width="1.1" />
  </svg>
  <svg v-else-if="
    kind.toLowerCase().includes('carrier') ||
    kind.toLowerCase().includes('tas') ||
    kind.toLowerCase().includes('daypack')
  " viewBox="0 0 48 40" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <rect x="14" y="8" width="20" height="25" rx="4" stroke="var(--srf-ink)" stroke-width="1.5" />
    <path d="M18 8V5h12v3M14 17h20" stroke="var(--srf-accent)" stroke-width="1.4" />
    <rect x="19" y="21" width="10" height="7" rx="1.5" stroke="var(--srf-ink-3)" stroke-width="1.2" />
  </svg>
  <svg v-else-if="
    kind.toLowerCase().includes('trekking') ||
    kind.toLowerCase().includes('sepatu') ||
    kind.toLowerCase().includes('jaket') ||
    kind.toLowerCase().includes('pole')
  " viewBox="0 0 48 40" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <path d="M15 8v25M33 8v25" stroke="var(--srf-ink)" stroke-width="1.6" stroke-linecap="round" />
    <path d="M12 10h6M30 10h6M13 30h4M31 30h4" stroke="var(--srf-accent)" stroke-width="1.5" stroke-linecap="round" />
    <path d="M8 35h32" stroke="var(--srf-line-strong)" stroke-width="1.2" stroke-linecap="round" />
  </svg>
  <svg v-else-if="
    kind.toLowerCase().includes('lampu') ||
    kind.toLowerCase().includes('headlamp') ||
    kind.toLowerCase().includes('powerbank') ||
    kind.toLowerCase().includes('acc')
  " viewBox="0 0 48 40" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <circle cx="24" cy="18" r="7" stroke="var(--srf-ink)" stroke-width="1.5" />
    <path d="M20 28h8M22 32h4" stroke="var(--srf-accent)" stroke-width="1.4" stroke-linecap="round" />
    <path d="M24 5v3M12 18H9M39 18h-3M15 9l2 2M33 9l-2 2" stroke="var(--srf-gold)" stroke-width="1.3"
      stroke-linecap="round" />
  </svg>
  <svg v-else-if="
    kind.toLowerCase().includes('camping') ||
    kind.toLowerCase().includes('sleeping') ||
    kind.toLowerCase().includes('bag') ||
    kind.toLowerCase().includes('matras') ||
    kind.toLowerCase().includes('hammock')
  " viewBox="0 0 48 40" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <rect x="7" y="12" width="34" height="16" rx="8" stroke="var(--srf-ink)" stroke-width="1.5" />
    <path d="M17 12v16M25 12v16M33 12v16" stroke="var(--srf-ink-3)" stroke-width="1.2" />
    <circle cx="12" cy="20" r="2.2" stroke="var(--srf-accent)" stroke-width="1.3" />
  </svg>
  <svg v-else-if="
    kind.toLowerCase().includes('cooking') ||
    kind.toLowerCase().includes('kompor') ||
    kind.toLowerCase().includes('masak') ||
    kind.toLowerCase().includes('nesting')
  " viewBox="0 0 48 40" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <path d="M12 20h24l-2 11H14l-2-11Z" stroke="var(--srf-ink)" stroke-width="1.5" />
    <path d="M24 8c2.2 2.4 3 4.2 3 5.8a3 3 0 1 1-6 0c0-1.6.8-3.4 3-5.8Z" stroke="var(--srf-bad)" stroke-width="1.4" />
    <path d="M10 20h28" stroke="var(--srf-ink-3)" stroke-width="1.3" stroke-linecap="round" />
  </svg>
  <svg v-else viewBox="0 0 64 44" fill="none" class="h-full w-full p-1" aria-hidden="true">
    <path d="M11 35L32 9L53 35H11Z" stroke="var(--srf-ink)" stroke-width="1.7" stroke-linejoin="round" />
    <path d="M32 9L24 35M32 22L38 35H27" stroke="var(--srf-accent)" stroke-width="1.5" />
    <path d="M5 36H59" stroke="var(--srf-line-strong)" stroke-width="1.2" stroke-linecap="round" />
  </svg>
</template>
