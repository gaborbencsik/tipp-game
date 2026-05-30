<template>
  <div
    class="bg-white border border-gray-200 rounded-xl overflow-hidden"
    :data-testid="`group-standing-card-${groupCode}`"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      :class="filledCount === teamsPerGroup ? 'bg-green-50' : 'bg-white'"
      @click="$emit('toggle')"
    >
      <span class="font-semibold text-gray-800 text-sm">{{ $t('groupStandings.groupTitle', { code: groupCode }) }}</span>
      <span class="flex items-center gap-2">
        <span
          v-if="filledCount === teamsPerGroup"
          class="text-xs font-semibold text-green-700 px-2 py-0.5 rounded-full bg-green-100"
          :data-testid="`group-standing-status-${groupCode}-done`"
        >
          ✓ {{ $t('groupStandings.done') }}
        </span>
        <span
          v-else
          class="text-xs font-semibold text-gray-600 px-2 py-0.5 rounded-full bg-gray-100"
          :data-testid="`group-standing-status-${groupCode}-progress`"
        >
          {{ filledCount }} / {{ teamsPerGroup }}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 text-gray-500 transition-transform"
          :class="expanded ? 'rotate-180' : ''"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>

    <div v-if="expanded" class="px-3 pb-3 pt-2 space-y-2 border-t border-gray-100">
      <PositionTeamDropdown
        v-for="pos in positions"
        :key="pos"
        :position="pos"
        :group-code="groupCode"
        :group-teams="groupTeams"
        :current-assignments="assignments"
        :model-value="assignments[pos - 1] ?? null"
        @update:model-value="v => onPositionChange(pos, v)"
      />
      <button
        v-if="filledCount > 0"
        type="button"
        class="text-xs text-gray-500 hover:text-red-600 underline"
        :data-testid="`group-standing-clear-${groupCode}`"
        @click="$emit('clear')"
      >
        ↺ {{ $t('groupStandings.clearGroup') }}
      </button>
    </div>

    <div v-else-if="filledCount > 0" class="px-3 pb-2 pt-1 text-xs text-gray-600 flex flex-wrap gap-1.5">
      <span
        v-for="(teamId, idx) in assignments"
        :key="`${groupCode}-${idx}`"
        class="inline-flex items-center gap-1 bg-gray-50 rounded px-1.5 py-0.5"
      >
        <template v-if="teamId">
          <span class="font-semibold">{{ teamMap.get(teamId)?.shortCode ?? '—' }}</span>
          <span class="text-gray-400">{{ idx + 1 }}.</span>
        </template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PositionTeamDropdown from './PositionTeamDropdown.vue'
import type { Team } from '../../types/index.js'

const props = defineProps<{
  groupCode: string
  groupTeams: readonly Team[]
  assignments: readonly (string | null)[]
  teamsPerGroup: number
  expanded: boolean
}>()

const emit = defineEmits<{
  'toggle': []
  'clear': []
  'update': [position: 1 | 2 | 3 | 4, teamId: string | null]
}>()

const positions = computed<(1 | 2 | 3 | 4)[]>(() => {
  return Array.from({ length: props.teamsPerGroup }, (_, i) => (i + 1) as 1 | 2 | 3 | 4)
})

const filledCount = computed(() => props.assignments.filter(t => t !== null).length)

const teamMap = computed(() => new Map(props.groupTeams.map(t => [t.id, t])))

function onPositionChange(pos: 1 | 2 | 3 | 4, teamId: string | null): void {
  emit('update', pos, teamId)
}
</script>
