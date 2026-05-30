<template>
  <div
    class="rounded-lg border bg-white p-2"
    :class="match.isLocked ? 'border-dashed border-gray-200 opacity-70' : 'border-gray-200'"
    :data-testid="`bracket-match-${match.id}`"
  >
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="flex-1 min-w-0 text-left rounded-lg overflow-hidden"
        :disabled="match.isLocked || !match.teamA"
        :class="!match.isLocked && match.teamA ? 'cursor-pointer' : 'cursor-not-allowed'"
        @click="onPick(match.teamA)"
      >
        <TeamSlotChip
          :slot-code="match.slotA"
          :team="match.teamA ? (teamMap.get(match.teamA) ?? null) : null"
          :is-picked="!!match.teamA && match.winnerId === match.teamA"
          :is-locked="match.isLocked"
        />
      </button>
      <span class="text-[10px] font-bold text-gray-400 px-1 shrink-0">{{ $t('bracketProgression.vs') }}</span>
      <button
        type="button"
        class="flex-1 min-w-0 text-right rounded-lg overflow-hidden"
        :disabled="match.isLocked || !match.teamB"
        :class="!match.isLocked && match.teamB ? 'cursor-pointer' : 'cursor-not-allowed'"
        @click="onPick(match.teamB)"
      >
        <TeamSlotChip
          :slot-code="match.slotB"
          :team="match.teamB ? (teamMap.get(match.teamB) ?? null) : null"
          :is-picked="!!match.teamB && match.winnerId === match.teamB"
          :is-locked="match.isLocked"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import TeamSlotChip from './TeamSlotChip.vue'
import type { Team } from '../../types/index.js'
import type { DerivedMatch } from '../../lib/bracketDerive.js'

const props = defineProps<{
  match: DerivedMatch
  teamMap: ReadonlyMap<string, Team>
}>()

const emit = defineEmits<{
  'pick': [matchId: string, teamId: string]
}>()

function onPick(teamId: string | null): void {
  if (props.match.isLocked || !teamId) return
  emit('pick', props.match.id, teamId)
}
</script>
