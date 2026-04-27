<template>
  <div class="relative" ref="containerRef">
    <div class="flex items-center border rounded overflow-hidden">
      <input
        ref="inputRef"
        type="text"
        :value="displayText"
        class="w-full px-2 py-1.5 text-sm outline-none"
        :placeholder="selectedPlayer ? '' : 'Keresés játékosra...'"
        @focus="onFocus"
        @input="onInput"
      />
      <button
        v-if="modelValue"
        type="button"
        class="px-2 text-gray-400 hover:text-gray-600"
        @click="clear"
      >
        &times;
      </button>
    </div>
    <ul
      v-if="dropdownOpen && filteredPlayers.length > 0"
      class="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto bg-white border rounded shadow-lg"
    >
      <li
        v-for="p in filteredPlayers"
        :key="p.id"
        class="px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50"
        @mousedown.prevent="selectPlayer(p)"
      >
        {{ p.name }}<span v-if="p.teamShortCode" class="text-gray-400 ml-1">({{ p.teamShortCode }})</span>
      </li>
    </ul>
    <div
      v-if="dropdownOpen && searchText.length > 0 && filteredPlayers.length === 0"
      class="absolute z-30 mt-1 w-full bg-white border rounded shadow-lg px-3 py-2 text-sm text-gray-400"
    >
      Nincs ilyen játékos
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type { Player } from '../../types/index.js'

const props = defineProps<{ modelValue: string | null }>()
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
  if (loaded.value) return
  try {
    const token = await getAccessToken()
    playersList.value = await api.players.list(token)
    loaded.value = true
  } catch { /* ignore */ }
}

onMounted(loadPlayers)

const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const selectedPlayer = computed((): Player | undefined =>
  props.modelValue ? playersList.value.find(p => p.id === props.modelValue) : undefined,
)

const displayText = computed((): string => {
  if (dropdownOpen.value) return searchText.value
  return selectedPlayer.value?.name ?? ''
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
