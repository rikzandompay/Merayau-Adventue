<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

export interface FanSlideCard {
  id: string
  src: string
  label: string
  tags: string[]
  tripId?: number
}

export interface FanTripGroup {
  id: string
  judul: string
  tags: string[]
  tripId?: number
  cards: FanSlideCard[]
}

const props = defineProps<{
  groups: FanTripGroup[]
}>()

const emit = defineEmits<{
  selectTrip: [tripId: number]
}>()

const sectionRef = ref<HTMLElement | null>(null)
const inView = ref(false)
const hold = ref(false)
const prefersReducedMotion = ref(false)

const tripCount = computed(() => Math.max(1, props.groups.length))
const activeTripIdx = ref(0)

const currentGroup = computed<FanTripGroup | undefined>(
  () => props.groups[activeTripIdx.value] ?? props.groups[0],
)

const activeCards = computed<FanSlideCard[]>(() => currentGroup.value?.cards ?? [])
const n = computed(() => Math.max(1, activeCards.value.length))
const startIdx = computed(() => Math.floor(n.value / 2))

const targetPos = ref(2)
let visualPos = 2
const active = ref(2)
const cardEls: Array<HTMLElement | null> = []

function setCardRef(el: Element | ComponentPublicInstance | null, index: number) {
  cardEls[index] = el instanceof HTMLElement ? el : null
}

function applyCardPositions() {
  const total = n.value
  const step = geo.value.step
  for (let i = 0; i < total; i++) {
    const el = cardEls[i]
    if (!el) continue
    const d = wrapDist(i, visualPos, total)
    const abs = Math.abs(d)
    const rotate = d * step
    const opacity = abs <= 2 ? 1 : Math.max(0, 1 - (abs - 2) * 2)
    const zIndex = Math.round(20 - abs * 4)
    el.style.transform = `translate3d(0, 0, 0) rotate(${rotate.toFixed(2)}deg)`
    el.style.opacity = opacity.toFixed(3)
    el.style.zIndex = String(zIndex)
    el.style.pointerEvents = opacity < 0.08 ? 'none' : 'auto'
  }
}

watch(
  () => [activeTripIdx.value, n.value] as const,
  ([, val]) => {
    const start = Math.floor(val / 2)
    targetPos.value = start
    visualPos = start
    active.value = start
    cardEls.length = val
    nextTick(applyCardPositions)
  },
  { immediate: true },
)

const geo = ref({ cw: 225, ch: 291, step: 15, radius: 1100, h: 480 })

function updateGeometry() {
  if (!import.meta.client) return
  const vw = window.innerWidth
  if (vw < 640) {
    const radius = 800
    geo.value = { cw: 200, ch: 260, step: 19, radius, h: 325 }
    nextTick(applyCardPositions)
    return
  }
  const avail = Math.min(vw, 1440) - 48
  const radius = Math.min(1180, Math.round(avail / 1.31))
  const cw = Math.round(radius * 0.215)
  const ch = Math.round(radius * 0.278)
  const h = Math.round(ch * 0.87 + cw * 0.5 + radius * 0.125 + 20)
  geo.value = { cw, ch, step: 15, radius, h: Math.min(480, Math.max(380, h)) }
  nextTick(applyCardPositions)
}

function wrapDist(i: number, pos: number, total: number): number {
  let d = (((i - pos) % total) + total) % total
  if (d > total / 2) d -= total
  return d
}

function solveCubicBezierX(t: number, p1x = 0.42, p2x = 0): number {
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * 0
  const by = 3 * (1 - 0) - cy
  const ay = 1 - cy - by

  let u = t
  for (let i = 0; i < 6; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t
    const dx = (3 * ax * u + 2 * bx) * u + cx
    if (Math.abs(x) < 1e-4) break
    if (Math.abs(dx) > 1e-6) u -= x / dx
  }
  u = Math.max(0, Math.min(1, u))
  return ((ay * u + by) * u + cy) * u
}

let tweenRaf: number | null = null
let autoTimer: ReturnType<typeof setTimeout> | null = null
let dragging: { x: number; p: number; moved: boolean } | null = null
let io: IntersectionObserver | null = null

function updateActiveFromPos(p: number) {
  const total = n.value
  const nextActive = ((Math.round(p) % total) + total) % total
  if (active.value !== nextActive) {
    active.value = nextActive
  }
}

function goTo(to: number) {
  targetPos.value = to
  updateActiveFromPos(to)
  scheduleAutoplay()

  if (prefersReducedMotion.value || !import.meta.client) {
    visualPos = to
    applyCardPositions()
    return
  }

  if (tweenRaf !== null) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = null
  }

  const from = visualPos
  const delta = to - from
  if (Math.abs(delta) < 0.001) {
    visualPos = to
    applyCardPositions()
    return
  }

  const duration = 750
  const startTime = performance.now()

  const tick = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    const eased = solveCubicBezierX(t, 0.42, 0)
    const current = from + delta * eased
    visualPos = current
    applyCardPositions()
    updateActiveFromPos(current)
    if (t < 1) {
      tweenRaf = requestAnimationFrame(tick)
    } else {
      visualPos = to
      applyCardPositions()
      tweenRaf = null
    }
  }
  tweenRaf = requestAnimationFrame(tick)
}

function switchTrip(delta: number) {
  if (tripCount.value <= 1) return
  if (tweenRaf !== null) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = null
  }
  activeTripIdx.value = (((activeTripIdx.value + delta) % tripCount.value) + tripCount.value) % tripCount.value
  scheduleAutoplay()
}

function selectTripIndex(idx: number) {
  if (idx < 0 || idx >= tripCount.value) return
  if (tweenRaf !== null) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = null
  }
  activeTripIdx.value = idx
  scheduleAutoplay()
}

function pick(index: number) {
  const total = n.value
  const d = Math.round(wrapDist(index, targetPos.value, total))
  if (d === 0) {
    const tripId = activeCards.value[index]?.tripId ?? currentGroup.value?.tripId
    if (tripId) emit('selectTrip', tripId)
    return
  }
  goTo(targetPos.value + d)
}

function scheduleAutoplay() {
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
  if (!inView.value || hold.value || prefersReducedMotion.value || tripCount.value <= 1) return
  autoTimer = setTimeout(() => {
    switchTrip(1)
  }, 5000)
}

watch([inView, hold], () => {
  scheduleAutoplay()
})

const pxPerCard = computed(() => Math.max(120, geo.value.radius * Math.sin((geo.value.step * Math.PI) / 180)))

function onPointerDown(e: PointerEvent) {
  if (n.value <= 1) return
  if (tweenRaf !== null) {
    cancelAnimationFrame(tweenRaf)
    tweenRaf = null
  }
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
  dragging = { x: e.clientX, p: visualPos, moved: false }
    ; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const dx = e.clientX - dragging.x
  if (Math.abs(dx) > 4) dragging.moved = true
  const nextP = dragging.p - dx / pxPerCard.value
  visualPos = nextP
  applyCardPositions()
  updateActiveFromPos(nextP)
}

function onPointerUp(e: PointerEvent) {
  const d = dragging
  dragging = null
  if (!d) return
  if (d.moved) {
    const dx = e.clientX - d.x
    let to = Math.round(visualPos)
    if (to === Math.round(d.p) && Math.abs(dx) > 30) {
      to += dx < 0 ? 1 : -1
    }
    goTo(to)
  } else {
    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => el instanceof HTMLElement && el.dataset.fanIndex !== undefined) as HTMLElement | undefined
    if (hit) pick(Number(hit.dataset.fanIndex))
    else goTo(targetPos.value)
  }
}

// Static geometry only; per-frame transform/opacity/zIndex/pointerEvents are written
// directly to cardEls in applyCardPositions() so Vue re-renders never overwrite drag/tween state.
const cardGeometryStyle = computed(() => ({
  width: `${geo.value.cw}px`,
  height: `${geo.value.ch}px`,
  marginLeft: `${-Math.round(geo.value.cw / 2)}px`,
  transformOrigin: `50% ${geo.value.radius}px`,
}))

const currentCard = computed(
  () => activeCards.value[active.value] ?? activeCards.value[startIdx.value] ?? activeCards.value[0],
)

onMounted(() => {
  updateGeometry()
  prefersReducedMotion.value = false
  applyCardPositions()
  window.addEventListener('resize', updateGeometry, { passive: true })

  if (sectionRef.value) {
    io = new IntersectionObserver(
      (entries) => {
        inView.value = Boolean(entries[0]?.isIntersecting)
      },
      { threshold: 0.3 },
    )
    io.observe(sectionRef.value)
  }
})

onBeforeUnmount(() => {
  if (tweenRaf !== null) cancelAnimationFrame(tweenRaf)
  if (autoTimer) clearTimeout(autoTimer)
  io?.disconnect()
  if (import.meta.client) {
    window.removeEventListener('resize', updateGeometry)
  }
})
</script>

<template>
  <section ref="sectionRef" aria-label="Galeri Dokumentasi Open Trip Merayau"
    class="overflow-hidden border-y border-[#EAE5DA] bg-[#F5F2EB] py-16 sm:py-20">
    <div class="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
      <div class="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end" data-reveal>
        <div>
          <p class="mry-mono text-xs font-medium tracking-[0.14em] text-[#1E4D36] uppercase">
            01d · Arsip Lapangan &amp; Ekspedisi
          </p>
          <h2 class="mry-serif mt-2 text-3xl font-semibold text-[#121613] sm:text-4xl">
            Galeri Dokumentasi Open Trip
          </h2>
          <p class="mt-2 max-w-xl text-sm text-[#2E3530] sm:text-base">
            Klik tombol panah atau pilih gunung untuk melihat 5 dokumentasi foto ekspedisi Merayau Adventure di setiap
            destinasi.
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button type="button"
            class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] transition-colors hover:border-[#1E4D36] hover:bg-[#1E4D36] hover:text-white"
            aria-label="Trip gunung sebelumnya" @click="switchTrip(-1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
          <span class="mry-mono min-w-[44px] text-center text-xs font-semibold text-[#2E3530]">
            {{ activeTripIdx + 1 }} / {{ tripCount }}
          </span>
          <button type="button"
            class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#D6D0C4] bg-white text-[#121613] transition-colors hover:border-[#1E4D36] hover:bg-[#1E4D36] hover:text-white"
            aria-label="Trip gunung berikutnya" @click="switchTrip(1)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mountain Trip Selector Pills -->
      <div v-if="groups.length > 1" data-reveal style="--reveal-delay: 80ms"
        class="mb-6 flex flex-wrap items-center gap-2">
        <button v-for="(grp, idx) in groups" :key="grp.id" type="button"
          class="mry-mono min-h-[36px] cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition-colors"
          :class="activeTripIdx === idx
              ? 'border-[#1E4D36] bg-[#1E4D36] text-white'
              : 'border-[#D6D0C4] bg-white text-[#2E3530] hover:border-[#1E4D36] hover:text-[#1E4D36]'
            " @click="selectTripIndex(idx)">
          {{ grp.judul }}
        </button>
      </div>

      <div data-reveal-media style="--reveal-delay: 140ms">
        <Transition name="mry-fan-caption" mode="out-in" @enter="applyCardPositions">
          <div :key="currentGroup?.id || 'empty'" tabindex="0" role="region" aria-roledescription="carousel"
            aria-label="Galeri Kipas Open Trip"
            class="relative mx-auto w-full max-w-[1440px] cursor-grab touch-pan-y select-none outline-none active:cursor-grabbing"
            :style="{ height: `${geo.h}px` }" @keydown.left.prevent="switchTrip(-1)"
            @keydown.right.prevent="switchTrip(1)" @pointerenter="(e) => e.pointerType === 'mouse' && (hold = true)"
            @pointerleave="hold = false" @pointerdown="onPointerDown" @pointermove="onPointerMove"
            @pointerup="onPointerUp" @pointercancel="onPointerUp">
            <div v-for="(card, index) in activeCards" :key="card.id" :ref="(el) => setCardRef(el, index)"
              :data-fan-index="index" role="button" tabindex="0" :aria-label="`Pilih ${card.label}`"
              class="group absolute top-2 left-1/2 overflow-hidden rounded-2xl border-2 border-white bg-[#EAE5DA] shadow-lg will-change-transform focus-visible:ring-2 focus-visible:ring-[#1E4D36]"
              :style="cardGeometryStyle" @keydown.enter.prevent="pick(index)">
              <img :src="card.src" :alt="card.label" decoding="async" loading="lazy" draggable="false"
                class="pointer-events-none h-full w-full select-none object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              <div
                class="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
              <div class="pointer-events-none absolute inset-x-3 bottom-3 text-left">
                <div class="text-sm font-semibold text-white drop-shadow-xs">
                  {{ card.label }}
                </div>
                <div class="mry-mono mt-0.5 text-[11px] text-white/85">
                  {{ card.tags[0] || currentGroup?.judul || 'Open Trip Merayau' }}
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <div data-reveal style="--reveal-delay: 200ms"
        class="mt-4 flex min-h-[76px] flex-col items-center justify-center text-center">
        <Transition name="mry-fan-caption" mode="out-in">
          <div v-if="currentGroup" :key="`${currentGroup.id}-${currentCard?.id}`"
            class="flex flex-col items-center gap-2.5">
            <div class="text-lg font-semibold text-[#121613] sm:text-xl">
              {{ currentGroup.judul }}<span v-if="currentCard?.label && currentCard.label !== currentGroup.judul"
                class="text-[#5C645E]"> · {{ currentCard.label }}</span>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2">
              <span v-for="tag in currentGroup.tags" :key="tag"
                class="mry-mono rounded-full border border-[#D6D0C4] bg-white px-3 py-1 text-xs font-medium text-[#2E3530]">
                {{ tag }}
              </span>
              <button v-if="currentGroup.tripId" type="button"
                class="cursor-pointer rounded-full bg-[#1E4D36] px-3.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#163B29]"
                @click="emit('selectTrip', currentGroup.tripId)">
                Buka Paket Trip →
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>
