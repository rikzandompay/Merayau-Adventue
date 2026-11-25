<script setup lang="ts">
export interface GoogleReviewItem {
  name: string
  handle: string
  description: string
  timeLabel?: string
  reply?: string
}

const props = withDefaults(
  defineProps<{
    reviews: GoogleReviewItem[]
    title?: string
    subtitle?: string
    mapsUrl?: string
  }>(),
  {
    title: 'Ulasan Pelanggan di Google Maps',
    subtitle:
      'Komentar asli dari penyewa perlengkapan gunung dan pengunjung Basecamp Merayau Adventure Pontianak.',
    mapsUrl:
      'https://www.google.com/maps/place/Merayau+Adventure/@-0.0542884,109.3679072,17z/data=!4m8!3m7!1s0x2e1d59b3bc309edb:0xc97cb30e1afcf554!8m2!3d-0.0542884!4d109.3704821!9m1!1b1!16s%2Fg%2F11t_thvnfy?entry=ttu',
  },
)

const sectionRef = ref<HTMLElement | null>(null)
const inView = ref(false)
let io: IntersectionObserver | null = null

const titleWords = computed(() => props.title.split(' ').filter(Boolean))

// Build 2 equal halves (10 items each) so -50% loop wraps seamlessly like Section 04 Katalog Alat
const rowOneHalf = computed(() => [...props.reviews, ...props.reviews])
const rowTwoBase = computed(() => {
  if (props.reviews.length <= 1) return props.reviews
  return [...props.reviews.slice(2), ...props.reviews.slice(0, 2)].reverse()
})
const rowTwoHalf = computed(() => [...rowTwoBase.value, ...rowTwoBase.value])

const rowOneLoop = computed(() => [...rowOneHalf.value, ...rowOneHalf.value])
const rowTwoLoop = computed(() => [...rowTwoHalf.value, ...rowTwoHalf.value])

function initialsOf(name: string): string {
  const parts = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'MA'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

onMounted(() => {
  const el = sectionRef.value
  if (!el) return
  io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        inView.value = true
        io?.disconnect()
        io = null
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
  )
  io.observe(el)
})

onBeforeUnmount(() => {
  io?.disconnect()
  io = null
})
</script>

<template>
  <section
    id="ulasan"
    ref="sectionRef"
    class="mry-defer-section relative w-full overflow-x-clip border-t border-[#EAE5DA] bg-white py-16 sm:py-20"
  >
    <div class="relative z-10 flex w-full flex-col items-center">
      <!-- Word-by-word blur reveal header -->
      <div class="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 pb-10 text-center sm:px-6 md:pb-12">
        <div class="flex flex-wrap items-center justify-center gap-2">
          <span class="mry-mono inline-flex items-center gap-1.5 rounded-full border border-[#D6D0C4] bg-[#F5F2EB] px-3.5 py-1 text-xs font-semibold tracking-wider text-[#1E4D36] uppercase">
            <span>06 · Ulasan Google Maps</span>
            <span class="text-[#121613]">· 4,3 / 5</span>
          </span>
          <a
            :href="mapsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mry-mono inline-flex items-center gap-1 rounded-full border border-[#D6D0C4] bg-white px-3.5 py-1 text-xs font-semibold text-[#121613] transition-colors hover:border-[#1E4D36] hover:text-[#1E4D36]"
          >
            <span>Lihat di Google Maps</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <h2 class="mry-serif text-3xl leading-tight font-semibold tracking-tight text-[#121613] sm:text-5xl">
          <span
            v-for="(word, index) in titleWords"
            :key="`word-${word}-${index}`"
            class="mr-2.5 inline-block transition-all duration-500 ease-in-out"
            :style="{ transitionDelay: `${index * 80}ms` }"
            :class="
              inView
                ? 'translate-y-0 opacity-100 blur-none'
                : 'translate-y-3 opacity-0 blur-[6px]'
            "
          >
            {{ word }}
          </span>
        </h2>

        <p
          class="max-w-2xl text-sm leading-relaxed text-[#2E3530] transition-opacity duration-500 sm:text-base"
          :style="{ transitionDelay: '400ms' }"
          :class="inView ? 'opacity-100' : 'opacity-0'"
        >
          {{ subtitle }}
        </p>
      </div>

      <!-- Continuous Marquee matching Section 04 Katalog Alat (Top scrolls RIGHT, Bottom scrolls LEFT) -->
      <div data-reveal-media style="--reveal-delay: 100ms" class="w-full space-y-6">
        <!-- Row 1 (Top): automatic scroll to the RIGHT -->
        <div class="mry-marquee-wrap py-2">
          <div class="mry-review-track mry-review-right">
            <article
              v-for="(item, idx) in rowOneLoop"
              :key="`r1-${idx}-${item.name}`"
              :aria-hidden="idx >= rowOneHalf.length"
              class="flex w-[300px] shrink-0 items-start gap-3.5 px-2 py-1 sm:w-[350px]"
            >
              <div
                class="mry-mono mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#1E4D36]/20 bg-[#E6F0EA] text-xs font-bold text-[#1E4D36]"
                aria-hidden="true"
              >
                {{ initialsOf(item.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span class="truncate text-sm font-bold text-[#121613]">{{ item.name }}</span>
                  <span class="truncate text-xs text-[#5C645E]">
                    {{ item.timeLabel ? `${item.handle} · ${item.timeLabel}` : item.handle }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-3 text-sm leading-relaxed text-[#2E3530]">
                  {{ item.description }}
                </p>
              </div>
            </article>
          </div>
        </div>

        <!-- Row 2 (Bottom): automatic scroll to the LEFT (same motion as Katalog Alat) -->
        <div class="mry-marquee-wrap py-2">
          <div class="mry-review-track mry-review-left">
            <article
              v-for="(item, idx) in rowTwoLoop"
              :key="`r2-${idx}-${item.name}`"
              :aria-hidden="idx >= rowTwoHalf.length"
              class="flex w-[300px] shrink-0 items-start gap-3.5 px-2 py-1 sm:w-[350px]"
            >
              <div
                class="mry-mono mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D6D0C4] bg-[#F5F2EB] text-xs font-bold text-[#121613]"
                aria-hidden="true"
              >
                {{ initialsOf(item.name) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span class="truncate text-sm font-bold text-[#121613]">{{ item.name }}</span>
                  <span class="truncate text-xs text-[#5C645E]">
                    {{ item.timeLabel ? `${item.handle} · ${item.timeLabel}` : item.handle }}
                  </span>
                </div>
                <p class="mt-1 line-clamp-3 text-sm leading-relaxed text-[#2E3530]">
                  {{ item.description }}
                </p>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- Direct Google Maps CTA -->
      <div class="mt-10 px-4 text-center">
        <a
          :href="mapsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-[#D6D0C4] bg-[#FDFCFA] px-6 text-sm font-semibold text-[#121613] transition-colors hover:border-[#1E4D36] hover:bg-[#E6F0EA] hover:text-[#1E4D36]"
        >
          <span>Baca &amp; Tulis Ulasan di Google Maps</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
@keyframes mry-review-scroll-left {
  0% {
    transform: translate3d(0, 0, 0);
  }
  100% {
    transform: translate3d(-50%, 0, 0);
  }
}

@keyframes mry-review-scroll-right {
  0% {
    transform: translate3d(-50%, 0, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

.mry-review-track {
  display: flex;
  width: max-content;
  gap: 20px;
  padding-right: 20px;
  will-change: transform;
}

.mry-review-right {
  animation: mry-review-scroll-right 34s linear infinite;
}

.mry-review-left {
  animation: mry-review-scroll-left 38s linear infinite;
}
</style>
