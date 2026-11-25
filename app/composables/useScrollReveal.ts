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
  let resetIo: IntersectionObserver | null = null
  let mo: MutationObserver | null = null
  let rafId: number | null = null
  let reducedMotion = false
  const settleTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>()
  const observedSet = new WeakSet<Element>()
  const pendingSet = new Set<Element>()
  const activeSet = new Set<Element>()

  // Cached DOM lookups refreshed on mount & DOM mutations instead of every scroll frame
  let parallaxTopCache: Array<{ el: HTMLElement; speed: number; lastPy: string }> = []
  let parallaxFloatCache: Array<{ el: HTMLElement; speed: number; lastPy: string }> = []
  let parallaxScrubCache: Array<{ el: HTMLElement; scaleMin: number; lastPy: string; lastScale: string }> = []
  let sectionTargets: Array<{ id: string; el: HTMLElement }> = []
  let lastProgressStr = ''

  function refreshCachedElements() {
    const root = rootRef.value
    if (!root) return

    parallaxTopCache = []
    root.querySelectorAll<HTMLElement>('[data-parallax-top]').forEach((el) => {
      const speed = Number.parseFloat(el.dataset.parallaxTop || '0')
      if (Number.isFinite(speed) && speed !== 0) {
        parallaxTopCache.push({ el, speed, lastPy: '' })
      }
    })

    parallaxFloatCache = []
    root.querySelectorAll<HTMLElement>('[data-parallax-float]').forEach((el) => {
      const speed = Number.parseFloat(el.dataset.parallaxFloat || '0')
      if (Number.isFinite(speed) && speed !== 0) {
        parallaxFloatCache.push({ el, speed, lastPy: '' })
      }
    })

    parallaxScrubCache = []
    root.querySelectorAll<HTMLElement>('[data-parallax-scrub]').forEach((el) => {
      const scaleMin = Number.parseFloat(el.dataset.scrubScale || '0.94')
      parallaxScrubCache.push({
        el,
        scaleMin: Number.isFinite(scaleMin) ? scaleMin : 0.94,
        lastPy: '',
        lastScale: '',
      })
    })

    sectionTargets = []
    for (const id of options.sectionIds ?? []) {
      const target = document.getElementById(id)
      if (target) sectionTargets.push({ id, el: target })
    }
  }

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
    resetIo?.unobserve(el)
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
    if (options.replay !== false && !reducedMotion) {
      resetIo?.observe(el)
    }
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
    const progressStr = progress.toFixed(4)
    if (progressStr !== lastProgressStr) {
      lastProgressStr = progressStr
      root.style.setProperty('--mry-scroll-progress', progressStr)
    }

    // Trigger any pending elements that entered viewport (prevents stuck elements during fast scroll or clip-path)
    const nearPageEnd = y >= maxScroll - 80
    if (pendingSet.size > 0) {
      const triggerLine = nearPageEnd ? vh * 1.05 : vh * 0.94
      for (const el of Array.from(pendingSet)) {
        if (!el.isConnected) {
          pendingSet.delete(el)
          continue
        }
        if (nearPageEnd || el.getBoundingClientRect().top < triggerLine) {
          revealEl(el)
        }
      }
    }

    let detectedSection = ''
    if (sectionTargets.length) {
      const probeY = Math.min(vh * 0.36, 280)
      for (const { id, el: target } of sectionTargets) {
        if (!target.isConnected) continue
        const r = target.getBoundingClientRect()
        if (r.top <= probeY && r.bottom >= 110) {
          detectedSection = id
          break
        }
      }
    }

    const parallaxWrites: Array<{
      item: { el: HTMLElement; lastPy: string; lastScale?: string }
      pyStr: string
      scaleStr?: string
    }> = []
    if (!reducedMotion && options.enableParallax !== false) {
      for (const item of parallaxTopCache) {
        if (!item.el.isConnected) continue
        const offset = Math.max(-110, Math.min(170, y * item.speed))
        const pyStr = `${offset.toFixed(1)}px`
        if (pyStr !== item.lastPy) {
          parallaxWrites.push({ item, pyStr })
        }
      }

      for (const item of parallaxFloatCache) {
        if (!item.el.isConnected) continue
        const r = item.el.getBoundingClientRect()
        if (r.bottom < -160 || r.top > vh + 160) continue
        const centerDist = r.top + r.height / 2 - vh / 2
        const offset = Math.max(-52, Math.min(52, centerDist * item.speed))
        const pyStr = `${offset.toFixed(1)}px`
        if (pyStr !== item.lastPy) {
          parallaxWrites.push({ item, pyStr })
        }
      }

      for (const item of parallaxScrubCache) {
        if (!item.el.isConnected) continue
        const r = item.el.getBoundingClientRect()
        if (r.bottom < -120 || r.top > vh + 120) continue
        const raw = 1 - Math.min(1, Math.max(0, (r.top - vh * 0.15) / (vh * 0.85)))
        const scale = item.scaleMin + (1 - item.scaleMin) * raw
        const py = (1 - raw) * 28
        const pyStr = `${py.toFixed(1)}px`
        const scaleStr = scale.toFixed(4)
        if (pyStr !== item.lastPy || scaleStr !== item.lastScale) {
          parallaxWrites.push({ item, pyStr, scaleStr })
        }
      }
    }

    if (activeSection.value !== detectedSection) {
      activeSection.value = detectedSection
    }

    for (const write of parallaxWrites) {
      if (write.pyStr !== write.item.lastPy) {
        write.item.lastPy = write.pyStr
        write.item.el.style.setProperty('--mry-py', write.pyStr)
      }
      if (write.scaleStr !== undefined && write.scaleStr !== write.item.lastScale) {
        write.item.lastScale = write.scaleStr
        write.item.el.style.setProperty('--mry-pscale', write.scaleStr)
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
          if (entry.isIntersecting || entry.boundingClientRect.top < vh * 0.94) {
            revealEl(entry.target)
          }
        }
      },
      {
        threshold: 0,
        rootMargin: '0px 0px -4% 0px',
      },
    )

    if (options.replay !== false) {
      resetIo = new IntersectionObserver(
        (entries) => {
          const vh = window.innerHeight || 900
          for (const entry of entries) {
            if (!entry.isIntersecting && activeSet.has(entry.target) && entry.boundingClientRect.top > vh) {
              resetEl(entry.target)
            }
          }
        },
        {
          threshold: 0,
          rootMargin: '0px 0px 140px 0px',
        },
      )
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!rootRef.value) return
        registerTree(rootRef.value)
        refreshCachedElements()
        updateScrollEffects()
      })
    })

    mo = new MutationObserver((mutations) => {
      let hasAddedElement = false
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof Element) {
            hasAddedElement = true
            registerTree(node)
          }
        }
      }
      if (hasAddedElement) {
        refreshCachedElements()
      }
    })
    mo.observe(root, { childList: true, subtree: true })

    window.addEventListener('scroll', scheduleScrollUpdate, { passive: true })
    window.addEventListener('resize', scheduleScrollUpdate, { passive: true })
  })

  onBeforeUnmount(() => {
    io?.disconnect()
    io = null
    resetIo?.disconnect()
    resetIo = null
    mo?.disconnect()
    mo = null
    pendingSet.clear()
    for (const el of activeSet) {
      clearElTimer(el)
    }
    activeSet.clear()
    parallaxTopCache = []
    parallaxFloatCache = []
    parallaxScrubCache = []
    sectionTargets = []
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
