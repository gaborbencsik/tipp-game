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
        <span v-if="isEvaluatedMaxHit" class="text-emerald-500" aria-hidden="true">✓</span>
        <span v-else-if="isDone" class="text-emerald-500" aria-hidden="true">✓</span>
        <span>{{ $t(`bracketProgression.round.${round}`) }}</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="badgeClass"
        >
          {{ badgeLabel }}
        </span>
        <span
          v-if="evaluation && !evaluation.pending"
          class="text-[11px] font-bold px-2 py-0.5 rounded-full"
          :class="pointsPillClass"
          :data-testid="`bracket-round-points-${round}`"
        >
          {{ pointsPillLabel }}
        </span>
      </span>
    </button>
    <div v-if="expanded" class="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
      <BracketMatchCard
        v-for="match in matches"
        :key="match.id"
        :match="match"
        :team-map="teamMap"
        :advancing-team-ids="advancingTeamIds"
        :is-read-only="isReadOnly"
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
  /**
   * UX-045: set of team ids that actually reached this round (i.e. participants of
   * the current round from the admin's correctAnswer). null = not evaluated yet.
   */
  advancingTeamIds?: ReadonlySet<string> | null
  /**
   * UX-045: round-level breakdown; when present the header shows a points pill next
   * to the done/total badge. `pending` means the admin has not filled this round in
   * the correct answer yet — no pill is shown.
   */
  evaluation?: { matched: number; points: number; pointsPerTeam: number; pending?: boolean } | null
  isReadOnly?: boolean
}>()

defineEmits<{
  'toggle': []
  'pick': [matchId: string, teamId: string]
}>()

const isDone = computed(() => props.completion.total > 0 && props.completion.done === props.completion.total)
const isLocked = computed(() => props.matches.length > 0 && props.matches.every(m => m.isLocked))
const isEvaluated = computed(() => !!props.evaluation && !props.evaluation.pending)

const roundTargetCount = computed(() => {
  switch (props.round) {
    case 'last_32': return 32
    case 'last_16': return 16
    case 'qf': return 8
    case 'sf': return 4
    case 'final': return 2
    default: return 0
  }
})

const isEvaluatedMaxHit = computed(
  () => isEvaluated.value && props.evaluation!.matched === roundTargetCount.value && props.evaluation!.matched > 0,
)

const cardClass = computed(() => {
  if (props.expanded) return 'border-2 border-blue-400 ring-4 ring-blue-100 shadow-md'
  if (isEvaluatedMaxHit.value) return 'border border-emerald-300 shadow-sm'
  if (isEvaluated.value) return 'border border-slate-200'
  if (isDone.value) return 'border border-emerald-300 shadow-sm'
  if (isLocked.value) return 'border-2 border-dashed border-slate-300 bg-slate-50'
  return 'border border-slate-200'
})

const titleClass = computed(() => {
  if (isLocked.value && !props.expanded) return 'text-slate-500'
  return 'text-slate-800'
})

const badgeLabel = computed(() => {
  if (isEvaluated.value) {
    return `${props.evaluation!.matched} / ${roundTargetCount.value}`
  }
  return `${props.completion.done} / ${props.completion.total}`
})

const badgeClass = computed(() => {
  if (isEvaluated.value) {
    if (props.evaluation!.matched === roundTargetCount.value) return 'bg-emerald-50 text-emerald-700'
    if (props.evaluation!.matched === 0) return 'bg-slate-100 text-slate-500'
    return 'bg-amber-50 text-amber-700'
  }
  if (isDone.value) return 'bg-emerald-50 text-emerald-700'
  if (props.expanded) return 'bg-blue-50 text-blue-600'
  if (isLocked.value) return 'bg-slate-100 text-slate-400'
  return 'bg-slate-100 text-slate-600'
})

const pointsPillLabel = computed(() => {
  if (!props.evaluation) return ''
  return props.evaluation.points > 0 ? `+${props.evaluation.points} p` : '0 p'
})

const pointsPillClass = computed(() => {
  if (!props.evaluation) return ''
  if (props.evaluation.matched === roundTargetCount.value && props.evaluation.matched > 0) {
    return 'bg-emerald-500 text-white'
  }
  if (props.evaluation.matched > 0) return 'bg-amber-500 text-white'
  return 'bg-slate-200 text-slate-500'
})
</script>
