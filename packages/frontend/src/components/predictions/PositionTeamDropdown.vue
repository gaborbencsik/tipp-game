<template>
  <div
    class="flex items-center gap-2 p-2 rounded-md bg-slate-50"
    :data-testid="`position-row-${groupCode}-${position}`"
  >
    <span
      class="inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-bold flex-shrink-0"
      :class="badgeClass"
      :data-testid="`pos-badge-${groupCode}-${position}`"
    >{{ position }}.</span>
    <div ref="rootRef" class="relative flex-1">
      <button
        type="button"
        class="w-full flex items-center gap-2 border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white text-left focus:ring-2 focus:ring-blue-300 outline-none"
        :data-testid="`position-dropdown-${groupCode}-${position}`"
        :aria-expanded="open"
        aria-haspopup="listbox"
        @click="toggle"
      >
        <template v-if="selectedTeam">
          <img
            v-if="selectedTeam.flagUrl"
            :src="selectedTeam.flagUrl"
            :alt="selectedTeam.name"
            class="w-6 h-4 object-cover rounded-sm flex-shrink-0"
          />
          <span class="flex-1 truncate text-slate-800">{{ selectedTeam.name }}</span>
        </template>
        <span v-else class="flex-1 truncate text-slate-400">{{ $t('groupStandings.placeholder') }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 transition-transform flex-shrink-0"
          :class="[open ? 'rotate-180 text-blue-500' : 'text-slate-400']"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </button>

      <ul
        v-if="open"
        class="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1"
        role="listbox"
        :data-testid="`position-dropdown-list-${groupCode}-${position}`"
      >
        <li
          v-if="modelValue !== null"
          class="px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
          role="option"
          :data-testid="`position-dropdown-option-${groupCode}-${position}-clear`"
          @click="select(null)"
        >
          <span class="w-6 h-4 flex-shrink-0" aria-hidden="true"></span>
          <span class="flex-1 italic">{{ $t('groupStandings.placeholder') }}</span>
        </li>
        <li
          v-for="team in availableTeams"
          :key="team.id"
          class="px-2.5 py-2 text-sm text-slate-800 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
          :class="team.id === modelValue ? 'bg-blue-50' : ''"
          role="option"
          :aria-selected="team.id === modelValue"
          :data-testid="`position-dropdown-option-${groupCode}-${position}-${team.id}`"
          @click="select(team.id)"
        >
          <img
            v-if="team.flagUrl"
            :src="team.flagUrl"
            :alt="team.name"
            class="w-6 h-4 object-cover rounded-sm flex-shrink-0"
          />
          <span v-else class="w-6 h-4 flex-shrink-0" aria-hidden="true"></span>
          <span class="flex-1 truncate">{{ team.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Team } from '../../types/index.js'

const props = defineProps<{
  position: 1 | 2 | 3 | 4
  groupCode: string
  groupTeams: readonly Team[]
  currentAssignments: readonly (string | null)[]
  modelValue: string | null
  groupDone?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const teamById = computed<Map<string, Team>>(() => new Map(props.groupTeams.map(t => [t.id, t])))

const selectedTeam = computed<Team | null>(() => {
  if (!props.modelValue) return null
  return teamById.value.get(props.modelValue) ?? null
})

const availableTeams = computed<Team[]>(() => {
  const usedElsewhere = new Set<string>()
  props.currentAssignments.forEach((teamId, idx) => {
    if (teamId && idx + 1 !== props.position) usedElsewhere.add(teamId)
  })
  return props.groupTeams.filter(t => !usedElsewhere.has(t.id))
})

const badgeClass = computed(() => {
  if (props.groupDone) return 'bg-emerald-50 text-emerald-700'
  if (props.modelValue) return 'bg-indigo-50 text-indigo-600'
  return 'bg-slate-100 text-slate-400'
})

function toggle(): void {
  open.value = !open.value
}

function select(teamId: string | null): void {
  emit('update:modelValue', teamId)
  open.value = false
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return
  const target = event.target as Node | null
  if (target && rootRef.value && !rootRef.value.contains(target)) {
    open.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>
