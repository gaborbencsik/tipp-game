<template>
  <div data-testid="group-standings-picker">
    <p class="text-xs text-gray-500 mb-3">{{ $t('groupStandings.intro') }}</p>

    <div class="space-y-2.5">
      <GroupStandingCard
        v-for="code in options.groups"
        :key="code"
        :group-code="code"
        :group-teams="groupTeamsByCode.get(code) ?? []"
        :assignments="state.groups[code] ?? emptyGroup"
        :teams-per-group="options.teamsPerGroup"
        :expanded="expandedGroup === code"
        @toggle="toggleExpanded(code)"
        @clear="clearGroup(code)"
        @update="(pos, teamId) => updatePosition(code, pos, teamId)"
      />
    </div>

    <section class="mt-4">
      <Best3rdPicker
        :unlocked="is12of12"
        :available-teams="best3rdsAvailable"
        :selected="state.best3rds"
        :max-picks="options.best3rdPicks"
        :team-map="allTeamsMap"
        @toggle="toggleBest3rd"
      />
    </section>

    <div
      class="mt-3 sticky bottom-2 left-0 right-0 z-10 px-3 py-2 rounded-lg border bg-white shadow-sm flex items-center justify-between text-xs"
      data-testid="group-standings-sticky"
    >
      <span class="font-semibold text-gray-800">
        {{ $t('groupStandings.progress', { done: completion.totalDone, total: completion.totalSteps }) }}
      </span>
      <span :class="saveStatusClass" data-testid="group-standings-save-status">
        {{ saveStatusLabel }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GroupStandingCard from './GroupStandingCard.vue'
import Best3rdPicker from './Best3rdPicker.vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import type {
  AllGroupsStandingAnswer,
  AllGroupsStandingCompletion,
  AllGroupsStandingOptions,
  Team,
} from '../../types/index.js'

const props = defineProps<{
  options: AllGroupsStandingOptions
  answer: string | null
}>()

const emit = defineEmits<{
  'submit': [value: string]
  'overflow': []
}>()

const { t } = useI18n()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const allTeams = ref<Team[]>([])

async function loadTeams(): Promise<void> {
  try {
    const token = await getAccessToken()
    allTeams.value = await api.teams.list(token)
  } catch {
    allTeams.value = []
  }
}

loadTeams()

const groupTeamsByCode = computed(() => {
  const map = new Map<string, Team[]>()
  for (const code of props.options.groups) map.set(code, [])
  for (const team of allTeams.value) {
    if (team.group && map.has(team.group)) {
      map.get(team.group)!.push(team)
    }
  }
  for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  return map
})

const allTeamsMap = computed(() => new Map(allTeams.value.map(t => [t.id, t])))

const emptyGroup = computed<readonly (string | null)[]>(() =>
  Array.from({ length: props.options.teamsPerGroup }, () => null),
)

interface PickerState {
  groups: Record<string, (string | null)[]>
  best3rds: string[]
}

function makeInitialState(): PickerState {
  const groups: Record<string, (string | null)[]> = {}
  for (const code of props.options.groups) {
    groups[code] = Array.from({ length: props.options.teamsPerGroup }, () => null)
  }
  return { groups, best3rds: [] }
}

function parseAnswer(raw: string | null): PickerState {
  const initial = makeInitialState()
  if (!raw) return initial
  try {
    const parsed = JSON.parse(raw) as AllGroupsStandingAnswer
    if (parsed && typeof parsed === 'object' && parsed.groups && Array.isArray(parsed.best3rds)) {
      for (const [code, positions] of Object.entries(parsed.groups)) {
        if (initial.groups[code] && Array.isArray(positions)) {
          for (let i = 0; i < initial.groups[code]!.length; i++) {
            const slot = positions[i]
            initial.groups[code]![i] = typeof slot === 'string' ? slot : null
          }
        }
      }
      initial.best3rds = parsed.best3rds.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    // ignore parse errors — keep initial empty state
  }
  return initial
}

const state = reactive<PickerState>(parseAnswer(props.answer))

watch(() => props.answer, value => {
  const fresh = parseAnswer(value)
  for (const code of props.options.groups) {
    state.groups[code] = fresh.groups[code] ?? Array.from({ length: props.options.teamsPerGroup }, () => null)
  }
  state.best3rds = fresh.best3rds
})

const completion = computed<AllGroupsStandingCompletion>(() => {
  let groupsDone = 0
  for (const code of props.options.groups) {
    const positions = state.groups[code] ?? []
    if (positions.length === props.options.teamsPerGroup && positions.every(p => p !== null)) {
      groupsDone += 1
    }
  }
  return {
    groupsDone,
    best3rdsDone: state.best3rds.length,
    totalDone: groupsDone + state.best3rds.length,
    totalSteps: props.options.groups.length + props.options.best3rdPicks,
  }
})

const is12of12 = computed(() => completion.value.groupsDone === props.options.groups.length)

const best3rdsAvailable = computed<string[]>(() => {
  if (!is12of12.value) return []
  const list: string[] = []
  for (const code of props.options.groups) {
    const positions = state.groups[code] ?? []
    const third = positions[2]
    if (third) list.push(third)
  }
  return list
})

watch(best3rdsAvailable, newList => {
  const set = new Set(newList)
  const filtered = state.best3rds.filter(t => set.has(t))
  if (filtered.length !== state.best3rds.length) {
    state.best3rds = filtered
    scheduleSave()
  }
})

const expandedGroup = ref<string | null>(null)
watch(
  () => props.options.groups,
  groups => {
    if (expandedGroup.value === null) {
      const firstUnfilled = groups.find(code => {
        const positions = state.groups[code] ?? []
        return positions.some(p => p === null)
      })
      expandedGroup.value = firstUnfilled ?? groups[0] ?? null
    }
  },
  { immediate: true },
)

function toggleExpanded(code: string): void {
  expandedGroup.value = expandedGroup.value === code ? null : code
}

function updatePosition(code: string, position: 1 | 2 | 3 | 4, teamId: string | null): void {
  const arr = state.groups[code]
  if (!arr) return
  arr[position - 1] = teamId
  scheduleSave()
}

function clearGroup(code: string): void {
  const arr = state.groups[code]
  if (!arr) return
  for (let i = 0; i < arr.length; i++) arr[i] = null
  scheduleSave()
}

function toggleBest3rd(teamId: string): void {
  const idx = state.best3rds.indexOf(teamId)
  if (idx >= 0) {
    state.best3rds.splice(idx, 1)
  } else if (state.best3rds.length < props.options.best3rdPicks) {
    state.best3rds.push(teamId)
  }
  scheduleSave()
}

const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    flushSave()
  }, 400)
}

function flushSave(): void {
  saveStatus.value = 'saving'
  const payload: AllGroupsStandingAnswer = {
    groups: { ...state.groups },
    best3rds: [...state.best3rds],
  }
  emit('submit', JSON.stringify(payload))
}

function setSaveStatus(value: 'idle' | 'saving' | 'saved' | 'error'): void {
  saveStatus.value = value
}

defineExpose({ flushSave, setSaveStatus })

const saveStatusLabel = computed(() => {
  if (saveStatus.value === 'saving') return t('groupStandings.saving')
  if (saveStatus.value === 'saved') return `✓ ${t('groupStandings.saved')}`
  if (saveStatus.value === 'error') return `⚠ ${t('groupStandings.errorSaving')}`
  return ''
})

const saveStatusClass = computed(() => {
  if (saveStatus.value === 'saving') return 'text-gray-500'
  if (saveStatus.value === 'saved') return 'text-green-600'
  if (saveStatus.value === 'error') return 'text-red-600'
  return 'text-gray-400'
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>
