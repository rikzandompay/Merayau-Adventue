<script setup lang="ts">
const { theme, setTheme } = useTheme()

function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}
</script>

<template>
  <button
    type="button"
    class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--srf-accent)]"
    style="
      background-color: var(--srf-surface);
      border-color: var(--srf-line-strong);
      color: var(--srf-ink-2);
    "
    :title="theme === 'dark' ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
    :aria-label="theme === 'dark' ? 'Beralih ke mode terang' : 'Beralih ke mode gelap'"
    @click="toggleTheme"
  >
    <svg
      v-if="theme === 'dark'"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646Z"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>
