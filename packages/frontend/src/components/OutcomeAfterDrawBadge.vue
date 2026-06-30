<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MatchOutcome, MatchTeam } from '../types/index.js'
import type { OutcomeAfterDrawStatus } from '../lib/outcomeAfterDrawStatus.js'
import { outcomeAdvancer } from '../lib/outcomeAfterDrawStatus.js'

// UX-043: visual badge for the "döntetlen esetén továbbjutó" tip, shown after evaluation.
// Renders nothing for non-knockout matches; otherwise shows the predicted advancer
// with a status-derived color and (when applicable) the bonus-point label.

const props = defineProps<{
  status: OutcomeAfterDrawStatus
  predictionOutcome: MatchOutcome | null
  homeTeam: Pick<MatchTeam, 'id' | 'name' | 'shortCode'>
  awayTeam: Pick<MatchTeam, 'id' | 'name' | 'shortCode'>
  bonusPoints: number | null
}>()

const { t } = useI18n()

const advancer = computed(() => outcomeAdvancer(props.predictionOutcome))
const advancingTeamName = computed<string | null>(() => {
  if (advancer.value === 'home') return props.homeTeam.name
  if (advancer.value === 'away') return props.awayTeam.name
  return null
})

const modeLabel = computed<string | null>(() => {
  if (props.predictionOutcome === 'extra_time_home' || props.predictionOutcome === 'extra_time_away') {
    return t('matchPredictions.outcomeAfterDraw.modeExtraTime')
  }
  if (props.predictionOutcome === 'penalties_home' || props.predictionOutcome === 'penalties_away') {
    return t('matchPredictions.outcomeAfterDraw.modePenalties')
  }
  return null
})

const containerClass = computed((): string => {
  // Tailwind palette mirrors the scorer-pick badge so the two sit naturally side by side.
  switch (props.status) {
    case 'correct':
      return 'bg-green-50 text-green-700 border-green-200'
    case 'incorrect':
      return 'bg-gray-50 text-gray-500 border-gray-200'
    case 'inactive':
      return 'bg-gray-50 text-gray-400 border-gray-200'
    case 'pending':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'no-tip':
      return 'bg-gray-50 text-gray-400 border-gray-200 italic'
    case 'not-applicable':
      return ''
  }
})

const teamClass = computed((): string => {
  if (props.status === 'incorrect') return 'line-through decoration-gray-400'
  if (props.status === 'inactive') return 'opacity-70'
  return ''
})

const statusLabel = computed((): string | null => {
  switch (props.status) {
    case 'no-tip':   return t('matchPredictions.outcomeAfterDraw.noTip')
    case 'pending':  return t('matchPredictions.outcomeAfterDraw.pending')
    case 'inactive': return t('matchPredictions.outcomeAfterDraw.inactive')
    default: return null
  }
})

const showBonus = computed((): boolean => {
  return props.status === 'correct' && props.bonusPoints !== null && props.bonusPoints > 0
})
</script>

<template>
  <span
    v-if="status !== 'not-applicable'"
    data-testid="outcome-after-draw-badge"
    :data-status="status"
    class="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border whitespace-nowrap"
    :class="containerClass"
  >
    <span v-if="advancingTeamName" data-testid="outcome-after-draw-team" :class="teamClass">
      {{ advancingTeamName }}
    </span>
    <span v-if="advancingTeamName && modeLabel" data-testid="outcome-after-draw-mode" class="text-[10px] opacity-70" :class="teamClass">
      · {{ modeLabel }}
    </span>
    <span v-if="advancingTeamName && statusLabel" data-testid="outcome-after-draw-status-label" class="text-[10px] opacity-70">
      ({{ statusLabel }})
    </span>
    <span v-else-if="statusLabel" data-testid="outcome-after-draw-status-label">
      {{ statusLabel }}
    </span>
    <span v-if="status === 'correct'" data-testid="outcome-after-draw-correct-icon">{{ $t('matchPredictions.outcomeAfterDraw.correctSuffix') }}</span>
    <span v-if="status === 'incorrect' && advancingTeamName" data-testid="outcome-after-draw-incorrect-icon">{{ $t('matchPredictions.outcomeAfterDraw.incorrectSuffix') }}</span>
    <span v-if="showBonus" data-testid="outcome-after-draw-bonus" class="font-semibold">+{{ bonusPoints }}</span>
  </span>
</template>
