<template>
  <div class="relative" ref="containerRef">
    <div class="flex flex-wrap items-center gap-1.5 border border-slate-300 rounded-md bg-white px-2 py-1.5 min-h-[2.5rem] focus-within:ring-2 focus-within:ring-blue-300">
      <span
        v-for="id in modelValue"
        :key="id"
        data-chip
        class="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs"
      >
        <img
          v-if="playerById(id)?.teamFlagUrl"
          :src="playerById(id)?.teamFlagUrl ?? ''"
          :alt="playerById(id)?.teamName ?? ''"
          class="w-4 h-3 object-cover rounded-sm"
        />
        <span>{{ playerById(id)?.name ?? '?' }}</span>
        <button
          type="button"
          class="ml-0.5 text-blue-500 hover:text-blue-700"
          :data-chip-remove="id"
          @click="removePick(id)"
          :aria-label="`remove ${playerById(id)?.name ?? id}`"
        >×</button>
      </span>
      <input
        ref="inputRef"
        type="text"
        v-model="searchText"
        :placeholder="modelValue.length === 0 ? $t('playerSelect.placeholder') : ''"
        class="flex-1 min-w-[6rem] px-1 py-0.5 text-sm bg-white text-slate-800 placeholder:text-slate-400 outline-none"
        @focus="dropdownOpen = true"
      />
    </div>
    <ul
      v-if="dropdownOpen && filteredPlayers.length > 0"
      role="group"
      class="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1"
    >
      <template v-if="restrictToTeams && restrictToTeams.length > 0">
        <template v-for="team in restrictToTeams" :key="team.id">
          <li
            v-if="filteredByTeam(team.id).length > 0"
            data-team-group-header
            class="px-2.5 py-1 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center gap-2"
          >
            <img
              v-if="team.flagUrl"
              :src="team.flagUrl"
              :alt="team.name"
              class="w-5 h-3.5 object-cover rounded-sm flex-shrink-0"
            />
            <span>{{ team.name }}</span>
          </li>
          <li
            v-for="p in filteredByTeam(team.id)"
            :key="p.id"
            :class="[
              'px-2.5 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2',
              positionTone(p.position),
              isSelected(p.id) ? 'opacity-60' : '',
            ]"
            :data-selected="isSelected(p.id) ? 'true' : 'false'"
            @mousedown.prevent="togglePick(p)"
          >
            <input
              type="checkbox"
              :checked="isSelected(p.id)"
              class="pointer-events-none"
              tabindex="-1"
            />
            <span class="flex-1 truncate">{{ p.name }}</span>
            <span
              v-if="p.position || p.shirtNumber !== null && p.shirtNumber !== undefined"
              class="text-xs font-semibold text-slate-400 flex-shrink-0"
            >{{ playerMetaLabel(p) }}</span>
          </li>
        </template>
      </template>
      <template v-else>
        <li
          v-for="p in filteredPlayers"
          :key="p.id"
          :class="[
            'px-2.5 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2',
            positionTone(p.position),
            isSelected(p.id) ? 'opacity-60' : '',
          ]"
          :data-selected="isSelected(p.id) ? 'true' : 'false'"
          @mousedown.prevent="togglePick(p)"
        >
          <input type="checkbox" :checked="isSelected(p.id)" class="pointer-events-none" tabindex="-1" />
          <span class="flex-1 truncate">{{ p.name }}</span>
          <span
            v-if="p.position || p.shirtNumber !== null && p.shirtNumber !== undefined"
            class="text-xs font-semibold text-slate-400 flex-shrink-0"
          >{{ playerMetaLabel(p) }}</span>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type { Player } from '../../types/index.js'

interface RestrictTeam {
  readonly id: string
  readonly name: string
  readonly shortCode: string
  readonly flagUrl: string | null
}

const props = withDefaults(
  defineProps<{
    modelValue: ReadonlyArray<string>
    leagueId?: string | null
    restrictToTeams?: ReadonlyArray<RestrictTeam>
  }>(),
  {
    leagueId: null,
    restrictToTeams: undefined,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: ReadonlyArray<string>] }>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const playersList = ref<Player[]>([])
const dropdownOpen = ref(false)
const searchText = ref('')
const containerRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

async function loadPlayers(): Promise<void> {
  try {
    const token = await getAccessToken()
    if (props.restrictToTeams && props.restrictToTeams.length > 0) {
      const lists = await Promise.all(
        props.restrictToTeams.map(t => api.players.list(token, undefined, t.id)),
      )
      playersList.value = lists.flat()
    } else if (props.leagueId) {
      playersList.value = await api.players.list(token, props.leagueId)
    } else {
      playersList.value = await api.players.list(token)
    }
  } catch {
    playersList.value = []
  }
}

watch(
  () => [props.leagueId, props.restrictToTeams?.map(t => t.id).join(',')],
  loadPlayers,
  { immediate: true },
)

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const filteredPlayers = computed((): Player[] => {
  if (!searchText.value) return playersList.value
  const q = normalize(searchText.value)
  return playersList.value.filter(p =>
    normalize(p.name).includes(q) || (p.teamName && normalize(p.teamName).includes(q)),
  )
})

function filteredByTeam(teamId: string): Player[] {
  return filteredPlayers.value.filter(p => p.teamId === teamId)
}

function isSelected(id: string): boolean {
  return props.modelValue.includes(id)
}

function playerById(id: string): Player | undefined {
  return playersList.value.find(p => p.id === id)
}

function togglePick(p: Player): void {
  const next = isSelected(p.id)
    ? props.modelValue.filter(id => id !== p.id)
    : [...props.modelValue, p.id]
  emit('update:modelValue', next)
}

function removePick(id: string): void {
  emit('update:modelValue', props.modelValue.filter(i => i !== id))
}

function playerMetaLabel(p: Player): string {
  const parts: string[] = []
  if (p.position) parts.push(p.position)
  if (p.shirtNumber !== null && p.shirtNumber !== undefined) parts.push(`#${p.shirtNumber}`)
  return parts.join(' · ')
}

function positionTone(position: string | null | undefined): string {
  if (!position) return ''
  const p = position.toLowerCase()
  if (p.startsWith('g') || p === 'goalkeeper' || p === 'gk') return 'bg-amber-50/60'
  if (p.startsWith('d') || p === 'defender' || p === 'def') return 'bg-sky-50/60'
  if (p.startsWith('m') || p === 'midfielder' || p === 'mid') return 'bg-emerald-50/60'
  if (p.startsWith('a') || p === 'attacker' || p === 'forward' || p === 'fw') return 'bg-rose-50/60'
  return ''
}

function onClickOutside(e: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>
