<template>
  <div v-if="freeTextMode">
    <input
      type="text"
      :value="modelValue ?? ''"
      maxlength="200"
      class="w-full border border-slate-300 rounded-md px-2.5 py-1.5 text-sm bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-300 outline-none"
      :placeholder="$t('playerSelect.freeTextPlaceholder')"
      @input="onFreeTextInput"
    />
  </div>
  <div v-else class="relative" ref="containerRef">
    <div class="flex items-center border border-slate-300 rounded-md bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
      <input
        ref="inputRef"
        type="text"
        :value="displayText"
        class="w-full px-2.5 py-1.5 text-sm bg-white text-slate-800 placeholder:text-slate-400 outline-none"
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
      v-if="dropdownOpen && filteredPlayers.length > 0"
      class="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1"
    >
      <li
        v-for="p in filteredPlayers"
        :key="p.id"
        class="px-2.5 py-2 text-sm text-slate-800 cursor-pointer hover:bg-blue-50 flex items-center gap-2"
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
        <span v-if="p.teamShortCode" class="text-xs font-semibold text-slate-400 flex-shrink-0">{{ p.teamShortCode }}</span>
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

const props = defineProps<{ modelValue: string | null; leagueId?: string | null; answerLabel?: string | null }>()
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
const inputRef = ref<HTMLInputElement | null>(null)

async function loadPlayers(): Promise<void> {
  loaded.value = false
  try {
    const token = await getAccessToken()
    playersList.value = props.leagueId
      ? await api.players.list(token, props.leagueId)
      : await api.players.list(token)
  } catch {
    playersList.value = []
  } finally {
    loaded.value = true
  }
}

watch(() => props.leagueId, loadPlayers, { immediate: true })

const freeTextMode = computed((): boolean =>
  loaded.value && playersList.value.length === 0 && !props.answerLabel,
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
  if (!searchText.value) return playersList.value.slice(0, 50)
  const q = normalize(searchText.value)
  return playersList.value.filter(p =>
    normalize(p.name).includes(q) || (p.teamName && normalize(p.teamName).includes(q)),
  ).slice(0, 50)
})

function onFocus(): void {
  dropdownOpen.value = true
  searchText.value = ''
}

function onInput(e: Event): void {
  searchText.value = (e.target as HTMLInputElement).value
  dropdownOpen.value = true
}

function onFreeTextInput(e: Event): void {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value.length > 0 ? value : null)
}

function selectPlayer(p: Player): void {
  emit('update:modelValue', p.id)
  dropdownOpen.value = false
  searchText.value = ''
}

function clear(): void {
  emit('update:modelValue', null)
  searchText.value = ''
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
