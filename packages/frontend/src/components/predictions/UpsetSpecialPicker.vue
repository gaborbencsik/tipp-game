<template>
  <div data-testid="upset-special-picker">
    <p class="text-xs text-gray-500 mb-2">
      {{ $t('upsetSpecial.instruction', { min: options.minPicks, max: options.maxPicks }) }}
    </p>
    <ul class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
      <li
        v-for="choice in sortedChoices"
        :key="choice.teamId"
        class="relative flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 cursor-pointer transition-colors select-none"
        :class="[
          isSelected(choice.teamId)
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50',
          !isSelected(choice.teamId) && currentPicks.length >= options.maxPicks ? 'opacity-50 cursor-not-allowed' : '',
        ]"
        :data-testid="`upset-choice-${choice.teamId}`"
        @click="toggle(choice.teamId)"
      >
        <span
          v-if="isSelected(choice.teamId)"
          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shadow"
          aria-hidden="true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
            <path fill-rule="evenodd" d="M16.704 5.296a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.29-7.29a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </span>
        <img
          v-if="teamMap.get(choice.teamId)?.flagUrl"
          :src="teamMap.get(choice.teamId)!.flagUrl ?? ''"
          :alt="teamMap.get(choice.teamId)?.name ?? ''"
          class="w-8 h-6 object-cover rounded-sm shadow-sm"
        />
        <span class="text-sm font-bold tracking-wide">
          {{ teamMap.get(choice.teamId)?.shortCode ?? teamMap.get(choice.teamId)?.name ?? '—' }}
        </span>
        <span
          class="text-[10px] font-semibold leading-none"
          :class="isSelected(choice.teamId) ? 'text-blue-100' : 'text-gray-500'"
        >
          {{ choice.points }}p
        </span>
      </li>
    </ul>
    <p class="text-xs mt-2" :class="canSubmit ? 'text-gray-500' : 'text-amber-600'">
      {{ $t('upsetSpecial.selectedCount', { n: currentPicks.length, max: options.maxPicks }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type { MultiTeamWeightedOptions, Team } from '../../types/index.js'

const props = defineProps<{
  options: MultiTeamWeightedOptions
  answer: string | null
}>()

const emit = defineEmits<{
  'submit': [value: string]
}>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const teamMap = ref<Map<string, Team>>(new Map())

async function loadTeams(): Promise<void> {
  try {
    const token = await getAccessToken()
    const teams = await api.teams.list(token)
    teamMap.value = new Map(teams.map(t => [t.id, t]))
  } catch {
    teamMap.value = new Map()
  }
}

loadTeams()

const sortedChoices = computed(() =>
  [...props.options.choices].sort((a, b) => b.points - a.points),
)

function parseAnswer(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

const currentPicks = ref<string[]>(parseAnswer(props.answer))

watch(() => props.answer, value => {
  currentPicks.value = parseAnswer(value)
})

const canSubmit = computed(() =>
  currentPicks.value.length >= props.options.minPicks &&
  currentPicks.value.length <= props.options.maxPicks,
)

function isSelected(teamId: string): boolean {
  return currentPicks.value.includes(teamId)
}

function toggle(teamId: string): void {
  const idx = currentPicks.value.indexOf(teamId)
  if (idx >= 0) {
    currentPicks.value.splice(idx, 1)
  } else if (currentPicks.value.length < props.options.maxPicks) {
    currentPicks.value.push(teamId)
  }
  if (canSubmit.value) {
    emit('submit', JSON.stringify(currentPicks.value))
  }
}
</script>
