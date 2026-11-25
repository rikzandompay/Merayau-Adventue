<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    tone?: 'good' | 'bad' | 'warn' | 'accent' | 'purple' | 'neutral'
    variant?: 'outline' | 'light' | 'solid' | 'ghost'
    caret?: 'up' | 'down' | null
    showDot?: boolean
    label: string
  }>(),
  {
    tone: 'neutral',
    variant: 'outline',
    caret: null,
    showDot: true,
  },
)

const palette = computed(() => {
  switch (props.tone) {
    case 'good':
      return {
        dot: 'var(--srf-good)',
        text: 'var(--srf-good-ink)',
        soft: 'var(--srf-good-soft)',
        border: 'var(--srf-good-border)',
        solid: 'var(--srf-good)',
      }
    case 'bad':
      return {
        dot: 'var(--srf-bad)',
        text: 'var(--srf-bad-ink)',
        soft: 'var(--srf-bad-soft)',
        border: 'var(--srf-bad-border)',
        solid: 'var(--srf-bad)',
      }
    case 'warn':
      return {
        dot: 'var(--srf-warn)',
        text: 'var(--srf-warn-ink)',
        soft: 'var(--srf-warn-soft)',
        border: 'var(--srf-warn-border)',
        solid: 'var(--srf-warn)',
      }
    case 'purple':
      return {
        dot: 'var(--srf-purple)',
        text: 'var(--srf-purple-ink)',
        soft: 'var(--srf-purple-soft)',
        border: 'var(--srf-purple-border)',
        solid: 'var(--srf-purple)',
      }
    case 'accent':
      return {
        dot: 'var(--srf-accent)',
        text: 'var(--srf-accent-ink)',
        soft: 'var(--srf-accent-soft)',
        border: 'var(--srf-accent-border)',
        solid: 'var(--srf-accent)',
      }
    default:
      return {
        dot: 'var(--srf-accent)',
        text: 'var(--srf-neutral-ink)',
        soft: 'var(--srf-accent-soft)',
        border: 'var(--srf-accent-border)',
        solid: 'var(--srf-neutral-solid)',
      }
  }
})

const badgeStyle = computed(() => {
  const p = palette.value
  if (props.variant === 'solid') {
    return {
      backgroundColor: p.solid,
      borderColor: 'transparent',
      color: '#ffffff',
    }
  }
  if (props.variant === 'light') {
    return {
      backgroundColor: p.soft,
      borderColor: 'transparent',
      color: p.text,
    }
  }
  if (props.variant === 'ghost') {
    return {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: p.text,
    }
  }
  return {
    backgroundColor: p.soft,
    borderColor: p.border,
    color: p.text,
  }
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
    :style="badgeStyle">
    <svg v-if="caret === 'up'" width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M5 2L9 8H1L5 2Z" />
    </svg>
    <svg v-else-if="caret === 'down'" width="8" height="8" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M5 8L1 2H9L5 8Z" />
    </svg>
    <span v-else-if="showDot" class="h-1.5 w-1.5 shrink-0 rounded-full"
      :style="{ backgroundColor: variant === 'solid' ? '#ffffff' : palette.dot }" />
    {{ label }}
  </span>
</template>
