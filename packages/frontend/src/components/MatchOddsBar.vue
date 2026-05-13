<template>
  <div
    v-if="odds"
    class="bg-gray-50 border border-gray-200 rounded-lg p-4"
    data-testid="match-odds-bar"
  >
    <div class="flex items-center justify-between mb-3">
      <span class="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {{ $t('matchDetail.oddsTitle') }}
      </span>
      <a
        v-if="odds.sourceUrl"
        :href="odds.sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-xs text-gray-400 hover:text-blue-500 transition-colors"
        data-testid="odds-source-link"
      >
        Polymarket ↗
      </a>
    </div>

    <div data-testid="odds-stacked">
      <div class="flex h-8 rounded-md overflow-hidden text-xs font-medium text-white">
        <div
          class="flex items-center justify-center bg-blue-500 transition-all duration-500"
          :style="{ width: homePct + '%' }"
          data-testid="odds-stacked-home"
        >
          <span v-if="homePct > 12" class="truncate px-1">{{ odds.homeTeam.name }} {{ homePct }}%</span>
          <span v-else class="truncate px-1">{{ homePct }}%</span>
        </div>
        <div
          v-if="odds.draw !== null"
          class="flex items-center justify-center bg-gray-400 transition-all duration-500"
          :style="{ width: drawPct + '%' }"
          data-testid="odds-stacked-draw"
        >
          <span class="truncate px-1">{{ drawPct }}%</span>
        </div>
        <div
          class="flex items-center justify-center bg-emerald-500 transition-all duration-500"
          :style="{ width: awayPct + '%' }"
          data-testid="odds-stacked-away"
        >
          <span v-if="awayPct > 12" class="truncate px-1">{{ odds.awayTeam.name }} {{ awayPct }}%</span>
          <span v-else class="truncate px-1">{{ awayPct }}%</span>
        </div>
      </div>
    </div>

    <!-- Confidence chip -->
    <div v-if="confidence" class="mt-2" data-testid="odds-confidence">
      <span
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-sm font-medium"
        :class="confidence.chipClass"
        data-testid="odds-confidence-chip"
      >
        <span class="font-bold">{{ confidence.icon }}</span>
        <span>
          <strong v-if="confidence.bold">{{ confidence.label }}</strong>
          <template v-else>{{ confidence.label }}</template>
          <template v-if="confidence.sublabel"> — {{ confidence.sublabel }}</template>
        </span>
      </span>
    </div>

    <p class="text-xs text-gray-400 mt-1.5" data-testid="odds-explainer">
      {{ $t('matchDetail.oddsSource') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MatchOdds } from '../types/index.js'

const { t } = useI18n()
const props = defineProps<{ odds: MatchOdds | null }>()

const homePct = computed((): number => {
  if (!props.odds) return 0
  return Math.round(props.odds.homeTeam.odds * 100)
})

const drawPct = computed((): number => {
  if (!props.odds || props.odds.draw === null) return 0
  return Math.round(props.odds.draw * 100)
})

const awayPct = computed((): number => {
  if (!props.odds) return 0
  return Math.round(props.odds.awayTeam.odds * 100)
})

const FALLBACK_MEDIAN = 240

const MULTIPLIER_THRESHOLDS = {
  VERY_LOW: 0.2,
  LOW: 1.0,
  NORMAL: 10,
  HIGH: 33,
}

interface ConfidenceInfo {
  level: number
  label: string
  sublabel: string | null
  icon: string
  bold: boolean
  chipClass: string
}

const confidence = computed((): ConfidenceInfo | null => {
  if (!props.odds?.volume) return null
  const vol = props.odds.volume
  const median = props.odds.avgVolume ?? FALLBACK_MEDIAN
  const multiplier = vol / median

  if (multiplier < MULTIPLIER_THRESHOLDS.VERY_LOW) {
    return {
      level: 1,
      label: t('matchDetail.oddsConfidence1'),
      sublabel: null,
      icon: '!',
      bold: false,
      chipClass: 'bg-red-50 border border-red-200 text-red-800',
    }
  }
  if (multiplier < MULTIPLIER_THRESHOLDS.LOW) {
    return {
      level: 2,
      label: t('matchDetail.oddsConfidence2'),
      sublabel: t('matchDetail.oddsConfidence2Sub'),
      icon: '~',
      bold: false,
      chipClass: 'bg-amber-50 border border-amber-200 text-amber-800',
    }
  }
  if (multiplier < MULTIPLIER_THRESHOLDS.NORMAL) {
    return {
      level: 3,
      label: t('matchDetail.oddsConfidence3'),
      sublabel: Math.round(multiplier) >= 2 ? t('matchDetail.oddsConfidenceMultiplier', { n: Math.round(multiplier) }) : null,
      icon: '•',
      bold: false,
      chipClass: 'bg-gray-50 border border-gray-200 text-gray-600',
    }
  }
  if (multiplier < MULTIPLIER_THRESHOLDS.HIGH) {
    return {
      level: 4,
      label: t('matchDetail.oddsConfidence4'),
      sublabel: t('matchDetail.oddsConfidenceMultiplier', { n: Math.round(multiplier) }),
      icon: '✓',
      bold: true,
      chipClass: 'bg-green-50 border border-green-200 text-green-800',
    }
  }
  return {
    level: 5,
    label: t('matchDetail.oddsConfidence5'),
    sublabel: t('matchDetail.oddsConfidenceMultiplier', { n: Math.round(multiplier) }),
    icon: '✓✓',
    bold: true,
    chipClass: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
  }
})
</script>
