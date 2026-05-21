<template>
  <button
    type="button"
    class="w-full text-left bg-white border rounded-lg p-3 hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-3"
    :class="borderClass"
    @click="emit('click')"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-800 truncate">
        <TeamBadge :team="match.homeTeam" />
        <span class="text-gray-400 shrink-0">
          <template v-if="match.result">{{ match.result.homeGoals }}–{{ match.result.awayGoals }}</template>
          <template v-else>vs</template>
        </span>
        <TeamBadge :team="match.awayTeam" />
      </div>
      <div class="text-xs text-gray-400 mt-1">{{ formatDate(match.scheduledAt) }}</div>
    </div>

    <div class="shrink-0 text-right">
      <template v-if="prediction">
        <div class="text-sm font-semibold text-gray-700">
          {{ prediction.homeGoals }}–{{ prediction.awayGoals }}
        </div>
        <div
          v-if="prediction.pointsGlobal !== null"
          class="text-xs font-bold mt-0.5 px-1.5 py-0.5 rounded inline-block"
          :class="pointsClass"
        >
          {{ prediction.pointsGlobal }} {{ pointsLabel }}
        </div>
      </template>
      <template v-else-if="match.status === 'finished'">
        <span class="text-xs font-medium text-red-500">{{ missedLabel }}</span>
      </template>
      <template v-else>
        <span class="text-xs text-gray-400">—</span>
      </template>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TeamBadge from '../TeamBadge.vue'
import type { Match, Prediction } from '../../types/index.js'
import type { ScoringBuckets } from '../../composables/useMyStats.js'
import { getDateLocale } from '../../lib/dateLocale.js'

interface Props {
  match: Match
  prediction: Prediction | null
  scoringConfig: ScoringBuckets | null
  pointsLabel: string
  missedLabel: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ click: [] }>()

const pointsClass = computed(() => {
  if (!props.prediction || props.prediction.pointsGlobal === null) return 'bg-gray-100 text-gray-500'
  const p = props.prediction.pointsGlobal
  if (props.scoringConfig && p === props.scoringConfig.exactScore) return 'bg-green-50 text-green-700'
  if (p > 0) return 'bg-blue-50 text-blue-700'
  return 'bg-gray-100 text-gray-500'
})

const borderClass = computed(() => {
  if (!props.prediction && props.match.status === 'finished') return 'border-red-200'
  return 'border-gray-200'
})

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
</script>
