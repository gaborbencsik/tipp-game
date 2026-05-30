<template>
  <section
    class="rounded-xl border border-gray-200 bg-white"
    :data-testid="`bracket-round-${round}`"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between px-3 py-2 text-left"
      @click="$emit('toggle')"
    >
      <span class="font-semibold text-sm text-gray-800">{{ $t(`bracketProgression.round.${round}`) }}</span>
      <span
        class="text-xs font-semibold px-2 py-0.5 rounded-full"
        :class="completion.done === completion.total && completion.total > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
      >
        {{ completion.done }} / {{ completion.total }}
      </span>
    </button>
    <div v-if="expanded" class="px-2 pb-2 space-y-1.5">
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
import BracketMatchCard from './BracketMatchCard.vue'
import type { Team, BracketRound } from '../../types/index.js'
import type { DerivedMatch } from '../../lib/bracketDerive.js'

defineProps<{
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
</script>
