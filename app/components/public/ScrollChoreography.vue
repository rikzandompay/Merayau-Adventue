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
  alts?: Partial<ScrollChoreographyImages>
}>()

const containerRef = ref<HTMLElement | null>(null)
const tlRef = ref<HTMLElement | null>(null)
const brRef = ref<HTMLElement | null>(null)
const blRef = ref<HTMLElement | null>(null)
const trShadowRef = ref<HTMLElement | null>(null)
const trCardRef = ref<HTMLElement | null>(null)
const trImgRef = ref<HTMLImageElement | null>(null)
const tlLabelRef = ref<HTMLElement | null>(null)
const brLabelRef = ref<HTMLElement | null>(null)
const blLabelRef = ref<HTMLElement | null>(null)
const trLabelRef = ref<HTMLElement | null>(null)

// Quantized reactive progress exposed only to slots (#top-hud & #hero-overlay)
// so Vue does not re-render slots on every sub-pixel spring frame.
const slotProgress = ref(0)

let currentProgress = 0
let targetProgress = 0
let velocity = 0
let rafId: number | null = null
let scrollReadRafId: number | null = null
let lastTime = 0
let reducedMotion = false

let isMobile = false
let viewportW = 1280
let viewportH = 800
let trNaturalAspect = 4 / 3
let lastTrImgTransform = ''
let lastTrBorderRadius = ''

const STIFFNESS = 400
const DAMPING = 50
const MASS = 1.2
const REST_DELTA = 0.001
const PHASE_STOPS = [0, 0.3, 0.35, 0.65, 1]

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

function getLayoutDims() {
  return isMobile
    ? { xLeft: -23, xRight: 23, yTop: -4, yBottom: 19, baseW: 42, baseH: 20 }
    : { xLeft: -20, xRight: 20, yTop: -14, yBottom: 14, baseW: 36, baseH: 24 }
}

function syncHeroImageBaseSize() {
  const img = trImgRef.value
  if (!img) return
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    trNaturalAspect = img.naturalWidth / img.naturalHeight
  }
  const viewAspect = viewportW / Math.max(1, viewportH)
  if (trNaturalAspect > viewAspect) {
    img.style.height = '100%'
    img.style.width = 'auto'
  } else {
    img.style.width = '100%'
    img.style.height = 'auto'
  }
}

function onHeroImgLoad() {
  syncHeroImageBaseSize()
  applyVisual(currentProgress)
}

function setCardTransform(el: HTMLElement | null, x: number, y: number, opacity: number) {
  if (!el) return
  el.style.transform = `translate3d(calc(-50% + ${x.toFixed(3)}vw), calc(-50% + ${y.toFixed(3)}vh), 0)`
  el.style.opacity = opacity.toFixed(3)
  el.style.visibility = opacity <= 0.002 ? 'hidden' : 'visible'
}

function applyVisual(p: number) {
  const d = getLayoutDims()
  const sideOpacity = interpolate(p, [0.75, 0.85], [1, 0])
  const labelOpacity = interpolate(p, [0.65, 0.78], [1, 0])

  const tlX = interpolate(p, PHASE_STOPS, [d.xLeft, d.xLeft, d.xLeft, 0, 0])
  const tlY = interpolate(p, PHASE_STOPS, [d.yTop, d.yBottom, d.yBottom, 0, 0])
  setCardTransform(tlRef.value, tlX, tlY, sideOpacity)

  const brX = interpolate(p, PHASE_STOPS, [d.xRight, d.xRight, d.xRight, 0, 0])
  const brY = interpolate(p, PHASE_STOPS, [d.yBottom, d.yTop, d.yTop, 0, 0])
  setCardTransform(brRef.value, brX, brY, sideOpacity)

  const blX = interpolate(p, PHASE_STOPS, [d.xLeft, d.xLeft, d.xLeft, 0, 0])
  const blY = interpolate(p, PHASE_STOPS, [d.yBottom, d.yBottom, d.yBottom, 0, 0])
  setCardTransform(blRef.value, blX, blY, sideOpacity)

  // Hero card (topRight): pure GPU transform scale + inverse image scale (0 clip-path, 0 layout reflow)
  const trX = interpolate(p, PHASE_STOPS, [d.xRight, d.xRight, d.xRight, 0, 0])
  const trY = interpolate(p, PHASE_STOPS, [d.yTop, d.yTop, d.yTop, 0, 0])
  const trW = interpolate(p, [0.65, 0.7, 0.9, 1], [d.baseW, d.baseW, 100, 100])
  const trH = interpolate(p, [0.65, 0.7, 0.9, 1], [d.baseH, d.baseH, 100, 100])
  const sx = trW / 100
  const sy = trH / 100

  const trCard = trCardRef.value
  if (trCard) {
    trCard.style.transform = `translate3d(${trX.toFixed(3)}vw, ${trY.toFixed(3)}vh, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
    const nextRadius = p >= 0.89 ? '0px' : isMobile ? '38px / 80px' : '44px / 67px'
    if (nextRadius !== lastTrBorderRadius) {
      lastTrBorderRadius = nextRadius
      trCard.style.borderRadius = nextRadius
    }
  }

  const trImg = trImgRef.value
  if (trImg) {
    const viewAspect = viewportW / Math.max(1, viewportH)
    const renderedImgW = trNaturalAspect > viewAspect ? viewportH * trNaturalAspect : viewportW
    const renderedImgH = trNaturalAspect > viewAspect ? viewportH : viewportW / Math.max(0.01, trNaturalAspect)
    const targetBoxW = sx * viewportW
    const targetBoxH = sy * viewportH
    const imgScale = Math.min(1, Math.max(targetBoxW / Math.max(1, renderedImgW), targetBoxH / Math.max(1, renderedImgH)))
    const nextImgTransform = `scale(${(imgScale / sx).toFixed(4)}, ${(imgScale / sy).toFixed(4)})`
    if (nextImgTransform !== lastTrImgTransform) {
      lastTrImgTransform = nextImgTransform
      trImg.style.transform = nextImgTransform
    }
  }

  // Shadow box behind tr keeps exact card drop-shadow in the 2x2 stage and fades out as tr expands
  const trShadowOpacity = interpolate(p, [0.68, 0.75], [1, 0])
  setCardTransform(trShadowRef.value, trX, trY, trShadowOpacity)

  // Corner labels
  const labelOpStr = labelOpacity.toFixed(3)
  if (tlLabelRef.value) tlLabelRef.value.style.opacity = labelOpStr
  if (brLabelRef.value) brLabelRef.value.style.opacity = labelOpStr
  if (blLabelRef.value) blLabelRef.value.style.opacity = labelOpStr
  if (trLabelRef.value) {
    trLabelRef.value.style.transform = `translate3d(calc(-50% + ${trX.toFixed(3)}vw), calc(-50% + ${trY.toFixed(3)}vh), 0)`
    trLabelRef.value.style.opacity = labelOpStr
    trLabelRef.value.style.visibility = labelOpacity <= 0.002 ? 'hidden' : 'visible'
  }

  // Update slotProgress only when visible slot state actually changes
  const inFadeZone = (p >= 0.55 && p <= 0.72) || (p >= 0.79 && p <= 0.92)
  const step = inFadeZone ? 200 : 100
  const quantized = Math.round(p * step) / step
  if (slotProgress.value !== quantized) {
    slotProgress.value = quantized
  }
}

function tickSpring(now: number) {
  const dtRaw = lastTime ? (now - lastTime) / 1000 : 0.016
  lastTime = now
  const dtTotal = Math.min(0.032, Math.max(0.001, dtRaw))

  // Two sub-steps keep stiff springs (stiffness=400) stable at 60/120Hz
  const steps = 2
  const dt = dtTotal / steps
  let pos = currentProgress
  let vel = velocity

  for (let s = 0; s < steps; s++) {
    const force = -STIFFNESS * (pos - targetProgress)
    const damper = -DAMPING * vel
    const accel = (force + damper) / MASS
    vel += accel * dt
    pos += vel * dt
  }

  velocity = vel
  currentProgress = pos

  if (Math.abs(targetProgress - pos) < REST_DELTA && Math.abs(vel) < REST_DELTA) {
    currentProgress = targetProgress
    velocity = 0
    applyVisual(currentProgress)
    rafId = null
    lastTime = 0
    return
  }

  applyVisual(currentProgress)
  rafId = requestAnimationFrame(tickSpring)
}

function updateViewport() {
  if (!import.meta.client) return
  viewportW = window.innerWidth || 1280
  viewportH = window.innerHeight || 800
  isMobile = viewportW < 768
  lastTrImgTransform = ''
  lastTrBorderRadius = ''
  syncHeroImageBaseSize()
  readScrollTarget()
  applyVisual(currentProgress)
}

function readScrollTarget() {
  scrollReadRafId = null
  const el = containerRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const scrollable = Math.max(1, rect.height - viewportH)
  targetProgress = clamp01(-rect.top / scrollable)

  if (reducedMotion) {
    currentProgress = targetProgress
    applyVisual(currentProgress)
    return
  }

  if (rafId === null && Math.abs(targetProgress - currentProgress) >= REST_DELTA) {
    lastTime = performance.now()
    rafId = requestAnimationFrame(tickSpring)
  }
}

function onScroll() {
  if (scrollReadRafId !== null) return
  scrollReadRafId = requestAnimationFrame(readScrollTarget)
}

watch(
  () => props.images.topRight,
  () => {
    nextTick(() => {
      lastTrImgTransform = ''
      syncHeroImageBaseSize()
      applyVisual(currentProgress)
    })
  },
)

onMounted(() => {
  reducedMotion = false
  updateViewport()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', updateViewport, { passive: true })
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (scrollReadRafId !== null) {
    cancelAnimationFrame(scrollReadRafId)
    scrollReadRafId = null
  }
  if (import.meta.client) {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', updateViewport)
  }
})

const BASE_FRAME_CLASSES =
  'absolute left-1/2 top-1/2 h-[20dvh] w-[42vw] md:h-[24vh] md:w-[36vw] overflow-hidden rounded-2xl bg-[#EAE5DA] shadow-lg will-change-transform'
</script>

<template>
  <div ref="containerRef" :class="['relative h-[220vh] w-full md:h-[300vh]', className]">
    <div class="sticky top-0 z-10 h-[100dvh] w-full overflow-hidden bg-white">
      <!-- Top editorial HUD above frames while cards choreograph -->
      <div class="pointer-events-none relative z-50 mx-auto max-w-[1280px] px-4 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <slot name="top-hud" :progress="slotProgress" />
      </div>

      <div class="absolute inset-0 flex items-center justify-center">
        <!-- Top Left Image -> moves to Bottom Left, then Center -->
        <div ref="tlRef" :class="[BASE_FRAME_CLASSES, 'z-10']">
          <img
            :src="images.topLeft"
            :alt="alts?.topLeft || labels?.topLeft?.title || 'Dokumentasi Open Trip 1'"
            decoding="async"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.topLeft?.title"
            ref="tlLabelRef"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.topLeft.title }}</div>
            <div v-if="labels.topLeft.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.topLeft.subtitle }}
            </div>
          </div>
        </div>

        <!-- Bottom Right Image -> moves to Top Right, then Center -->
        <div ref="brRef" :class="[BASE_FRAME_CLASSES, 'z-20']">
          <img
            :src="images.bottomRight"
            :alt="alts?.bottomRight || labels?.bottomRight?.title || 'Dokumentasi Open Trip 4'"
            decoding="async"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.bottomRight?.title"
            ref="brLabelRef"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.bottomRight.title }}</div>
            <div v-if="labels.bottomRight.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.bottomRight.subtitle }}
            </div>
          </div>
        </div>

        <!-- Bottom Left Image -> stays, then moves to Center -->
        <div ref="blRef" :class="[BASE_FRAME_CLASSES, 'z-30']">
          <img
            :src="images.bottomLeft"
            :alt="alts?.bottomLeft || labels?.bottomLeft?.title || 'Dokumentasi Open Trip 3'"
            decoding="async"
            class="h-full w-full object-cover"
          />
          <div
            v-if="labels?.bottomLeft?.title"
            ref="blLabelRef"
            class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5"
          >
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.bottomLeft.title }}</div>
            <div v-if="labels.bottomLeft.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.bottomLeft.subtitle }}
            </div>
          </div>
        </div>

        <!-- Shadow backing for Top Right card while in 2x2 grid -->
        <div
          ref="trShadowRef"
          aria-hidden="true"
          class="pointer-events-none absolute left-1/2 top-1/2 z-[39] h-[20dvh] w-[42vw] rounded-2xl bg-[#121613] shadow-lg will-change-transform md:h-[24vh] md:w-[36vw]"
        />

        <!-- Top Right Image (Hero -> stays, moves to Center, then expands full screen via pure GPU transform) -->
        <div
          ref="trCardRef"
          class="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-[#121613] will-change-transform"
        >
          <img
            ref="trImgRef"
            :src="images.topRight"
            :alt="alts?.topRight || labels?.topRight?.title || 'Dokumentasi Utama Open Trip'"
            decoding="async"
            class="max-w-none shrink-0 will-change-transform"
            @load="onHeroImgLoad"
          />
        </div>

        <!-- Top Right corner label overlay (stays crisp 1:1 while hero card is in 2x2 grid) -->
        <div
          v-if="labels?.topRight?.title"
          ref="trLabelRef"
          class="pointer-events-none absolute left-1/2 top-1/2 z-[41] h-[20dvh] w-[42vw] overflow-hidden rounded-2xl will-change-transform md:h-[24vh] md:w-[36vw]"
        >
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-2.5 text-white sm:p-3.5">
            <div class="truncate text-[11px] font-semibold sm:text-sm">{{ labels.topRight.title }}</div>
            <div v-if="labels.topRight.subtitle" class="mry-mono truncate text-[10px] text-white/85">
              {{ labels.topRight.subtitle }}
            </div>
          </div>
        </div>

        <!-- Full-screen Hero Overlay (fades in at progress >= 0.80) -->
        <div class="pointer-events-none absolute inset-0 z-[45]">
          <slot name="hero-overlay" :progress="slotProgress" />
        </div>
      </div>
    </div>
  </div>
</template>
