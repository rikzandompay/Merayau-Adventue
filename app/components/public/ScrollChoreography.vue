<script setup lang="ts">
export interface ScrollChoreographyImages {
  topLeft: string
  topRight: string
  bottomLeft: string
  bottomRight: string
}

export interface ScrollChoreographyLabels {
  topLeft?: { title: string; subtitle?: string }
  topRight?: { title: string; subtitle?: string }
  bottomLeft?: { title: string; subtitle?: string }
  bottomRight?: { title: string; subtitle?: string }
}

const props = defineProps<{
  className?: string
  images: ScrollChoreographyImages
  labels?: ScrollChoreographyLabels
}>()

const containerRef = ref<HTMLElement | null>(null)
const smoothProgress = ref(0)
const isMobile = ref(false)

let targetProgress = 0
let velocity = 0
let rafId: number | null = null
let lastTime = 0
let reducedMotion = false

const STIFFNESS = 400
const DAMPING = 50
const MASS = 1.2
const REST_DELTA = 0.001

function clamp01(val: number): number {
  return Math.min(1, Math.max(0, val))
}

function interpolate(value: number, inputRange: number[], outputRange: number[]): number {
  const n = inputRange.length
  if (n === 0) return 0
  if (value <= inputRange[0]!) return outputRange[0]!
  if (value >= inputRange[n - 1]!) return outputRange[n - 1]!

  for (let i = 0; i < n - 1; i++) {
    const start = inputRange[i]!
    const end = inputRange[i + 1]!
    if (value >= start && value <= end) {
      const span = end - start
      if (span <= 0) return outputRange[i + 1]!
      const t = (value - start) / span
      return outputRange[i]! + (outputRange[i + 1]! - outputRange[i]!) * t
    }
  }
  return outputRange[n - 1]!
}

function tickSpring(now: number) {
  const dtRaw = lastTime ? (now - lastTime) / 1000 : 0.016
  lastTime = now
  const dtTotal = Math.min(0.032, Math.max(0.001, dtRaw))

  // Two sub-steps keep stiff springs (stiffness=400) stable at 60/120Hz
  const steps = 2
  const dt = dtTotal / steps
  let pos = smoothProgress.value
  let vel = velocity

  for (let s = 0; s < steps; s++) {
    const force = -STIFFNESS * (pos - targetProgress)
    const damper = -DAMPING * vel
    const accel = (force + damper) / MASS
    vel += accel * dt
    pos += vel * dt
  }

  velocity = vel
  smoothProgress.value = pos

  if (Math.abs(targetProgress - pos) < REST_DELTA && Math.abs(vel) < REST_DELTA) {
    smoothProgress.value = targetProgress
    velocity = 0
    rafId = null
    lastTime = 0
    return
  }

  rafId = requestAnimationFrame(tickSpring)
}

function updateScrollTarget() {
  if (import.meta.client) {
    isMobile.value = window.innerWidth < 768
  }
  const el = containerRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight || 900
  const scrollable = Math.max(1, rect.height - vh)
  targetProgress = clamp01(-rect.top / scrollable)

  if (reducedMotion) {
    smoothProgress.value = targetProgress
    return
  }

  if (rafId === null && Math.abs(targetProgress - smoothProgress.value) >= REST_DELTA) {
    lastTime = performance.now()
    rafId = requestAnimationFrame(tickSpring)
  }
}

onMounted(() => {
  reducedMotion = false
  updateScrollTarget()
  window.addEventListener('scroll', updateScrollTarget, { passive: true })
  window.addEventListener('resize', updateScrollTarget, { passive: true })
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (import.meta.client) {
    window.removeEventListener('scroll', updateScrollTarget)
    window.removeEventListener('resize', updateScrollTarget)
  }
})

const PHASE_STOPS = [0, 0.3, 0.35, 0.65, 1]

const layoutDims = computed(() =>
  isMobile.value
    ? { xLeft: -23, xRight: 23, yTop: -4, yBottom: 19, baseW: 42, baseH: 20 }
    : { xLeft: -20, xRight: 20, yTop: -14, yBottom: 14, baseW: 36, baseH: 24 },
)

const tlStyle = computed(() => {
  const p = smoothProgress.value
  const d = layoutDims.value
  const x = interpolate(p, PHASE_STOPS, [d.xLeft, d.xLeft, d.xLeft, 0, 0])
  const y = interpolate(p, PHASE_STOPS, [d.yTop, d.yBottom, d.yBottom, 0, 0])
  const opacity = interpolate(p, [0.75, 0.85], [1, 0])
  return {
    transform: `translate3d(calc(-50% + ${x.toFixed(3)}vw), calc(-50% + ${y.toFixed(3)}vh), 0)`,
    opacity: opacity.toFixed(3),
  }
})

const brStyle = computed(() => {
  const p = smoothProgress.value
  const d = layoutDims.value
  const x = interpolate(p, PHASE_STOPS, [d.xRight, d.xRight, d.xRight, 0, 0])
  const y = interpolate(p, PHASE_STOPS, [d.yBottom, d.yTop, d.yTop, 0, 0])
  const opacity = interpolate(p, [0.75, 0.85], [1, 0])
  return {
    transform: `translate3d(calc(-50% + ${x.toFixed(3)}vw), calc(-50% + ${y.toFixed(3)}vh), 0)`,
    opacity: opacity.toFixed(3),
  }
})

const blStyle = computed(() => {
  const p = smoothProgress.value
  const d = layoutDims.value
  const x = interpolate(p, PHASE_STOPS, [d.xLeft, d.xLeft, d.xLeft, 0, 0])
  const y = interpolate(p, PHASE_STOPS, [d.yBottom, d.yBottom, d.yBottom, 0, 0])
  const opacity = interpolate(p, [0.75, 0.85], [1, 0])
  return {
    transform: `translate3d(calc(-50% + ${x.toFixed(3)}vw), calc(-50% + ${y.toFixed(3)}vh), 0)`,
    opacity: opacity.toFixed(3),
  }
})

const trStyle = computed(() => {
  const p = smoothProgress.value
  const d = layoutDims.value
  const x = interpolate(p, PHASE_STOPS, [d.xRight, d.xRight, d.xRight, 0, 0])
  const y = interpolate(p, PHASE_STOPS, [d.yTop, d.yTop, d.yTop, 0, 0])
  const width = interpolate(p, [0.65, 0.7, 0.9, 1], [d.baseW, d.baseW, 100, 100])
  const height = interpolate(p, [0.65, 0.7, 0.9, 1], [d.baseH, d.baseH, 100, 100])
  const radius = interpolate(p, [0.7, 0.9], [16, 0])
  return {
    transform: `translate3d(calc(-50% + ${x.toFixed(3)}vw), calc(-50% + ${y.toFixed(3)}vh), 0)`,
    width: `${width.toFixed(3)}vw`,
    height: `${height.toFixed(3)}vh`,
    borderRadius: `${radius.toFixed(1)}px`,
  }
})

const cornerLabelOpacity = computed(() => interpolate(smoothProgress.value, [0.65, 0.78], [1, 0]))
const BASE_FRAME_CLASSES =
  'absolute left-1/2 top-1/2 h-[20dvh] w-[42vw] md:h-[24vh] md:w-[36vw] overflow-hidden rounded-2xl bg-[#EAE5DA] shadow-2xl will-change-transform'
</script>

<template>
  <div ref="containerRef" :class="['relative h-[220vh] w-full md:h-[300vh]', className]">
    <div class="sticky top-0 z-10 h-[100dvh] w-full overflow-hidden bg-white">
      <!-- Top editorial HUD above frames while cards choreograph -->
      <div class="pointer-events-none relative z-50 mx-auto max-w-[1280px] px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <slot name="top-hud" :progress="smoothProgress" />
      </div>

      <div class="absolute inset-0 flex items-center justify-center">
        <!-- Top Left Image -> moves to Bottom Left, then Center -->
        <div :style="tlStyle" :class="[BASE_FRAME_CLASSES, 'z-10']">
          <img
            :src="images.topLeft"
            :alt="alts?.topLeft || labels?.topLeft?.title || 'Dokumentasi Open Trip 1'"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.topLeft?.title"
            :style="{ opacity: cornerLabelOpacity }"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.topLeft.title }}</div>
            <div v-if="labels.topLeft.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.topLeft.subtitle }}
            </div>
          </div>
        </div>

        <!-- Bottom Right Image -> moves to Top Right, then Center -->
        <div :style="brStyle" :class="[BASE_FRAME_CLASSES, 'z-20']">
          <img
            :src="images.bottomRight"
            :alt="alts?.bottomRight || labels?.bottomRight?.title || 'Dokumentasi Open Trip 4'"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.bottomRight?.title"
            :style="{ opacity: cornerLabelOpacity }"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.bottomRight.title }}</div>
            <div v-if="labels.bottomRight.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.bottomRight.subtitle }}
            </div>
          </div>
        </div>

        <!-- Bottom Left Image -> stays, then moves to Center -->
        <div :style="blStyle" :class="[BASE_FRAME_CLASSES, 'z-30']">
          <img
            :src="images.bottomLeft"
            :alt="alts?.bottomLeft || labels?.bottomLeft?.title || 'Dokumentasi Open Trip 3'"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.bottomLeft?.title"
            :style="{ opacity: cornerLabelOpacity }"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.bottomLeft.title }}</div>
            <div v-if="labels.bottomLeft.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.bottomLeft.subtitle }}
            </div>
          </div>
        </div>

        <!-- Top Right Image (Hero -> stays, moves to Center, then expands full screen) -->
        <div :style="trStyle" :class="[BASE_FRAME_CLASSES, 'z-40 origin-center bg-[#121613]']">
          <img
            :src="images.topRight"
            :alt="alts?.topRight || labels?.topRight?.title || 'Dokumentasi Utama Open Trip'"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.topRight?.title"
            :style="{ opacity: cornerLabelOpacity }"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.topRight.title }}</div>
            <div v-if="labels.topRight.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.topRight.subtitle }}
            </div>
          </div>

          <slot name="hero-overlay" :progress="smoothProgress" />
        </div>
      </div>
    </div>
  </div>
</template>
