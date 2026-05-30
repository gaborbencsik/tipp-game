<template>
  <div class="flex items-center gap-2" :data-testid="`position-row-${groupCode}-${position}`">
    <span class="w-6 text-xs font-semibold text-gray-500">{{ position }}.</span>
    <select
      class="flex-1 border rounded px-2 py-1.5 text-sm bg-white"
      :value="modelValue ?? ''"
      :data-testid="`position-dropdown-${groupCode}-${position}`"
      @change="onChange(($event.target as HTMLSelectElement).value)"
    >
      <option value="">— {{ $t('groupStandings.placeholder') }} —</option>
      <option
        v-for="team in availableTeams"
        :key="team.id"
        :value="team.id"
      >
        {{ team.shortCode }} — {{ team.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Team } from '../../types/index.js'

const props = defineProps<{
  position: 1 | 2 | 3 | 4
  groupCode: string
  groupTeams: readonly Team[]
  currentAssignments: readonly (string | null)[]
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const availableTeams = computed<Team[]>(() => {
  const usedElsewhere = new Set<string>()
  props.currentAssignments.forEach((teamId, idx) => {
    if (teamId && idx + 1 !== props.position) usedElsewhere.add(teamId)
  })
  return props.groupTeams.filter(t => !usedElsewhere.has(t.id))
})

function onChange(value: string): void {
  emit('update:modelValue', value === '' ? null : value)
}
</script>
