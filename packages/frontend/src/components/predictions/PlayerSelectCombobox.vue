<template>
  <div v-if="freeTextMode">
    <input
      type="text"
      :value="modelValue ?? ''"
      maxlength="200"
      :disabled="disabled"
      class="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-300 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
      :placeholder="$t('playerSelect.freeTextPlaceholder')"
      @input="onFreeTextInput"
    />
  </div>
  <div v-else class="relative" ref="containerRef">
    <div
      data-trigger
      :class="[
        'flex items-center border border-slate-300 rounded-md bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-300',
        size === 'compact' ? 'h-8' : 'h-10',
      ]"
    >
      <img
        v-if="selectedPlayer?.teamFlagUrl"
        :src="selectedPlayer.teamFlagUrl"
        :alt="selectedPlayer.teamName ?? ''"
        class="w-6 h-4 object-cover rounded-sm shrink-0 ml-2.5"
      />
      <input
        type="text"
        :value="displayText"
        :disabled="disabled"
        class="w-full px-2.5 py-1.5 text-sm bg-white text-slate-800 placeholder:text-slate-400 outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
        :placeholder="selectedPlayer ? '' : $t('playerSelect.placeholder')"
        @focus="onFocus"
        @input="onInput"
      />
      <button
        v-if="modelValue"
        type="button"
        class="px-2 text-slate-400 hover:text-slate-600"
        @click="clear"
      >
        &times;
      </button>
    </div>
    <ul
      v-if="dropdownOpen && (filteredPlayers.length > 0 || (allowExplicitClear && modelValue))"
      role="group"
      class="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1"
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
            :class="['px-2.5 py-2 text-sm text-slate-800 cursor-pointer hover:bg-blue-50 flex items-center gap-2', positionTone(p.position)]"
            @mousedown.prevent="selectPlayer(p)"
          >
            <img
              v-if="p.teamFlagUrl"
              :src="p.teamFlagUrl"
              :alt="p.teamName ?? ''"
              class="w-6 h-4 object-cover rounded-sm flex-shrink-0"
            />
            <span v-else class="w-6 h-4 flex-shrink-0" aria-hidden="true"></span>
            <span class="flex-1 truncate">{{ p.name }}</span>
            <span
              v-if="showPlayerMeta && (p.position || p.shirtNumber !== null && p.shirtNumber !== undefined)"
              class="text-xs font-semibold text-slate-400 flex-shrink-0"
            >
              {{ playerMetaLabel(p) }}
            </span>
            <span
              v-else-if="p.teamShortCode"
              class="text-xs font-semibold text-slate-400 flex-shrink-0"
            >{{ p.teamShortCode }}</span>
          </li>
        </template>
      </template>
      <template v-else>
        <li
          v-for="p in filteredPlayers"
          :key="p.id"
          :class="['px-2.5 py-2 text-sm text-slate-800 cursor-pointer hover:bg-blue-50 flex items-center gap-2', positionTone(p.position)]"
          @mousedown.prevent="selectPlayer(p)"
        >
          <img
            v-if="p.teamFlagUrl"
            :src="p.teamFlagUrl"
            :alt="p.teamName ?? ''"
            class="w-6 h-4 object-cover rounded-sm flex-shrink-0"
          />
          <span v-else class="w-6 h-4 flex-shrink-0" aria-hidden="true"></span>
          <span class="flex-1 truncate">{{ p.name }}</span>
          <span
            v-if="showPlayerMeta && (p.position || p.shirtNumber !== null && p.shirtNumber !== undefined)"
            class="text-xs font-semibold text-slate-400 flex-shrink-0"
          >
            {{ playerMetaLabel(p) }}
          </span>
          <span
            v-else-if="p.teamShortCode"
            class="text-xs font-semibold text-slate-400 flex-shrink-0"
          >{{ p.teamShortCode }}</span>
        </li>
      </template>
      <li
        v-if="allowExplicitClear && modelValue"
        data-clear-row
        class="px-2.5 py-2 text-sm text-slate-500 cursor-pointer hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
        @mousedown.prevent="clear"
      >
        <span class="w-6 h-4 flex-shrink-0 text-center" aria-hidden="true">⊘</span>
        <span class="flex-1">{{ $t('playerSelect.clear') }}</span>
      </li>
    </ul>
    <div
      v-if="dropdownOpen && searchText.length > 0 && filteredPlayers.length === 0"
      class="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg px-2.5 py-2 text-sm text-slate-400"
    >
      {{ $t('playerSelect.noResults') }}
    </div>
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
    modelValue: string | null
    leagueId?: string | null
    answerLabel?: string | null
    restrictToTeams?: ReadonlyArray<RestrictTeam>
    allowExplicitClear?: boolean
    showPlayerMeta?: boolean
    size?: 'compact' | 'comfortable'
    disabled?: boolean
  }>(),
  {
    leagueId: null,
    answerLabel: null,
    restrictToTeams: undefined,
    allowExplicitClear: false,
    showPlayerMeta: false,
    size: 'comfortable',
    disabled: false,
  },
)
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const playersList = ref<Player[]>([])
const loaded = ref(false)
const dropdownOpen = ref(false)
const searchText = ref('')
const containerRef = ref<HTMLElement | null>(null)

async function loadPlayers(): Promise<void> {
  loaded.value = false
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
  } finally {
    loaded.value = true
  }
}

watch(
  () => [props.leagueId, props.restrictToTeams?.map(t => t.id).join(',')],
  loadPlayers,
  { immediate: true },
)

const freeTextMode = computed((): boolean =>
  loaded.value &&
  playersList.value.length === 0 &&
  !props.answerLabel &&
  !(props.restrictToTeams && props.restrictToTeams.length > 0),
)

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const selectedPlayer = computed((): Player | undefined =>
  props.modelValue ? playersList.value.find(p => p.id === props.modelValue) : undefined,
)

const displayText = computed((): string => {
  if (dropdownOpen.value) return searchText.value
  return selectedPlayer.value?.name ?? props.answerLabel ?? ''
})

const filteredPlayers = computed((): Player[] => {
  const cap = props.restrictToTeams && props.restrictToTeams.length > 0 ? Infinity : 50
  if (!searchText.value) return cap === Infinity ? playersList.value : playersList.value.slice(0, cap)
  const q = normalize(searchText.value)
  const filtered = playersList.value.filter(p =>
    normalize(p.name).includes(q) || (p.teamName && normalize(p.teamName).includes(q)),
  )
  return cap === Infinity ? filtered : filtered.slice(0, cap)
})

function filteredByTeam(teamId: string): Player[] {
  return filteredPlayers.value.filter(p => p.teamId === teamId)
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

function onFocus(): void {
  if (props.disabled) return
  dropdownOpen.value = true
  searchText.value = ''
}

function onInput(e: Event): void {
  if (props.disabled) return
  searchText.value = (e.target as HTMLInputElement).value
  dropdownOpen.value = true
}

function onFreeTextInput(e: Event): void {
  if (props.disabled) return
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value.length > 0 ? value : null)
}

function selectPlayer(p: Player): void {
  if (props.disabled) return
  emit('update:modelValue', p.id)
  dropdownOpen.value = false
  searchText.value = ''
}

function clear(): void {
  if (props.disabled) return
  emit('update:modelValue', null)
  searchText.value = ''
  dropdownOpen.value = false
}

function onClickOutside(e: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))

function displayName(id: string | null): string {
  if (!id) return ''
  return playersList.value.find(p => p.id === id)?.name ?? id
}

defineExpose({ displayName, playersList })
</script>
