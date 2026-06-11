<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="w-full flex items-center gap-2 border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white text-left focus:ring-2 focus:ring-blue-300 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
      :aria-expanded="open"
      :disabled="disabled"
      aria-haspopup="listbox"
      data-testid="team-select-dropdown"
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
      <template v-else-if="modelValue && answerLabel">
        <span class="flex-1 truncate text-slate-800">{{ answerLabel }}</span>
      </template>
      <span v-else class="flex-1 truncate text-slate-400">{{ $t('teamSelect.placeholder') }}</span>
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
      data-testid="team-select-dropdown-list"
    >
      <li
        v-if="modelValue && answerLabel && !teamsList.find(t => t.id === modelValue)"
        class="px-2.5 py-2 text-sm text-slate-800 hover:bg-blue-50 cursor-pointer flex items-center gap-2 bg-blue-50"
        role="option"
        :aria-selected="true"
        :data-testid="`team-select-option-${modelValue}`"
        @click="select(modelValue)"
      >
        <span class="w-6 h-4 flex-shrink-0" aria-hidden="true"></span>
        <span class="flex-1 truncate">{{ answerLabel }}</span>
      </li>
      <li
        v-for="t in teamsList"
        :key="t.id"
        class="px-2.5 py-2 text-sm text-slate-800 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
        :class="t.id === modelValue ? 'bg-blue-50' : ''"
        role="option"
        :aria-selected="t.id === modelValue"
        :data-testid="`team-select-option-${t.id}`"
        @click="select(t.id)"
      >
        <img
          v-if="teamFlagUrl(t)"
          :src="teamFlagUrl(t) ?? ''"
          :alt="t.name"
          class="w-6 h-4 object-cover rounded-sm flex-shrink-0"
        />
        <span v-else class="w-6 h-4 flex-shrink-0" aria-hidden="true"></span>
        <span class="flex-1 truncate">{{ t.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type { Team, LeagueTeam } from '../../types/index.js'

const props = defineProps<{ modelValue: string | null; leagueId?: string | null; answerLabel?: string | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const teamsList = ref<Array<Team | LeagueTeam>>([])
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

async function loadTeams(): Promise<void> {
  try {
    const token = await getAccessToken()
    teamsList.value = props.leagueId
      ? await api.leagueTeams.forLeague(token, props.leagueId)
      : await api.teams.list(token)
  } catch { /* ignore */ }
}

watch(() => props.leagueId, loadTeams, { immediate: true })

const selectedTeam = computed<Team | LeagueTeam | undefined>(() =>
  props.modelValue ? teamsList.value.find(t => t.id === props.modelValue) : undefined,
)

function teamFlagUrl(t: Team | LeagueTeam): string | null {
  return (t as Team).flagUrl ?? null
}

function toggle(): void {
  if (props.disabled) return
  open.value = !open.value
}

function select(teamId: string): void {
  if (props.disabled) return
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

function displayName(id: string | null): string {
  if (!id) return ''
  return teamsList.value.find(t => t.id === id)?.name ?? id
}

defineExpose({ displayName, teamsList })
</script>
