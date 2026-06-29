<template>
  <div
    data-testid="group-standings-picker"
    :class="readOnly ? 'pointer-events-auto' : ''"
  >
    <div
      v-if="isScored && scoreSummary"
      class="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 mb-3"
      data-testid="group-standings-score-summary"
    >
      <p class="text-xs text-emerald-900 leading-snug font-medium">
        {{ $t('groupStandings.scoreSummary', scoreSummary) }}
      </p>
      <p class="text-[11px] text-emerald-800/80 mt-1 leading-snug">
        {{ $t('groupStandings.best3rdScoringNote') }}
      </p>
    </div>

    <div
      v-else
      class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex gap-2 mb-3"
    >
      <span class="text-blue-600" aria-hidden="true">💡</span>
      <p class="text-xs text-blue-900 leading-snug">{{ $t('groupStandings.infoCard') }}</p>
    </div>

    <div class="space-y-2">
      <GroupStandingCard
        v-for="code in options.groups"
        :key="code"
        :group-code="code"
        :group-teams="groupTeamsByCode.get(code) ?? []"
        :assignments="state.groups[code] ?? emptyGroup"
        :correct-positions="correctState?.groups[code] ?? undefined"
        :read-only-scored="isScored"
        :points-awarded="isScored ? (pointsByGroup[code] ?? 0) : null"
        :teams-per-group="options.teamsPerGroup"
        :expanded="expandedGroup === code"
        @toggle="toggleExpanded(code)"
        @clear="clearGroup(code)"
        @update="(pos, teamId) => updatePosition(code, pos, teamId)"
      />
    </div>

    <section class="mt-3">
      <Best3rdPicker
        :unlocked="is12of12 || isScored"
        :available-teams="best3rdsDisplay"
        :selected="state.best3rds"
        :correct-teams="correctState?.best3rds ?? undefined"
        :read-only="isScored"
        :max-picks="options.best3rdPicks"
        :team-map="allTeamsMap"
        @toggle="toggleBest3rd"
      />
    </section>

    <div
      v-if="!props.readOnly"
      class="mt-3 sticky bottom-2 left-0 right-0 z-10 px-4 py-3 rounded-lg border border-slate-200 bg-white shadow-sm"
      data-testid="group-standings-sticky"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-slate-700">
          {{ $t('groupStandings.progress', { done: displayDone, total: displayTotal }) }}
        </span>
        <span
          class="text-xs flex items-center gap-1"
          :class="saveStatusClass"
          data-testid="group-standings-save-status"
        >{{ saveStatusLabel }}</span>
      </div>
      <div class="flex gap-1">
        <span
          v-for="(seg, idx) in segments"
          :key="idx"
          class="h-1.5 flex-1 rounded-sm"
          :class="segmentClass(seg)"
        />
      </div>
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
import { TOURNAMENT_POINTS, scoreGroupExact } from '../../lib/tournamentPoints.js'
import type {
  AllGroupsStandingAnswer,
  AllGroupsStandingCompletion,
  AllGroupsStandingOptions,
  Team,
} from '../../types/index.js'

const props = defineProps<{
  options: AllGroupsStandingOptions
  answer: string | null
  correctAnswer?: string | null
  readOnly?: boolean
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

// UX-039: parsed correct answer for the scored read-only mode.
const correctState = computed<PickerState | null>(() => {
  if (!props.correctAnswer) return null
  return parseAnswer(props.correctAnswer)
})

const isScored = computed(() => Boolean(props.readOnly) && correctState.value !== null)

// UX-040: per-group points + total summary.
const pointsByGroup = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  if (!isScored.value || !correctState.value) return out
  for (const code of props.options.groups) {
    out[code] = scoreGroupExact(state.groups[code], correctState.value.groups[code])
  }
  return out
})

const scoreSummary = computed(() => {
  if (!isScored.value) return null
  let correctGroups = 0
  let totalPoints = 0
  for (const code of props.options.groups) {
    const p = pointsByGroup.value[code] ?? 0
    if (p > 0) correctGroups += 1
    totalPoints += p
  }
  return {
    correct: correctGroups,
    total: props.options.groups.length,
    perGroup: TOURNAMENT_POINTS.perGroup,
    points: totalPoints,
  }
})

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

type Segment = 'done' | 'active' | 'empty'

const segments = computed<Segment[]>(() => {
  const segs: Segment[] = []
  for (const code of props.options.groups) {
    const positions = state.groups[code] ?? []
    const filled = positions.filter(p => p !== null).length
    if (filled === props.options.teamsPerGroup) segs.push('done')
    else if (expandedGroup.value === code && filled > 0) segs.push('active')
    else segs.push('empty')
  }
  const allBest3rdsDone = state.best3rds.length === props.options.best3rdPicks
  if (allBest3rdsDone) segs.push('done')
  else if (state.best3rds.length > 0) segs.push('active')
  else segs.push('empty')
  return segs
})

function segmentClass(seg: Segment): string {
  if (seg === 'done') return 'bg-emerald-500'
  if (seg === 'active') return 'bg-blue-400'
  return 'bg-slate-200'
}

const displayTotal = computed(() => props.options.groups.length + 1)
const displayDone = computed(() => {
  const allBest3rdsDone = state.best3rds.length === props.options.best3rdPicks
  return completion.value.groupsDone + (allBest3rdsDone ? 1 : 0)
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

// UX-039: in scored read-only mode show every user pick + actual best 3rd, even if the
// matching group is no longer 4/4 (e.g. user only filled part of the group standings).
const best3rdsDisplay = computed<string[]>(() => {
  if (!isScored.value) return best3rdsAvailable.value
  const set = new Set<string>()
  for (const t of state.best3rds) set.add(t)
  for (const t of correctState.value?.best3rds ?? []) set.add(t)
  // Also surface the picker's natural list when groups are filled, so the actual 3rd-placed
  // teams stay visible even if the user did not pick them.
  for (const code of props.options.groups) {
    const positions = state.groups[code] ?? []
    const third = positions[2]
    if (third) set.add(third)
  }
  return Array.from(set)
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
    // UX-032: read-only (post-deadline) lock — start with everything collapsed so the user
    // sees a clean overview, not the auto-opened group A.
    if (props.readOnly) return
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
  if (props.readOnly) return
  const arr = state.groups[code]
  if (!arr) return
  arr[position - 1] = teamId
  scheduleSave()
}

function clearGroup(code: string): void {
  if (props.readOnly) return
  const arr = state.groups[code]
  if (!arr) return
  for (let i = 0; i < arr.length; i++) arr[i] = null
  scheduleSave()
}

function toggleBest3rd(teamId: string): void {
  if (props.readOnly) return
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
  if (saveStatus.value === 'saving') return `↻ ${t('groupStandings.saving')}`
  if (saveStatus.value === 'saved') return `✓ ${t('groupStandings.saved')}`
  if (saveStatus.value === 'error') return `⚠ ${t('groupStandings.errorSaving')}`
  return ''
})

const saveStatusClass = computed(() => {
  if (saveStatus.value === 'saving') return 'text-blue-600 animate-pulse'
  if (saveStatus.value === 'saved') return 'text-emerald-600'
  if (saveStatus.value === 'error') return 'text-red-600'
  return 'text-slate-400'
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>
