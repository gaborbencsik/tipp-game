<template>
  <section
    class="rounded-xl bg-white"
    :class="cardClass"
    data-testid="bracket-finals-bronze"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between px-3 py-3 text-left"
      @click="$emit('toggle')"
    >
      <span class="font-semibold text-sm flex items-center gap-1.5" :class="titleClass">
        <span v-if="isDone" class="text-emerald-500" aria-hidden="true">✓</span>
        <span>{{ $t('bracketProgression.finalsAndBronzeTitle') }}</span>
      </span>
      <span
        class="text-xs font-semibold px-2 py-0.5 rounded-full"
        :class="badgeClass"
      >
        {{ doneCount }} / 2
      </span>
    </button>
    <div v-if="expanded" class="px-3 pb-3 border-t border-slate-100 pt-3 space-y-4">
      <BracketMatchCard
        v-if="bronzeMatch"
        :match="bronzeMatch"
        :team-map="teamMap"
        @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
      />
      <BracketMatchCard
        v-if="finalMatch"
        :match="finalMatch"
        :team-map="teamMap"
        @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
      />
      <div
        v-if="summary"
        class="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-xs text-emerald-900"
      >
        ✅ <span class="font-semibold">{{ $t('bracketProgression.summaryTitle') }}</span><br>
        {{ summary }}
      </div>
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
  expanded: boolean
  teamMap: ReadonlyMap<string, Team>
}>()

defineEmits<{
  'toggle': []
  'pick': [matchId: string, teamId: string]
}>()

const { t } = useI18n()

const finalMatch = computed(() => props.matches.find(m => m.id === 'final'))
const bronzeMatch = computed(() => props.matches.find(m => m.id === 'bronze'))

const doneCount = computed(() => {
  let n = 0
  if (finalMatch.value?.winnerId) n += 1
  if (bronzeMatch.value?.winnerId) n += 1
  return n
})

const isDone = computed(() => doneCount.value === 2)

const cardClass = computed(() => {
  if (props.expanded) return 'border-2 border-blue-400 ring-4 ring-blue-100 shadow-md'
  if (isDone.value) return 'border border-emerald-300 shadow-sm'
  return 'border border-slate-200'
})

const titleClass = computed(() => 'text-slate-800')

const badgeClass = computed(() => {
  if (isDone.value) return 'bg-emerald-50 text-emerald-700'
  if (props.expanded) return 'bg-blue-50 text-blue-600'
  return 'bg-slate-100 text-slate-600'
})

const summary = computed(() => {
  const f = finalMatch.value
  const b = bronzeMatch.value
  if (!f?.winnerId) return ''
  const champion = props.teamMap.get(f.winnerId)?.shortCode ?? '?'
  const silverId = f.teamA === f.winnerId ? f.teamB : f.teamA
  const silver = silverId ? (props.teamMap.get(silverId)?.shortCode ?? '?') : '?'
  const parts = [
    t('bracketProgression.summary.champion', { team: champion }),
    t('bracketProgression.summary.silver', { team: silver }),
  ]
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
