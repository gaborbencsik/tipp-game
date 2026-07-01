<template>
  <div :data-testid="`bracket-match-${match.id}`">
    <div class="flex items-center gap-1.5 mb-1 ml-0.5">
      <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500">{{ matchLabel }}</span>
      <span class="text-[9px] font-medium px-1.5 py-px rounded-full bg-indigo-50 text-indigo-700">{{ matchPill }}</span>
    </div>
    <div class="grid items-stretch gap-1.5" style="grid-template-columns: 1fr auto 1fr;">
      <button
        type="button"
        class="min-w-0 text-left rounded-lg"
        :disabled="isReadOnly || match.isLocked || !match.teamA"
        :class="!isReadOnly && !match.isLocked && match.teamA ? 'cursor-pointer' : 'cursor-not-allowed'"
        @click="onPick(match.teamA)"
      >
        <TeamSlotChip
          :slot-code="slotLabelFor(match.slotA)"
          :team="match.teamA ? (teamMap.get(match.teamA) ?? null) : null"
          :is-picked="!!match.teamA && match.winnerId === match.teamA"
          :is-locked="match.isLocked || !match.teamA"
          :is-correct="chipIsCorrect(match.teamA)"
          :is-wrong="chipIsWrong(match.teamA)"
        />
      </button>
      <span class="flex items-center justify-center text-[11px] font-bold text-slate-300 px-1">
        {{ $t('bracketProgression.vs') }}
      </span>
      <button
        type="button"
        class="min-w-0 text-left rounded-lg"
        :disabled="isReadOnly || match.isLocked || !match.teamB"
        :class="!isReadOnly && !match.isLocked && match.teamB ? 'cursor-pointer' : 'cursor-not-allowed'"
        @click="onPick(match.teamB)"
      >
        <TeamSlotChip
          :slot-code="slotLabelFor(match.slotB)"
          :team="match.teamB ? (teamMap.get(match.teamB) ?? null) : null"
          :is-picked="!!match.teamB && match.winnerId === match.teamB"
          :is-locked="match.isLocked || !match.teamB"
          :is-correct="chipIsCorrect(match.teamB)"
          :is-wrong="chipIsWrong(match.teamB)"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TeamSlotChip from './TeamSlotChip.vue'
import type { Team } from '../../types/index.js'
import type { DerivedMatch } from '../../lib/bracketDerive.js'

const props = defineProps<{
  match: DerivedMatch
  teamMap: ReadonlyMap<string, Team>
  /**
   * UX-045: when the tip has been evaluated for this round, pass the set of teams
   * that advanced (from `correctAnswer.participants[round]`). Every chip whose team is
   * in the set turns green; every chip whose team is NOT in the set turns red. If null,
   * chips render in their pre-eval colors (blue-picked / neutral).
   */
  advancingTeamIds?: ReadonlySet<string> | null
  isReadOnly?: boolean
}>()

const emit = defineEmits<{
  'pick': [matchId: string, teamId: string]
}>()

const { t } = useI18n()

const matchLabel = computed(() => {
  const id = props.match.id
  const numMatch = id.match(/_m(\d+)$/i)
  const n = numMatch ? Number(numMatch[1]) : 0
  switch (props.match.round) {
    case 'last_32': return t('bracketProgression.matchLabel', { n })
    case 'last_16': return t('bracketProgression.matchLabelL16', { n })
    case 'qf': return t('bracketProgression.matchLabelQf', { n })
    case 'sf': return t('bracketProgression.matchLabelSf', { n })
    case 'final': return t('bracketProgression.finalLabel')
    case 'bronze': return t('bracketProgression.bronzeLabel')
    default: return id
  }
})

const matchPill = computed(() => {
  if (props.match.round === 'final') return t('bracketProgression.finalPill')
  if (props.match.round === 'bronze') return t('bracketProgression.bronzePill')
  return `${slotLabelFor(props.match.slotA)} ↔ ${slotLabelFor(props.match.slotB)}`
})

function slotLabelFor(slot: string): string {
  const ref = slot.match(/^<([a-z0-9_]+?)(_loser)?>$/i)
  if (ref) {
    const mNum = ref[1]!.match(/_m(\d+)$/i)
    const tag = mNum ? `M${mNum[1]}` : ref[1]!.toUpperCase()
    return ref[2]
      ? t('bracketProgression.slotLoser', { tag })
      : t('bracketProgression.slotWinner', { tag })
  }
  return slot.replace(/_/g, ' ')
}

function chipIsCorrect(teamId: string | null): boolean {
  if (!teamId || !props.advancingTeamIds) return false
  return props.advancingTeamIds.has(teamId)
}

function chipIsWrong(teamId: string | null): boolean {
  if (!teamId || !props.advancingTeamIds) return false
  return !props.advancingTeamIds.has(teamId)
}

function onPick(teamId: string | null): void {
  if (props.isReadOnly || props.match.isLocked || !teamId) return
  emit('pick', props.match.id, teamId)
}
</script>
