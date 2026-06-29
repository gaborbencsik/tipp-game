<template>
  <div data-testid="upset-special-picker">
    <div
      v-if="isScored && scoreSummary"
      class="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3"
      data-testid="upset-score-summary"
    >
      <p class="text-xs text-emerald-900 leading-snug font-medium">
        {{ $t('upsetSpecial.scoredSummary', scoreSummary) }}
      </p>
      <p class="text-[11px] text-emerald-800/80 mt-1 leading-snug">
        {{ $t('upsetSpecial.actualEliminatedCount', { n: eliminatedSet.size }) }}
      </p>
    </div>
    <p
      v-else
      class="text-xs text-gray-500 mb-2"
    >
      {{ $t('upsetSpecial.instruction', { min: options.minPicks, max: options.maxPicks }) }}
    </p>
    <ul class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
      <li
        v-for="choice in sortedChoices"
        :key="choice.teamId"
        class="relative flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 transition-colors select-none"
        :class="[
          chipClass(choice.teamId),
          isScored ? '' : 'cursor-pointer',
        ]"
        :data-testid="`upset-choice-${choice.teamId}`"
        @click="toggle(choice.teamId)"
      >
        <span
          v-if="isScored && isCorrectPick(choice.teamId)"
          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow"
          aria-hidden="true"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
            <path fill-rule="evenodd" d="M16.704 5.296a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.29-7.29a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </span>
        <span
          v-else-if="isScored && isWrongPick(choice.teamId)"
          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow text-xs font-bold"
          aria-hidden="true"
        >✗</span>
        <span
          v-else-if="!isScored && isSelected(choice.teamId)"
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
        <span class="text-sm font-bold tracking-wide" :class="chipTextClass(choice.teamId)">
          {{ teamMap.get(choice.teamId)?.shortCode ?? teamMap.get(choice.teamId)?.name ?? '—' }}
        </span>
        <span
          v-if="!isScored"
          class="text-[10px] font-semibold leading-none"
          :class="isSelected(choice.teamId) ? 'text-blue-100' : 'text-gray-500'"
        >
          {{ choice.points }}p
        </span>
        <span
          v-else
          class="text-[10px] font-bold leading-none px-1.5 py-0.5 rounded"
          :class="pointsPillClass(choice.teamId)"
          :data-testid="`upset-points-${choice.teamId}`"
        >{{ pointsPillLabel(choice.teamId, choice.points) }}</span>
        <span
          v-if="isScored && isUnpickedActual(choice.teamId)"
          class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wide font-semibold text-emerald-700 bg-white px-1 rounded"
          :data-testid="`upset-actual-${choice.teamId}`"
        >{{ $t('upsetSpecial.actualBadge') }}</span>
      </li>
    </ul>
    <p
      v-if="!isScored"
      class="text-xs mt-2"
      :class="canSubmit ? 'text-gray-500' : 'text-amber-600'"
    >
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
  correctAnswer?: string | null
  readOnly?: boolean
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

function parseList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch {
    return []
  }
}

const currentPicks = ref<string[]>(parseList(props.answer))

watch(() => props.answer, value => {
  currentPicks.value = parseList(value)
})

const eliminatedSet = computed<Set<string>>(() => new Set(parseList(props.correctAnswer ?? null)))

// UX-041: scored read-only mode if both readOnly and correctAnswer present.
const isScored = computed(() => Boolean(props.readOnly) && props.correctAnswer != null)

const canSubmit = computed(() =>
  currentPicks.value.length >= props.options.minPicks &&
  currentPicks.value.length <= props.options.maxPicks,
)

function isSelected(teamId: string): boolean {
  return currentPicks.value.includes(teamId)
}

function isCorrectPick(teamId: string): boolean {
  return isSelected(teamId) && eliminatedSet.value.has(teamId)
}

function isWrongPick(teamId: string): boolean {
  return isSelected(teamId) && !eliminatedSet.value.has(teamId)
}

function isUnpickedActual(teamId: string): boolean {
  return !isSelected(teamId) && eliminatedSet.value.has(teamId)
}

function chipClass(teamId: string): string {
  if (isScored.value) {
    if (isCorrectPick(teamId)) return 'bg-emerald-50 border-2 border-emerald-500 text-emerald-900 shadow-sm'
    if (isWrongPick(teamId)) return 'bg-rose-50 border-2 border-rose-400 text-rose-900 shadow-sm'
    if (isUnpickedActual(teamId)) return 'bg-white border-2 border-dashed border-emerald-300 text-slate-700'
    return 'bg-white border border-gray-200 text-gray-500 opacity-60'
  }
  const picked = isSelected(teamId)
  if (picked) return 'bg-blue-600 text-white shadow-sm'
  if (currentPicks.value.length >= props.options.maxPicks) {
    return 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 opacity-50 cursor-not-allowed'
  }
  return 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
}

function chipTextClass(teamId: string): string {
  if (isScored.value) {
    if (isCorrectPick(teamId)) return 'text-emerald-900'
    if (isWrongPick(teamId)) return 'text-rose-900'
    return 'text-slate-700'
  }
  return ''
}

function pointsPillClass(teamId: string): string {
  if (isCorrectPick(teamId)) return 'bg-emerald-100 text-emerald-800'
  if (isWrongPick(teamId)) return 'bg-slate-100 text-slate-500'
  return 'bg-slate-50 text-slate-500'
}

function pointsPillLabel(teamId: string, choicePoints: number): string {
  if (isCorrectPick(teamId)) return `+${choicePoints}`
  if (isWrongPick(teamId)) return '0'
  return `${choicePoints}p`
}

const scoreSummary = computed(() => {
  if (!isScored.value) return null
  let correct = 0
  let points = 0
  const choicePointsMap = new Map(props.options.choices.map(c => [c.teamId, c.points]))
  for (const teamId of currentPicks.value) {
    if (!eliminatedSet.value.has(teamId)) continue
    correct += 1
    points += choicePointsMap.get(teamId) ?? 0
  }
  return { correct, points }
})

function toggle(teamId: string): void {
  if (props.readOnly) return
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
