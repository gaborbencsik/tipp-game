<template>
  <div data-testid="bracket-round-team-list" class="space-y-4">
    <div
      v-if="!correctGroupStandings"
      class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2"
    >
      Hiányzik a Csoport végeredmény helyes válasza — előbb azt rögzítsd, hogy a Last 32
      párosítások levezethetők legyenek.
    </div>

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
          Előbb a {{ prevRoundLabel(round) }} kört kell kiértékelni.
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
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import {
  deriveBracket,
  parseBracketProgressionAnswer,
} from '../../lib/bracketDerive.js'
import {
  mapRoundWinnersToBracketAnswer,
  BracketTeamNotInRoundError,
} from '../../lib/bracketRoundMapping.js'
import type {
  AllGroupsStandingAnswer,
  BracketProgressionAnswer,
  BracketProgressionOptions,
  BracketRound,
  Team,
} from '../../types/index.js'

// Light row for the chip pool — we only need an id + display label here.
type ChipTeam = { readonly id: string; readonly name: string }

const props = defineProps<{
  options: BracketProgressionOptions
  correctGroupStandings: AllGroupsStandingAnswer | null
  currentAnswerJson: string | null
  busy?: boolean
  // Optional UUID → human-readable name map from the parent (teams + players cache).
  // We still self-load /teams as a safety net so chips never fall back to UUIDs even
  // if the parent cache is empty or arrived late.
  teamNameById?: ReadonlyMap<string, string>
}>()

const emit = defineEmits<{
  save: [round: BracketRound, answer: BracketProgressionAnswer]
  error: [message: string]
}>()

const ROUND_ORDER: readonly BracketRound[] = ['last_32', 'last_16', 'qf', 'sf', 'final', 'bronze']

const PREV_ROUND: Record<BracketRound, BracketRound | null> = {
  last_32: null,
  last_16: 'last_32',
  qf: 'last_16',
  sf: 'qf',
  final: 'sf',
  // Bronze depends on the SF losers, so its gating mirrors `final` (both need SF winners).
  bronze: 'sf',
}

const ROUND_LABELS: Record<BracketRound, string> = {
  last_32: '32-be jutók',
  last_16: '16-ba jutók',
  qf: 'Negyeddöntő',
  sf: 'Elődöntő',
  final: 'Döntő (bajnok)',
  bronze: 'Bronzmeccs',
}

function roundLabel(r: BracketRound): string {
  return ROUND_LABELS[r]
}

function prevRoundLabel(r: BracketRound): string {
  const prev = PREV_ROUND[r]
  return prev ? ROUND_LABELS[prev] : ''
}

const localTeams = ref<Team[]>([])

// Mirror the admin store auth pattern — local dev runs with VITE_DEV_AUTH_BYPASS=true
// and the backend accepts the literal 'dev-bypass-token'. Without this the chip names
// silently fall back to UUIDs whenever the Supabase session is empty in dev.
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
    if (!token) {
      console.warn('[BracketRoundTeamList] no access token — chip names will fall back to UUIDs')
      return
    }
    const result = await api.teams.list(token)
    localTeams.value = result
    console.info(`[BracketRoundTeamList] loaded ${result.length} teams from /api/teams`)
  } catch (err) {
    console.error('[BracketRoundTeamList] /api/teams fetch failed', err)
    localTeams.value = []
  }
}

onMounted(loadTeams)

// Combine the parent-provided name cache with our own /teams fetch. The local fetch
// is a safety net — if the parent cache arrives late or is empty, we still resolve
// names so the admin never sees raw UUIDs.
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

const savedAnswer = computed<BracketProgressionAnswer>(() => {
  const parsed = props.currentAnswerJson
    ? parseBracketProgressionAnswer(props.currentAnswerJson)
    : null
  return parsed ?? { winners: {} }
})

const derivedBracket = computed(() =>
  deriveBracket(
    props.options.bracketTemplate.matches,
    props.correctGroupStandings,
    savedAnswer.value.winners,
  ),
)

// Per-round selection (admin's current pick set, before save). Seeded from saved winners
// so re-opening the page reflects what's already evaluated.
const selections = reactive<Record<BracketRound, Set<string>>>({
  last_32: new Set(),
  last_16: new Set(),
  qf: new Set(),
  sf: new Set(),
  final: new Set(),
  bronze: new Set(),
})

function seedSelectionsFromSavedAnswer(): void {
  const template = props.options.bracketTemplate.matches
  for (const r of ROUND_ORDER) selections[r] = new Set()
  for (const [matchId, teamId] of Object.entries(savedAnswer.value.winners)) {
    const m = template.find(x => x.id === matchId)
    if (!m) continue
    selections[m.round].add(teamId)
  }
}

watch(() => props.currentAnswerJson, seedSelectionsFromSavedAnswer, { immediate: true })

function targetCount(round: BracketRound): number {
  const template = props.options.bracketTemplate.matches
  return template.filter(m => m.round === round).length
}

function poolFor(round: BracketRound): readonly ChipTeam[] {
  // last_32 pool = participants (slotA ∪ slotB) of last_32 matches.
  // Later rounds: participants of that round's derived matches (winners of the prior round).
  // bronze pool = the SF losers (the team in each sf-derived match that didn't win).
  const matches = derivedBracket.value.matches.filter(m => m.round === round)
  const ids = new Set<string>()
  if (round === 'bronze') {
    const sfMatches = derivedBracket.value.matches.filter(m => m.round === 'sf')
    for (const m of sfMatches) {
      if (m.teamA && m.teamA !== m.winnerId) ids.add(m.teamA)
      if (m.teamB && m.teamB !== m.winnerId) ids.add(m.teamB)
    }
    // Tiny-template fallback: derive losers from the upstream-loser slot directly
    // (when there's no SF round in the template).
    if (ids.size === 0) {
      for (const m of matches) {
        if (m.teamA) ids.add(m.teamA)
        if (m.teamB) ids.add(m.teamB)
      }
    }
  } else {
    for (const m of matches) {
      if (m.teamA) ids.add(m.teamA)
      if (m.teamB) ids.add(m.teamB)
    }
  }
  const list: ChipTeam[] = []
  for (const id of ids) {
    const name = teamMap.value.get(id)
    list.push({ id, name: name ?? (id.length > 8 ? `${id.slice(0, 8)}…` : id) })
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  return list
}

function isLocked(round: BracketRound): boolean {
  if (round === 'last_32') return !props.correctGroupStandings
  return poolFor(round).length === 0
}

function isSelected(round: BracketRound, teamId: string): boolean {
  return selections[round].has(teamId)
}

function selectedCount(round: BracketRound): number {
  return selections[round].size
}

function overLimit(round: BracketRound): boolean {
  return selections[round].size > targetCount(round)
}

function isChipDisabled(round: BracketRound, teamId: string): boolean {
  // Block adding new picks once we hit the target — already-selected chips stay
  // clickable so the admin can deselect them.
  if (selections[round].has(teamId)) return false
  return selections[round].size >= targetCount(round)
}

function chipClass(round: BracketRound, teamId: string): string {
  if (selections[round].has(teamId)) {
    return 'bg-emerald-500 text-white border-emerald-500'
  }
  if (isChipDisabled(round, teamId)) {
    return 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
  }
  return 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
}

function toggleTeam(round: BracketRound, teamId: string): void {
  if (isLocked(round)) return
  const set = selections[round]
  if (set.has(teamId)) {
    set.delete(teamId)
  } else {
    if (set.size >= targetCount(round)) return
    set.add(teamId)
  }
}

function canSave(round: BracketRound): boolean {
  // Allow saving an empty selection (= reset that round). Otherwise require an
  // exact match: too few or too many is suspicious and would mis-score.
  const count = selections[round].size
  return count === 0 || count === targetCount(round)
}

function onSave(round: BracketRound): void {
  const selected = [...selections[round]]
  try {
    const next = mapRoundWinnersToBracketAnswer(
      round,
      selected,
      savedAnswer.value,
      props.options.bracketTemplate.matches,
      props.correctGroupStandings,
    )
    emit('save', round, next)
  } catch (err) {
    if (err instanceof BracketTeamNotInRoundError) {
      emit('error', `A "${err.teamId}" csapat nem szerepel a ${roundLabel(round)} körben.`)
    } else {
      emit('error', err instanceof Error ? err.message : 'Hiba a kör mentésekor.')
    }
  }
}
</script>
