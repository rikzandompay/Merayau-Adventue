<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 16 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M20.5 11.5a8.5 8.5 0 0 1-12.56 7.47L3.5 20.5l1.53-4.44A8.5 8.5 0 1 1 20.5 11.5Z" stroke="currentColor"
      stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <path
      d="M9.5 8.8c.2-.4.4-.4.6-.4h.4c.15 0 .35.08.45.32l.65 1.55c.1.24.04.45-.1.62l-.45.52c.45.86 1.15 1.56 2.02 2.02l.52-.45c.17-.14.38-.2.62-.1l1.55.65c.24.1.32.3.32.45v.4c0 .2 0 .4-.4.6-.55.3-1.45.42-2.62-.05-1.35-.54-2.85-2.04-3.39-3.39-.47-1.17-.35-2.07-.05-2.62Z"
      stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</template>
