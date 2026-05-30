<template>
  <section
    class="rounded-xl border border-gray-200 bg-white px-3 py-3"
    data-testid="bracket-finals-bronze"
  >
    <div class="space-y-2">
      <div>
        <p class="text-xs text-gray-500 mb-1">{{ $t('bracketProgression.round.bronze') }}</p>
        <BracketMatchCard
          v-if="bronzeMatch"
          :match="bronzeMatch"
          :team-map="teamMap"
          @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
        />
      </div>
      <div>
        <p class="text-xs text-gray-500 mb-1">{{ $t('bracketProgression.round.final') }}</p>
        <BracketMatchCard
          v-if="finalMatch"
          :match="finalMatch"
          :team-map="teamMap"
          @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
        />
      </div>
      <p v-if="summary" class="text-xs text-gray-700 mt-2 font-medium">{{ summary }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BracketMatchCard from './BracketMatchCard.vue'
import type { Team } from '../../types/index.js'
import type { DerivedMatch } from '../../lib/bracketDerive.js'

const props = defineProps<{
  matches: readonly DerivedMatch[]
  teamMap: ReadonlyMap<string, Team>
}>()

defineEmits<{
  'pick': [matchId: string, teamId: string]
}>()

const { t } = useI18n()

const finalMatch = computed(() => props.matches.find(m => m.id === 'final'))
const bronzeMatch = computed(() => props.matches.find(m => m.id === 'bronze'))

const summary = computed(() => {
  const f = finalMatch.value
  const b = bronzeMatch.value
  if (!f?.winnerId) return ''
  const champion = props.teamMap.get(f.winnerId)?.shortCode ?? '?'
  const silverId = f.teamA === f.winnerId ? f.teamB : f.teamA
  const silver = silverId ? (props.teamMap.get(silverId)?.shortCode ?? '?') : '?'
  const parts = [t('bracketProgression.summary.champion', { team: champion }), t('bracketProgression.summary.silver', { team: silver })]
  if (b?.winnerId) {
    const bronze = props.teamMap.get(b.winnerId)?.shortCode ?? '?'
    const fourthId = b.teamA === b.winnerId ? b.teamB : b.teamA
    const fourth = fourthId ? (props.teamMap.get(fourthId)?.shortCode ?? '?') : '?'
    parts.push(t('bracketProgression.summary.bronze', { team: bronze }))
    parts.push(t('bracketProgression.summary.fourth', { team: fourth }))
  }
  return parts.join(' · ')
})
</script>
