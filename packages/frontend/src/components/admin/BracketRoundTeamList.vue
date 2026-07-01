<template>
  <div data-testid="bracket-round-team-list" class="space-y-4">
    <section
      v-for="round in ROUND_ORDER"
      :key="round"
      :data-testid="`round-section-${round}`"
      :data-locked="String(isLocked(round))"
      class="border rounded-lg p-3 bg-white"
      :class="isLocked(round) ? 'opacity-60' : ''"
    >
      <header class="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-800">{{ roundLabel(round) }}</h3>
          <span class="text-[11px] text-gray-500">
            {{ selectedCount(round) }} / {{ targetCount(round) }} kiválasztva
          </span>
        </div>
        <div v-if="isLocked(round)" class="text-[11px] text-gray-500">
          Előbb a {{ prevRoundLabel(round) }} kört kell rögzíteni.
        </div>
      </header>

      <div class="flex flex-wrap gap-1.5 mb-3">
        <button
          v-for="team in poolFor(round)"
          :key="team.id"
          type="button"
          :data-testid="`team-chip-${team.id}`"
          :data-team-id="team.id"
          :data-selected="String(isSelected(round, team.id))"
          class="text-xs px-2 py-1 rounded-full border transition-colors"
          :class="chipClass(round, team.id)"
          :disabled="isLocked(round) || isChipDisabled(round, team.id)"
          @click="toggleTeam(round, team.id)"
        >
          {{ team.name }}
        </button>
        <span
          v-if="poolFor(round).length === 0 && !isLocked(round)"
          class="text-xs text-gray-400"
        >Nincs csapat a választható listában.</span>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          :data-testid="`save-${round}`"
          class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="busy || isLocked(round) || !canSave(round)"
          @click="onSave(round)"
        >
          Mentés és kiértékelés: {{ roundLabel(round) }}
        </button>
        <span v-if="overLimit(round)" class="text-[11px] text-rose-600">
          Túl sok csapat ({{ selectedCount(round) }} > {{ targetCount(round) }}).
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import {
  ADMIN_ROUND_ORDER,
  adminRoundTargetCount,
  buildCorrectAnswer,
  emptyCorrectAnswer,
  parseBracketProgressionCorrectAnswer,
  type AdminCorrectAnswerRound,
} from '../../lib/bracketCorrectAnswer.js'
import type {
  BracketProgressionCorrectAnswer,
  Team,
} from '../../types/index.js'

type ChipTeam = { readonly id: string; readonly name: string }

const props = defineProps<{
  currentAnswerJson: string | null
  busy?: boolean
  teamNameById?: ReadonlyMap<string, string>
}>()

const emit = defineEmits<{
  save: [round: AdminCorrectAnswerRound, correctAnswer: BracketProgressionCorrectAnswer]
  error: [message: string]
}>()

const ROUND_ORDER = ADMIN_ROUND_ORDER

const PREV_ROUND: Record<AdminCorrectAnswerRound, AdminCorrectAnswerRound | null> = {
  last_32: null,
  last_16: 'last_32',
  qf: 'last_16',
  sf: 'qf',
  final: 'sf',
  champion: 'final',
  // Bronze pool is `sf \ final`, so its gate is `final` (we need to know the two finalists
  // to exclude them from the bronze chip pool).
  bronze: 'final',
}

const ROUND_LABELS: Record<AdminCorrectAnswerRound, string> = {
  last_32: '32-be jutók',
  last_16: '16-ba jutók',
  qf: 'Negyeddöntő (8)',
  sf: 'Elődöntő (4)',
  final: 'Döntő (2)',
  champion: 'Bajnok',
  bronze: 'Bronzérmes',
}

function roundLabel(r: AdminCorrectAnswerRound): string {
  return ROUND_LABELS[r]
}

function prevRoundLabel(r: AdminCorrectAnswerRound): string {
  const prev = PREV_ROUND[r]
  return prev ? ROUND_LABELS[prev] : ''
}

const localTeams = ref<Team[]>([])

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function loadTeams(): Promise<void> {
  try {
    let token = ''
    if (DEV_AUTH_BYPASS) {
      token = 'dev-bypass-token'
    } else {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token ?? ''
    }
    if (!token) return
    localTeams.value = await api.teams.list(token)
  } catch (err) {
    console.error('[BracketRoundTeamList] /api/teams fetch failed', err)
    localTeams.value = []
  }
}

onMounted(loadTeams)

const teamMap = computed<ReadonlyMap<string, string>>(() => {
  const merged = new Map<string, string>()
  if (props.teamNameById) {
    for (const [id, name] of props.teamNameById) merged.set(id, name)
  }
  for (const t of localTeams.value) {
    if (!merged.has(t.id)) merged.set(t.id, t.name)
  }
  return merged
})

// The "current correct answer" we render: prefer the participants-shape from props,
// otherwise start blank. Selections (per-round, before save) seed from this.
const savedCorrect = computed<BracketProgressionCorrectAnswer>(() => {
  const parsed = props.currentAnswerJson
    ? parseBracketProgressionCorrectAnswer(props.currentAnswerJson)
    : null
  return parsed ?? emptyCorrectAnswer()
})

const selections = reactive<Record<AdminCorrectAnswerRound, Set<string>>>({
  last_32: new Set(),
  last_16: new Set(),
  qf: new Set(),
  sf: new Set(),
  final: new Set(),
  champion: new Set(),
  bronze: new Set(),
})

function seedSelectionsFromSaved(): void {
  const c = savedCorrect.value
  selections.last_32 = new Set(c.participants.last_32)
  selections.last_16 = new Set(c.participants.last_16)
  selections.qf = new Set(c.participants.qf)
  selections.sf = new Set(c.participants.sf)
  selections.final = new Set(c.participants.final)
  selections.champion = c.champion ? new Set([c.champion]) : new Set()
  selections.bronze = c.bronzeWinner ? new Set([c.bronzeWinner]) : new Set()
}

watch(() => props.currentAnswerJson, seedSelectionsFromSaved, { immediate: true })

function targetCount(round: AdminCorrectAnswerRound): number {
  return adminRoundTargetCount(round)
}

function poolFor(round: AdminCorrectAnswerRound): readonly ChipTeam[] {
  const c = savedCorrect.value
  let ids: readonly string[]
  if (round === 'last_32') {
    ids = localTeams.value.map(t => t.id)
  } else if (round === 'last_16') {
    ids = c.participants.last_32
  } else if (round === 'qf') {
    ids = c.participants.last_16
  } else if (round === 'sf') {
    ids = c.participants.qf
  } else if (round === 'final') {
    ids = c.participants.sf
  } else if (round === 'champion') {
    ids = c.participants.final
  } else {
    // bronze: SF participants minus the two finalists
    const finalSet = new Set(c.participants.final)
    ids = c.participants.sf.filter(id => !finalSet.has(id))
  }
  const list: ChipTeam[] = []
  for (const id of ids) {
    const name = teamMap.value.get(id)
    list.push({ id, name: name ?? (id.length > 8 ? `${id.slice(0, 8)}…` : id) })
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  return list
}

function isLocked(round: AdminCorrectAnswerRound): boolean {
  if (round === 'last_32') return localTeams.value.length === 0
  const prev = PREV_ROUND[round]
  if (!prev) return false
  return poolFor(round).length === 0
}

function isSelected(round: AdminCorrectAnswerRound, teamId: string): boolean {
  return selections[round].has(teamId)
}

function selectedCount(round: AdminCorrectAnswerRound): number {
  return selections[round].size
}

function overLimit(round: AdminCorrectAnswerRound): boolean {
  return selections[round].size > targetCount(round)
}

function isChipDisabled(round: AdminCorrectAnswerRound, teamId: string): boolean {
  if (selections[round].has(teamId)) return false
  return selections[round].size >= targetCount(round)
}

function chipClass(round: AdminCorrectAnswerRound, teamId: string): string {
  if (selections[round].has(teamId)) {
    return 'bg-emerald-500 text-white border-emerald-500'
  }
  if (isChipDisabled(round, teamId)) {
    return 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
  }
  return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
}

function toggleTeam(round: AdminCorrectAnswerRound, teamId: string): void {
  if (isLocked(round)) return
  const set = selections[round]
  if (set.has(teamId)) {
    set.delete(teamId)
  } else {
    if (set.size >= targetCount(round)) return
    set.add(teamId)
  }
}

function canSave(round: AdminCorrectAnswerRound): boolean {
  const count = selections[round].size
  return count === 0 || count === targetCount(round)
}

function onSave(round: AdminCorrectAnswerRound): void {
  const picks = [...selections[round]]
  try {
    const next = buildCorrectAnswer(round, picks, savedCorrect.value)
    emit('save', round, next)
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Hiba a kör mentésekor.')
  }
}
</script>
