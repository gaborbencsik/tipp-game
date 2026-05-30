<template>
  <div data-testid="best-3rd-picker">
    <header class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-gray-800">{{ $t('groupStandings.best3rdTitle') }}</h3>
      <span
        class="text-xs font-semibold px-2 py-0.5 rounded-full"
        :class="selected.length === maxPicks ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
        data-testid="best-3rd-counter"
      >
        {{ selected.length }} / {{ maxPicks }}
      </span>
    </header>

    <div
      v-if="!unlocked"
      class="text-xs text-gray-500 italic px-2 py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200"
      data-testid="best-3rd-locked"
    >
      🔒 {{ $t('groupStandings.best3rdLocked') }}
    </div>

    <div v-else>
      <p class="text-xs text-gray-500 mb-2">
        {{ $t('groupStandings.best3rdInstruction', { n: maxPicks }) }}
      </p>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="teamId in availableTeams"
          :key="teamId"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer select-none transition-colors"
          :class="[
            isSelected(teamId)
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50',
            !isSelected(teamId) && selected.length >= maxPicks ? 'opacity-50 cursor-not-allowed' : '',
          ]"
          :data-testid="`best-3rd-chip-${teamId}`"
          @click="toggle(teamId)"
        >
          <span>{{ teamMap.get(teamId)?.shortCode ?? '—' }}</span>
          <span v-if="isSelected(teamId)" aria-hidden="true">✓</span>
        </li>
      </ul>
      <p v-if="availableTeams.length === 0" class="text-xs text-gray-500 italic mt-2">
        {{ $t('groupStandings.best3rdEmpty') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Team } from '../../types/index.js'

const props = defineProps<{
  unlocked: boolean
  availableTeams: readonly string[]
  selected: readonly string[]
  maxPicks: number
  teamMap: ReadonlyMap<string, Team>
}>()

const emit = defineEmits<{
  'toggle': [teamId: string]
  'overflow': []
}>()

function isSelected(teamId: string): boolean {
  return props.selected.includes(teamId)
}

function toggle(teamId: string): void {
  if (!isSelected(teamId) && props.selected.length >= props.maxPicks) {
    emit('overflow')
    return
  }
  emit('toggle', teamId)
}
</script>
