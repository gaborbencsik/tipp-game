<template>
  <div v-if="total > 0" class="space-y-2">
    <div class="flex h-6 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      <div
        v-for="seg in visibleSegments"
        :key="seg.key"
        :class="seg.bgClass"
        :style="{ width: seg.percent + '%' }"
        :title="seg.tooltip"
        class="h-full transition-all"
      />
    </div>
    <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
      <span v-for="seg in visibleSegments" :key="seg.key" class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-sm" :class="seg.bgClass" />
        <span>{{ seg.label }}: {{ seg.count }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PointDistribution } from '../../composables/useMyStats.js'

interface Props {
  distribution: PointDistribution
  labels: {
    exact: string
    winnerAndDiff: string
    winner: string
    draw: string
    incorrect: string
    missed: string
  }
}

const props = defineProps<Props>()

const SEG_DEFS = [
  { key: 'exact', bgClass: 'bg-green-500' },
  { key: 'winnerAndDiff', bgClass: 'bg-blue-500' },
  { key: 'winner', bgClass: 'bg-sky-400' },
  { key: 'draw', bgClass: 'bg-cyan-400' },
  { key: 'incorrect', bgClass: 'bg-gray-400' },
  { key: 'missed', bgClass: 'bg-red-300' },
] as const

const total = computed(() =>
  props.distribution.exact +
  props.distribution.winnerAndDiff +
  props.distribution.winner +
  props.distribution.draw +
  props.distribution.incorrect +
  props.distribution.missed
)

const visibleSegments = computed(() => {
  return SEG_DEFS
    .map(def => {
      const count = props.distribution[def.key]
      const label = props.labels[def.key]
      const percent = total.value === 0 ? 0 : (count / total.value) * 100
      return { ...def, count, label, percent, tooltip: `${label}: ${count}` }
    })
    .filter(seg => seg.count > 0)
})
</script>
