<template>
  <div class="space-y-2" data-testid="bracket-scored">
    <!-- Score breakdown — one row per scored round, plus the champion line. -->
    <div
      v-for="r in view.rounds"
      :key="r.round"
      class="rounded-lg border bg-white px-3 py-2"
      :class="r.hitCount > 0 ? 'border-emerald-200' : 'border-slate-200'"
      :data-testid="`bracket-scored-round-${r.round}`"
      :data-evaluated="r.evaluated ? 'true' : 'false'"
    >
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <p class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <span>{{ $t(`bracketProgression.round.${r.round}`) }}</span>
          <span class="text-slate-400 font-normal">({{ r.pointsPerTeam }}p / csapat)</span>
          <span
            v-if="!r.evaluated"
            class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500"
            data-testid="round-pending-badge"
          >{{ $t('bracketProgression.scored.pending') }}</span>
        </p>
        <span
          class="text-xs font-bold px-2 py-0.5 rounded-full"
          :class="r.pointsEarned > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
          :data-testid="`bracket-scored-round-${r.round}-points`"
        >
          {{ r.hitCount }} / {{ r.correctTotal }} · +{{ r.pointsEarned }}p
        </span>
      </div>
      <div v-if="r.userTeams.length === 0" class="text-xs text-slate-400 italic">
        {{ $t('bracketProgression.scored.noTip') }}
      </div>
      <div v-else class="flex flex-wrap gap-1.5">
        <span
          v-for="cell in r.userTeams"
          :key="cell.teamId"
          class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
          :class="chipClass(cell.status)"
          :data-testid="`team-${cell.status}`"
        >
          <span v-if="chipIcon(cell.status)" aria-hidden="true">{{ chipIcon(cell.status) }}</span>
          {{ teamName(cell.teamId) }}
        </span>
      </div>
      <div
        v-if="r.evaluated && r.missedTeams.length > 0"
        class="mt-1.5 pt-1.5 border-t border-slate-100 text-xs text-slate-500"
      >
        <span class="font-medium">{{ $t('bracketProgression.scored.missed') }}:</span>
        <span class="ml-1">
          <span
            v-for="(teamId, idx) in r.missedTeams"
            :key="teamId"
            class="text-slate-500"
          >{{ teamName(teamId) }}<span v-if="idx < r.missedTeams.length - 1">, </span></span>
        </span>
      </div>
    </div>

    <!-- Champion line — always shown, even if neither side picked one. -->
    <div
      class="rounded-lg border bg-white px-3 py-2"
      :class="view.champion.status === 'hit' ? 'border-emerald-200' : 'border-slate-200'"
      data-testid="bracket-scored-champion"
    >
      <div class="flex items-center justify-between gap-2 mb-1">
        <p class="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <span>🏆 {{ $t('bracketProgression.scored.championLabel') }}</span>
          <span class="text-slate-400 font-normal">({{ pointsPerChampion }}p)</span>
          <span
            v-if="view.champion.correct === null && view.champion.status !== 'miss'"
            class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500"
          >{{ $t('bracketProgression.scored.pending') }}</span>
        </p>
        <span
          class="text-xs font-bold px-2 py-0.5 rounded-full"
          :class="view.champion.pointsEarned > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
        >+{{ view.champion.pointsEarned }}p</span>
      </div>
      <div class="flex flex-col gap-0.5 text-xs">
        <div>
          <span class="text-slate-500">{{ $t('bracketProgression.scored.yourPick') }}:</span>
          <span
            v-if="view.champion.userPick"
            class="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border"
            :class="chipClass(view.champion.status)"
          >
            <span v-if="chipIcon(view.champion.status)" aria-hidden="true">{{ chipIcon(view.champion.status) }}</span>
            {{ teamName(view.champion.userPick) }}
          </span>
          <span v-else class="ml-1 italic text-slate-400">{{ $t('bracketProgression.scored.noTip') }}</span>
        </div>
        <div v-if="view.champion.status === 'miss' && view.champion.correct">
          <span class="text-slate-500">{{ $t('bracketProgression.scored.correctWas') }}:</span>
          <span class="ml-1.5 font-medium text-slate-700">{{ teamName(view.champion.correct) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import { TOURNAMENT_POINTS } from '../../lib/tournamentPoints.js'
import { buildBracketScoredView, teamNameOf, type CellStatus } from '../../lib/bracketScoredView.js'
import type {
  AllGroupsStandingAnswer,
  BracketMatch,
  BracketProgressionAnswer,
  BracketProgressionCorrectAnswer,
  Team,
} from '../../types/index.js'

const props = defineProps<{
  userAnswer: BracketProgressionAnswer
  correctAnswer: BracketProgressionAnswer | BracketProgressionCorrectAnswer
  template: readonly BracketMatch[]
  userGroupStandings: AllGroupsStandingAnswer | null
  correctGroupStandings: AllGroupsStandingAnswer | null
}>()

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const allTeams = ref<readonly Team[]>([])
const teamMap = computed(() => new Map(allTeams.value.map(t => [t.id, t])))

async function loadTeams(): Promise<void> {
  try {
    const token = await getAccessToken()
    allTeams.value = await api.teams.list(token)
  } catch {
    allTeams.value = []
  }
}

loadTeams()

const view = computed(() => buildBracketScoredView({
  userAnswer: props.userAnswer,
  correctAnswer: props.correctAnswer,
  template: props.template,
  userGroupStandings: props.userGroupStandings,
  correctGroupStandings: props.correctGroupStandings,
}))

const pointsPerChampion = TOURNAMENT_POINTS.perTeam.champion

function teamName(id: string): string {
  return teamNameOf(id, teamMap.value)
}

function chipClass(status: CellStatus): string {
  if (status === 'hit') return 'bg-emerald-50 border-emerald-300 text-emerald-800'
  if (status === 'miss') return 'bg-rose-50 border-rose-200 text-rose-700 line-through'
  return 'bg-slate-50 border-slate-200 text-slate-500'
}

function chipIcon(status: CellStatus): string {
  if (status === 'hit') return '✓'
  if (status === 'miss') return '✗'
  return ''
}
</script>
