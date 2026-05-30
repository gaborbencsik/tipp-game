<template>
  <section
    class="rounded-xl bg-white"
    :class="cardClass"
    :data-testid="`bracket-round-${round}`"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between px-3 py-3 text-left"
      @click="$emit('toggle')"
    >
      <span class="font-semibold text-sm flex items-center gap-1.5" :class="titleClass">
        <span v-if="isDone" class="text-emerald-500" aria-hidden="true">✓</span>
        <span>{{ $t(`bracketProgression.round.${round}`) }}</span>
      </span>
      <span
        class="text-xs font-semibold px-2 py-0.5 rounded-full"
        :class="badgeClass"
      >
        {{ completion.done }} / {{ completion.total }}
      </span>
    </button>
    <div v-if="expanded" class="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
      <BracketMatchCard
        v-for="match in matches"
        :key="match.id"
        :match="match"
        :team-map="teamMap"
        @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BracketMatchCard from './BracketMatchCard.vue'
import type { Team, BracketRound } from '../../types/index.js'
import type { DerivedMatch } from '../../lib/bracketDerive.js'

const props = defineProps<{
  round: BracketRound
  matches: readonly DerivedMatch[]
  expanded: boolean
  completion: { done: number; total: number }
  teamMap: ReadonlyMap<string, Team>
}>()

defineEmits<{
  'toggle': []
  'pick': [matchId: string, teamId: string]
}>()

const isDone = computed(() => props.completion.total > 0 && props.completion.done === props.completion.total)
const isLocked = computed(() => props.matches.length > 0 && props.matches.every(m => m.isLocked))

const cardClass = computed(() => {
  if (props.expanded) return 'border-2 border-blue-400 ring-4 ring-blue-100 shadow-md'
  if (isDone.value) return 'border border-emerald-300 shadow-sm'
  if (isLocked.value) return 'border-2 border-dashed border-slate-300 bg-slate-50'
  return 'border border-slate-200'
})

const titleClass = computed(() => {
  if (isLocked.value && !props.expanded) return 'text-slate-500'
  return 'text-slate-800'
})

const badgeClass = computed(() => {
  if (isDone.value) return 'bg-emerald-50 text-emerald-700'
  if (props.expanded) return 'bg-blue-50 text-blue-600'
  if (isLocked.value) return 'bg-slate-100 text-slate-400'
  return 'bg-slate-100 text-slate-600'
})
</script>
