<template>
  <div
    v-if="showBlock"
    class="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4"
    data-testid="market-values-section"
  >
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {{ $t('matchDetail.marketValuesTitle') }}
      </span>
    </div>

    <div class="space-y-2">
      <!-- Home row -->
      <div class="flex items-center gap-2" data-testid="market-values-home-row">
        <img
          v-if="homeTeam.flagUrl"
          :src="homeTeam.flagUrl"
          :alt="homeTeam.name"
          class="w-4 h-3 object-cover flex-shrink-0"
        />
        <component
          :is="homeTeam.transfermarktId ? 'a' : 'span'"
          :href="homeTeam.transfermarktId ? transfermarktUrl(homeTeam) : undefined"
          :target="homeTeam.transfermarktId ? '_blank' : undefined"
          :rel="homeTeam.transfermarktId ? 'noopener noreferrer' : undefined"
          class="text-xs sm:text-sm font-medium text-gray-700 w-20 sm:w-32 truncate"
          :class="{ 'hover:text-blue-600 hover:underline': homeTeam.transfermarktId }"
          data-testid="market-values-home-name"
        >
          {{ teamLabel(homeTeam) }}
        </component>
        <div class="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
          <div
            v-if="homeTeam.marketValueEur !== null"
            class="h-full bg-blue-500 transition-all duration-500"
            :style="{ width: homePct + '%' }"
            role="img"
            :aria-label="$t('matchDetail.marketValuesAriaLabel', { team: homeTeam.name, value: homeFormatted })"
            data-testid="market-values-home-bar"
          />
        </div>
        <span
          class="text-xs sm:text-sm font-semibold text-gray-700 w-16 sm:w-20 text-right tabular-nums"
          data-testid="market-values-home-value"
        >
          {{ homeFormatted }}
        </span>
      </div>

      <!-- Away row -->
      <div class="flex items-center gap-2" data-testid="market-values-away-row">
        <img
          v-if="awayTeam.flagUrl"
          :src="awayTeam.flagUrl"
          :alt="awayTeam.name"
          class="w-4 h-3 object-cover flex-shrink-0"
        />
        <component
          :is="awayTeam.transfermarktId ? 'a' : 'span'"
          :href="awayTeam.transfermarktId ? transfermarktUrl(awayTeam) : undefined"
          :target="awayTeam.transfermarktId ? '_blank' : undefined"
          :rel="awayTeam.transfermarktId ? 'noopener noreferrer' : undefined"
          class="text-xs sm:text-sm font-medium text-gray-700 w-20 sm:w-32 truncate"
          :class="{ 'hover:text-blue-600 hover:underline': awayTeam.transfermarktId }"
          data-testid="market-values-away-name"
        >
          {{ teamLabel(awayTeam) }}
        </component>
        <div class="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
          <div
            v-if="awayTeam.marketValueEur !== null"
            class="h-full bg-emerald-500 transition-all duration-500"
            :style="{ width: awayPct + '%' }"
            role="img"
            :aria-label="$t('matchDetail.marketValuesAriaLabel', { team: awayTeam.name, value: awayFormatted })"
            data-testid="market-values-away-bar"
          />
        </div>
        <span
          class="text-xs sm:text-sm font-semibold text-gray-700 w-16 sm:w-20 text-right tabular-nums"
          data-testid="market-values-away-value"
        >
          {{ awayFormatted }}
        </span>
      </div>
    </div>

    <p class="text-xs text-gray-500 mt-2">
      {{ $t('matchDetail.marketValuesSource') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatMarketValueEur } from '../utils/formatMarketValue.js'

interface MarketTeam {
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
  readonly marketValueEur: number | null
  readonly transfermarktId: number | null
}

const props = defineProps<{
  homeTeam: MarketTeam
  awayTeam: MarketTeam
}>()

const { locale } = useI18n()

const MOBILE_BREAKPOINT_PX = 375
const isMobile = ref(false)

function updateMobile(): void {
  if (typeof window === 'undefined') return
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT_PX
}

onMounted(() => {
  updateMobile()
  window.addEventListener('resize', updateMobile)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateMobile)
  }
})

const showBlock = computed((): boolean =>
  props.homeTeam.marketValueEur !== null || props.awayTeam.marketValueEur !== null,
)

function teamLabel(team: MarketTeam): string {
  return isMobile.value ? team.shortCode : team.name
}

function transfermarktSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function transfermarktUrl(team: MarketTeam): string {
  const slug = transfermarktSlug(team.name) || '-'
  return `https://www.transfermarkt.com/${slug}/startseite/verein/${team.transfermarktId}`
}

const formatLocale = computed((): 'hu' | 'en' => (locale.value === 'en' ? 'en' : 'hu'))

const homeFormatted = computed((): string =>
  props.homeTeam.marketValueEur === null
    ? '—'
    : formatMarketValueEur(props.homeTeam.marketValueEur, formatLocale.value),
)

const awayFormatted = computed((): string =>
  props.awayTeam.marketValueEur === null
    ? '—'
    : formatMarketValueEur(props.awayTeam.marketValueEur, formatLocale.value),
)

const homePct = computed((): number => {
  const h = props.homeTeam.marketValueEur
  const a = props.awayTeam.marketValueEur
  if (h === null) return 0
  if (a === null) return 100
  const total = h + a
  if (total === 0) return 0
  return (h / total) * 100
})

const awayPct = computed((): number => {
  const h = props.homeTeam.marketValueEur
  const a = props.awayTeam.marketValueEur
  if (a === null) return 0
  if (h === null) return 100
  const total = h + a
  if (total === 0) return 0
  return (a / total) * 100
})
</script>
