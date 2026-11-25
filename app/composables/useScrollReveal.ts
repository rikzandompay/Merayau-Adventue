import type { Ref } from 'vue'

const REVEAL_ATTRS = [
  'data-reveal',
  'data-reveal-media',
  'data-reveal-left',
  'data-reveal-right',
  'data-reveal-scale',
  'data-reveal-clip',
  'data-reveal-stagger',
  'data-reveal-carousel',
] as const

const REVEAL_SELECTOR = REVEAL_ATTRS.map((a) => `[${a}]`).join(', ')

export interface ScrollRevealOptions {
  sectionIds?: string[]
  enableParallax?: boolean
  replay?: boolean
}

function parseMsVar(raw: string | null | undefined): number {
  if (!raw) return 0
  const num = Number.parseFloat(raw)
  return Number.isFinite(num) ? num : 0
}

function getRevealWaitMs(el: Element): number {
  let maxDelay = parseMsVar((el as HTMLElement).style?.getPropertyValue('--reveal-delay'))
  if (el.hasAttribute('data-reveal-stagger') || el.hasAttribute('data-reveal-carousel')) {
    const children = el.querySelectorAll('.mry-stagger-item, .mry-carousel-card')
    children.forEach((child) => {
      const d = parseMsVar((child as HTMLElement).style?.getPropertyValue('--stagger-delay'))
      if (d > maxDelay) maxDelay = d
    })
  }
  return maxDelay + 1050
}

export function useScrollReveal(rootRef: Ref<HTMLElement | null>, options: ScrollRevealOptions = {}) {
  const scrollProgress = ref(0)
  const activeSection = ref('')

  let io: IntersectionObserver | null = null
  let mo: MutationObserver | null = null
  let rafId: number | null = null
  let reducedMotion = false
  const settleTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
  const observedSet = new WeakSet<Element>()
  const pendingSet = new Set<Element>()
  const activeSet = new Set<Element>()

  function clearElTimer(el: Element) {
    const prev = settleTimers.get(el)
    if (prev) {
      clearTimeout(prev)
      settleTimers.delete(el)
    }
  }

  function resetEl(el: Element) {
    clearElTimer(el)
    activeSet.delete(el)
    for (const attr of REVEAL_ATTRS) {
      if (el.hasAttribute(attr)) {
        el.setAttribute(attr, '')
      }
    }
    pendingSet.add(el)
    io?.observe(el)
  }

  function revealEl(el: Element, immediate = false) {
    pendingSet.delete(el)
    io?.unobserve(el)

    let matched = false
    for (const attr of REVEAL_ATTRS) {
      if (el.hasAttribute(attr)) {
        const cur = el.getAttribute(attr)
        if (cur === 'settled' || (!immediate && cur === 'visible')) return
        el.setAttribute(attr, immediate ? 'settled' : 'visible')
        matched = true
      }
    }
    if (!matched || immediate) return

    activeSet.add(el)
    clearElTimer(el)
    const waitMs = getRevealWaitMs(el)
    const timer = setTimeout(() => {
      settleTimers.delete(el)
      for (const attr of REVEAL_ATTRS) {
        if (el.getAttribute(attr) === 'visible') {
          el.setAttribute(attr, 'settled')
        }
      }
    }, waitMs)
    settleTimers.set(el, timer)
  }

  function observeNode(el: Element) {
    if (reducedMotion) {
      revealEl(el, true)
      return
    }
    if (observedSet.has(el)) return
    observedSet.add(el)

    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || 900
    // Initial load / already above-or-in view reveals immediately with entrance animation
    if (rect.top < vh * 0.92) {
      requestAnimationFrame(() => revealEl(el))
      return
    }
    pendingSet.add(el)
    io?.observe(el)
  }

  function registerTree(scope: ParentNode) {
    if (scope instanceof Element && scope.matches(REVEAL_SELECTOR)) {
      observeNode(scope)
    }
    scope.querySelectorAll(REVEAL_SELECTOR).forEach(observeNode)
  }

  function updateScrollEffects() {
    rafId = null
    const root = rootRef.value
    if (!root) return

    const docEl = document.documentElement
    const maxScroll = Math.max(1, docEl.scrollHeight - window.innerHeight)
    const y = window.scrollY || window.pageYOffset || 0
    const vh = window.innerHeight || 900
    const progress = Math.min(1, Math.max(0, y / maxScroll))
    scrollProgress.value = progress
    root.style.setProperty('--mry-scroll-progress', progress.toFixed(4))

    // Trigger elements clearly inside lower 87% of viewport, or all remaining elements near bottom of page
    const nearPageEnd = y >= maxScroll - 80
    const triggerLine = nearPageEnd ? vh * 1.05 : vh * 0.87

    // Batch all geometry reads before DOM writes
    const toReveal: Element[] = []
    for (const el of pendingSet) {
      if (!el.isConnected) {
        pendingSet.delete(el)
        continue
      }
      const r = el.getBoundingClientRect()
      if (r.top < triggerLine) {
        toReveal.push(el)
      }
    }

    // If replay is enabled (default true), reset elements once they exit well below the bottom edge
    // so scrolling down again cleanly replays their entrance animation without flickering upward scrolls.
    const toReset: Element[] = []
    if (!reducedMotion && options.replay !== false && !nearPageEnd) {
      const resetLine = vh + 140
      for (const el of activeSet) {
        if (!el.isConnected) {
          activeSet.delete(el)
          continue
        }
        const r = el.getBoundingClientRect()
        if (r.top > resetLine) {
          toReset.push(el)
        }
      }
    }

    const sectionIds = options.sectionIds ?? []
    let detectedSection = ''
    if (sectionIds.length) {
      const probeY = Math.min(vh * 0.36, 280)
      for (const id of sectionIds) {
        const target = document.getElementById(id)
        if (!target) continue
        const r = target.getBoundingClientRect()
        if (r.top <= probeY && r.bottom >= 110) {
          detectedSection = id
          break
        }
      }
    }

    const parallaxWrites: Array<{ el: HTMLElement; py: number; px?: number; scale?: number }> = []
    if (!reducedMotion && options.enableParallax !== false) {
      const topEls = root.querySelectorAll<HTMLElement>('[data-parallax-top]')
      for (const el of topEls) {
        const speed = Number.parseFloat(el.dataset.parallaxTop || '0')
        if (!Number.isFinite(speed) || speed === 0) continue
        const offset = Math.max(-110, Math.min(170, y * speed))
        parallaxWrites.push({ el, py: offset })
      }

      const floatEls = root.querySelectorAll<HTMLElement>('[data-parallax-float]')
      for (const el of floatEls) {
        const speed = Number.parseFloat(el.dataset.parallaxFloat || '0')
        if (!Number.isFinite(speed) || speed === 0) continue
        const r = el.getBoundingClientRect()
        if (r.bottom < -160 || r.top > vh + 160) continue
        const centerDist = r.top + r.height / 2 - vh / 2
        const offset = Math.max(-52, Math.min(52, centerDist * speed))
        parallaxWrites.push({ el, py: offset })
      }

      const scrubEls = root.querySelectorAll<HTMLElement>('[data-parallax-scrub]')
      for (const el of scrubEls) {
        const r = el.getBoundingClientRect()
        if (r.bottom < -120 || r.top > vh + 120) continue
        const raw = 1 - Math.min(1, Math.max(0, (r.top - vh * 0.15) / (vh * 0.85)))
        const scaleMin = Number.parseFloat(el.dataset.scrubScale || '0.94')
        const scale = scaleMin + (1 - scaleMin) * raw
        const py = (1 - raw) * 28
        parallaxWrites.push({ el, py, scale })
      }
    }

    for (const el of toReveal) {
      revealEl(el)
    }
    for (const el of toReset) {
      resetEl(el)
    }

    if (activeSection.value !== detectedSection) {
      activeSection.value = detectedSection
    }

    for (const item of parallaxWrites) {
      item.el.style.setProperty('--mry-py', `${item.py.toFixed(1)}px`)
      if (item.scale !== undefined) {
        item.el.style.setProperty('--mry-pscale', item.scale.toFixed(4))
      }
    }
  }

  function scheduleScrollUpdate() {
    if (rafId !== null) return
    rafId = requestAnimationFrame(updateScrollEffects)
  }

  onMounted(() => {
    const root = rootRef.value
    if (!root) return

    reducedMotion = false

    root.classList.add('mry-motion-ready')

    io = new IntersectionObserver(
      (entries) => {
        const vh = window.innerHeight || 900
        for (const entry of entries) {
          if (entry.isIntersecting || entry.boundingClientRect.top < vh * 0.87) {
            revealEl(entry.target)
          }
        }
      },
      {
        threshold: 0.05,
        rootMargin: '0px 0px -12% 0px',
      },
    )

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!rootRef.value) return
        registerTree(rootRef.value)
        updateScrollEffects()
      })
    })

    mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof Element) {
            registerTree(node)
          }
        }
      }
    })
    mo.observe(root, { childList: true, subtree: true })

    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
    window.addEventListener('resize', scheduleScrollUpdate, { passive: true })
  })

  onBeforeUnmount(() => {
    io?.disconnect()
    io = null
    mo?.disconnect()
    mo = null
    pendingSet.clear()
    for (const el of activeSet) {
      clearElTimer(el)
    }
    activeSet.clear()
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (import.meta.client) {
      window.removeEventListener('scroll', scheduleScrollUpdate)
      window.removeEventListener('resize', scheduleScrollUpdate)
    }
  })

  return {
    scrollProgress,
    activeSection,
  }
}
