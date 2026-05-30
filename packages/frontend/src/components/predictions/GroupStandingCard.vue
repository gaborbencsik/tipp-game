<template>
  <div
    class="rounded-lg overflow-hidden transition-all"
    :class="cardClass"
    :data-testid="`group-standing-card-${groupCode}`"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-3 text-left bg-white"
      @click="$emit('toggle')"
    >
      <span class="flex items-center gap-2 min-w-0">
        <span v-if="isDone" class="text-emerald-500" aria-hidden="true">✓</span>
        <span class="font-semibold text-slate-800 text-sm shrink-0">{{ $t('groupStandings.groupTitle', { code: groupCode }) }}</span>
        <span
          v-if="isDone && !expanded"
          class="flex items-center gap-1 text-xs text-slate-500 min-w-0 truncate"
          :data-testid="`group-standing-summary-${groupCode}`"
        >
          <template v-for="(item, idx) in summaryItems" :key="idx">
            <span v-if="idx > 0" class="text-slate-300" aria-hidden="true">·</span>
            <span class="inline-flex items-center gap-1">
              <img
                v-if="item.flagUrl"
                :src="item.flagUrl"
                :alt="item.name"
                class="w-4 h-3 object-cover rounded-sm flex-shrink-0"
              />
              <span>{{ item.code }}</span>
            </span>
          </template>
        </span>
      </span>
      <span class="flex items-center gap-2 shrink-0">
        <span
          v-if="isDone"
          class="text-xs font-medium text-emerald-600"
          :data-testid="`group-standing-status-${groupCode}-done`"
        >{{ $t('groupStandings.done') }}</span>
        <span
          v-else
          class="text-xs font-medium px-2 py-0.5 rounded-full"
          :class="expanded ? 'text-blue-600 bg-blue-50' : 'text-slate-500 bg-slate-100'"
          :data-testid="`group-standing-status-${groupCode}-progress`"
        >{{ filledCount }} / {{ teamsPerGroup }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 transition-transform"
          :class="[expanded ? 'rotate-180' : '', expanded ? 'text-blue-500' : 'text-slate-400']"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>

    <div v-if="expanded" class="px-3 pb-3 pt-2 space-y-2 border-t border-slate-100 bg-white">
      <PositionTeamDropdown
        v-for="pos in positions"
        :key="pos"
        :position="pos"
        :group-code="groupCode"
        :group-teams="groupTeams"
        :current-assignments="assignments"
        :group-done="isDone"
        :model-value="assignments[pos - 1] ?? null"
        @update:model-value="v => onPositionChange(pos, v)"
      />
      <button
        v-if="filledCount > 0"
        type="button"
        class="text-xs text-slate-500 hover:text-slate-700 mt-1"
        :data-testid="`group-standing-clear-${groupCode}`"
        @click="$emit('clear')"
      >
        ↺ {{ $t('groupStandings.clearGroup') }}
      </button>
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
const isDone = computed(() => filledCount.value === props.teamsPerGroup)

const teamMap = computed(() => new Map(props.groupTeams.map(t => [t.id, t])))

const summaryItems = computed<{ code: string; flagUrl: string | null; name: string }[]>(() =>
  props.assignments.map(id => {
    const t = id ? teamMap.value.get(id) : undefined
    return {
      code: t?.shortCode ?? '?',
      flagUrl: t?.flagUrl ?? null,
      name: t?.name ?? '',
    }
  }),
)

const cardClass = computed(() => {
  if (props.expanded) return 'border-2 border-blue-400 ring-4 ring-blue-100 shadow-md'
  if (isDone.value) return 'border border-emerald-300 shadow-sm'
  return 'border border-slate-200 shadow-sm'
})

function onPositionChange(pos: 1 | 2 | 3 | 4, teamId: string | null): void {
  emit('update', pos, teamId)
}
</script>
