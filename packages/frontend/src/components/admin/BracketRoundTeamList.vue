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
          Előbb a(z) {{ prevRoundLabel(round) }} kört kell rögzíteni.
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
        >Még nincs csapat ebben a körben.</span>
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
import { computed, reactive, watch, onMounted, ref } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import { buildCorrectAnswer, type AdminCorrectAnswerRound } from '../../lib/bracketCorrectAnswer.js'
import type {
  BracketProgressionCorrectAnswer,
  BracketProgressionOptions,
  Team,
} from '../../types/index.js'

// Light row for the chip pool — we only need an id + display label here.
type ChipTeam = { readonly id: string; readonly name: string }

const props = defineProps<{
  options: BracketProgressionOptions
  currentCorrectAnswer: BracketProgressionCorrectAnswer | null
  allTeams?: readonly Team[]
  busy?: boolean
  // Optional UUID → human-readable name map from the parent (teams + players cache).
  // The component still self-loads /teams as a safety net so chips never fall back
  // to raw UUIDs if the parent cache is empty or late.
  teamNameById?: ReadonlyMap<string, string>
}>()

const emit = defineEmits<{
  save: [round: AdminCorrectAnswerRound, answer: BracketProgressionCorrectAnswer]
  error: [message: string]
}>()

const ROUND_ORDER: readonly AdminCorrectAnswerRound[] = [
  'last_32', 'last_16', 'qf', 'sf', 'final', 'champion', 'bronze',
]

const PREV_ROUND: Record<AdminCorrectAnswerRound, AdminCorrectAnswerRound | null> = {
  last_32: null,
  last_16: 'last_32',
  qf: 'last_16',
  sf: 'qf',
  final: 'sf',
  champion: 'final',
  bronze: 'sf',
}

const ROUND_LABELS: Record<AdminCorrectAnswerRound, string> = {
  last_32: '32-be jutók (32 csapat)',
  last_16: '16-ba jutók (16 csapat)',
  qf: 'Negyeddöntő (8 csapat)',
  sf: 'Elődöntő (4 csapat)',
  final: 'Döntősök (2 csapat)',
  champion: 'Bajnok (1 csapat)',
  bronze: 'Bronz győztes (1 csapat)',
}

function roundLabel(r: AdminCorrectAnswerRound): string {
  return ROUND_LABELS[r]
}

function prevRoundLabel(r: AdminCorrectAnswerRound): string {
  const prev = PREV_ROUND[r]
  return prev ? ROUND_LABELS[prev] : ''
}

const TARGET_COUNT: Record<AdminCorrectAnswerRound, number> = {
  last_32: 32,
  last_16: 16,
  qf: 8,
  sf: 4,
  final: 2,
  champion: 1,
  bronze: 1,
}

function targetCount(round: AdminCorrectAnswerRound): number {
  return TARGET_COUNT[round]
}

// ── Team-name cache (self-loaded /teams + parent-provided cache) ──────────────────────────
const localTeams = ref<Team[]>([])
const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function loadTeams(): Promise<void> {
  // Skip self-load when the parent already supplied a full team list (test convenience).
  if (props.allTeams && props.allTeams.length > 0) {
    localTeams.value = [...props.allTeams]
    return
  }
  try {
    let token = ''
    if (DEV_AUTH_BYPASS) {
      token = 'dev-bypass-token'
    } else {
      const { data } = await supabase.auth.getSession()
      token = data.session?.access_token ?? ''
    }
    if (!token) return
    const result = await api.teams.list(token)
    localTeams.value = result
  } catch {
    localTeams.value = []
  }
}

onMounted(loadTeams)

const teamMap = computed<ReadonlyMap<string, string>>(() => {
  const merged = new Map<string, string>()
  if (props.teamNameById) for (const [id, name] of props.teamNameById) merged.set(id, name)
  for (const t of localTeams.value) if (!merged.has(t.id)) merged.set(t.id, t.name)
  return merged
})

const allTeamsList = computed<readonly Team[]>(() => {
  if (props.allTeams && props.allTeams.length > 0) return props.allTeams
  return localTeams.value
})

// ── Reactive selections (admin's current pick, before save) ───────────────────────────────
const selections = reactive<Record<AdminCorrectAnswerRound, Set<string>>>({
  last_32: new Set(), last_16: new Set(), qf: new Set(), sf: new Set(),
  final: new Set(), champion: new Set(), bronze: new Set(),
})

function seedSelectionsFromCurrent(): void {
  for (const r of ROUND_ORDER) selections[r] = new Set()
  const cur = props.currentCorrectAnswer
  if (!cur) return
  selections.last_32 = new Set(cur.participants.last_32)
  selections.last_16 = new Set(cur.participants.last_16)
  selections.qf = new Set(cur.participants.qf)
  selections.sf = new Set(cur.participants.sf)
  selections.final = new Set(cur.participants.final)
  if (cur.champion) selections.champion = new Set([cur.champion])
  if (cur.bronzeWinner) selections.bronze = new Set([cur.bronzeWinner])
}

watch(() => props.currentCorrectAnswer, seedSelectionsFromCurrent, { immediate: true })

// ── Pool computation (cascade from prior round; bronze auto-derives sf \ final) ───────────
function poolFor(round: AdminCorrectAnswerRound): readonly ChipTeam[] {
  const cur = props.currentCorrectAnswer
  let poolIds: readonly string[] = []

  if (round === 'last_32') {
    poolIds = allTeamsList.value.map(t => t.id)
  } else if (round === 'last_16') {
    poolIds = cur?.participants.last_32 ?? []
  } else if (round === 'qf') {
    poolIds = cur?.participants.last_16 ?? []
  } else if (round === 'sf') {
    poolIds = cur?.participants.qf ?? []
  } else if (round === 'final') {
    poolIds = cur?.participants.sf ?? []
  } else if (round === 'champion') {
    poolIds = cur?.participants.final ?? []
  } else if (round === 'bronze') {
    const sfIds = cur?.participants.sf ?? []
    const finalSet = new Set(cur?.participants.final ?? [])
    poolIds = sfIds.filter(id => !finalSet.has(id))
  }

  const list: ChipTeam[] = []
  for (const id of poolIds) {
    const name = teamMap.value.get(id) ?? (id.length > 8 ? `${id.slice(0, 8)}…` : id)
    list.push({ id, name })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  return list
}

function isLocked(round: AdminCorrectAnswerRound): boolean {
  if (round === 'last_32') return false
  const prev = PREV_ROUND[round]
  if (!prev) return false
  // Locked when the upstream round hasn't been saved with the right number of teams.
  const cur = props.currentCorrectAnswer
  if (!cur) return true
  if (prev === 'last_32') return cur.participants.last_32.length !== TARGET_COUNT.last_32
  if (prev === 'last_16') return cur.participants.last_16.length !== TARGET_COUNT.last_16
  if (prev === 'qf') return cur.participants.qf.length !== TARGET_COUNT.qf
  if (prev === 'sf') return cur.participants.sf.length !== TARGET_COUNT.sf
  if (prev === 'final') return cur.participants.final.length !== TARGET_COUNT.final
  return false
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
  // Single-pick rounds (champion / bronze): a chip click always replaces the prior pick
  // — never disable.
  if (targetCount(round) === 1) return false
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
  // For single-pick rounds (champion / bronze) a click replaces the prior pick.
  if (targetCount(round) === 1) {
    if (set.has(teamId)) {
      set.clear()
    } else {
      set.clear()
      set.add(teamId)
    }
    return
  }
  if (set.has(teamId)) {
    set.delete(teamId)
  } else {
    if (set.size >= targetCount(round)) return
    set.add(teamId)
  }
}

function canSave(round: AdminCorrectAnswerRound): boolean {
  // Allow saving an empty selection (= reset that round). Otherwise require exact match.
  const count = selections[round].size
  return count === 0 || count === targetCount(round)
}

function onSave(round: AdminCorrectAnswerRound): void {
  const selected = [...selections[round]]
  try {
    const next = buildCorrectAnswer(round, selected, props.currentCorrectAnswer)
    emit('save', round, next)
  } catch (err) {
    emit('error', err instanceof Error ? err.message : 'Hiba a kör mentésekor.')
  }
}
</script>
