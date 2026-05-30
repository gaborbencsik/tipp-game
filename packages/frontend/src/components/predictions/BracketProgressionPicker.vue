<template>
  <div data-testid="bracket-progression-picker">
    <GroupStandingsGate v-if="!groupStandingsAnswer" @open-group-standings="$emit('open-group-standings')" />

    <div v-else class="space-y-2">
      <div class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex gap-2">
        <span class="text-blue-600" aria-hidden="true">💡</span>
        <p class="text-xs text-blue-900 leading-snug">{{ $t('bracketProgression.infoCard') }}</p>
      </div>

      <BracketRoundCard
        v-for="round in EARLY_ROUNDS"
        :key="round"
        :round="round"
        :matches="matchesByRound.get(round) ?? []"
        :expanded="expandedRound === round"
        :completion="completionByRound[round]"
        :team-map="teamMap"
        @toggle="toggleExpanded(round)"
        @pick="onPick"
      />
      <FinalsAndBronzeCard
        :matches="finalsAndBronzeMatches"
        :expanded="expandedRound === 'final'"
        :team-map="teamMap"
        @toggle="toggleExpanded('final')"
        @pick="onPick"
      />
    </div>

    <div
      v-if="groupStandingsAnswer"
      class="mt-3 sticky bottom-2 left-0 right-0 z-10 px-4 py-3 rounded-lg border border-slate-200 bg-white shadow-sm"
      data-testid="bracket-progression-sticky"
    >
      <div class="flex items-center gap-1 mb-2">
        <template v-for="(seg, idx) in stepperSegments" :key="idx">
          <span
            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
            :class="dotClass(seg)"
          />
          <span
            v-if="idx < stepperSegments.length - 1"
            class="flex-1 h-[2px] min-w-[4px]"
            :class="seg === 'done' ? 'bg-emerald-500' : 'bg-slate-200'"
          />
        </template>
      </div>
      <div class="flex items-center justify-between text-xs">
        <span class="font-semibold text-slate-700">{{ progressLabel }}</span>
        <span :class="saveStatusClass" data-testid="bracket-progression-save-status">
          {{ saveStatusLabel }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BracketRoundCard from './BracketRoundCard.vue'
import FinalsAndBronzeCard from './FinalsAndBronzeCard.vue'
import GroupStandingsGate from './GroupStandingsGate.vue'
import { supabase } from '../../lib/supabase.js'
import { api } from '../../api/index.js'
import {
  deriveBracket,
  computeBracketCompletion,
  findDownstreamMatches,
} from '../../lib/bracketDerive.js'
import type {
  AllGroupsStandingAnswer,
  BracketProgressionAnswer,
  BracketProgressionOptions,
  BracketRound,
  Team,
} from '../../types/index.js'
import { useToastStore } from '../../stores/toast.store.js'

const props = defineProps<{
  options: BracketProgressionOptions
  answer: string | null
  groupStandingsAnswer: AllGroupsStandingAnswer | null
}>()

const emit = defineEmits<{
  'submit': [value: string]
  'open-group-standings': []
}>()

const { t } = useI18n()
const toast = useToastStore()

const EARLY_ROUNDS: readonly BracketRound[] = ['last_32', 'last_16', 'qf', 'sf']

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

const teamMap = computed(() => new Map(allTeams.value.map(t => [t.id, t])))

interface PickerState {
  winners: Record<string, string>
}

function parseAnswer(raw: string | null): PickerState {
  if (!raw) return { winners: {} }
  try {
    const parsed = JSON.parse(raw) as BracketProgressionAnswer
    if (parsed && typeof parsed === 'object' && parsed.winners && typeof parsed.winners === 'object') {
      const winners: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed.winners)) {
        if (typeof v === 'string') winners[k] = v
      }
      return { winners }
    }
  } catch {
    // ignore
  }
  return { winners: {} }
}

const state = reactive<PickerState>(parseAnswer(props.answer))

watch(() => props.answer, value => {
  const fresh = parseAnswer(value)
  state.winners = fresh.winners
})

const derivedBracket = computed(() => deriveBracket(
  props.options.bracketTemplate.matches,
  props.groupStandingsAnswer,
  state.winners,
))

const matchesByRound = computed(() => {
  const map = new Map<BracketRound, typeof derivedBracket.value.matches[number][]>()
  for (const m of derivedBracket.value.matches) {
    if (!map.has(m.round)) map.set(m.round, [])
    map.get(m.round)!.push(m)
  }
  return map
})

const finalsAndBronzeMatches = computed(() =>
  derivedBracket.value.matches.filter(m => m.round === 'final' || m.round === 'bronze'),
)

const completion = computed(() => computeBracketCompletion(
  { winners: state.winners },
  props.options.bracketTemplate.matches,
))

const completionByRound = computed(() => completion.value.picksByRound)

const expandedRound = ref<BracketRound | null>('last_32')

function toggleExpanded(round: BracketRound): void {
  expandedRound.value = expandedRound.value === round ? null : round
}

type Segment = 'done' | 'active' | 'partial' | 'empty'

const ALL_ROUNDS: readonly BracketRound[] = ['last_32', 'last_16', 'qf', 'sf', 'final', 'bronze']

const stepperSegments = computed<Segment[]>(() => {
  const segs: Segment[] = []
  for (const r of ALL_ROUNDS) {
    const c = completionByRound.value[r]
    if (c.total > 0 && c.done === c.total) segs.push('done')
    else if (expandedRound.value === r || (r === 'bronze' && expandedRound.value === 'final')) segs.push('active')
    else if (c.done > 0) segs.push('partial')
    else segs.push('empty')
  }
  return segs
})

function dotClass(seg: Segment): string {
  if (seg === 'done') return 'bg-emerald-500'
  if (seg === 'active') return 'bg-blue-600 ring-2 ring-blue-200'
  if (seg === 'partial') return 'bg-amber-400'
  return 'bg-slate-300'
}

const progressLabel = computed(() => {
  const r = expandedRound.value
  if (r && r !== 'bronze') {
    const c = completionByRound.value[r]
    return t('bracketProgression.roundProgress', {
      round: t(`bracketProgression.round.${r}`),
      done: c.done,
      total: c.total,
    })
  }
  return t('bracketProgression.progress', {
    done: completion.value.totalDone,
    total: completion.value.totalSteps,
  })
})

// Cross-store reactivity
watch(() => props.groupStandingsAnswer, () => {
  const derived = derivedBracket.value
  const orphaned: string[] = []
  for (const [matchId, teamId] of Object.entries(state.winners)) {
    const m = derived.matches.find(d => d.id === matchId)
    if (!m) continue
    if (m.teamA !== teamId && m.teamB !== teamId) {
      orphaned.push(matchId)
    }
  }
  if (orphaned.length > 0) {
    for (const id of orphaned) delete state.winners[id]
    toast.addToast(t('bracketProgression.orphanToast', { n: orphaned.length }), 'info')
    scheduleSave()
  }
}, { deep: true })

function onPick(matchId: string, teamId: string): void {
  const oldWinner = state.winners[matchId]
  state.winners[matchId] = teamId

  if (oldWinner && oldWinner !== teamId) {
    const downstreamIds = findDownstreamMatches(matchId, props.options.bracketTemplate.matches)
    for (const dsId of downstreamIds) {
      if (state.winners[dsId] === oldWinner) {
        delete state.winners[dsId]
      }
    }
  }
  scheduleSave()
}

const saveStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => flushSave(), 400)
}

function flushSave(): void {
  saveStatus.value = 'saving'
  emit('submit', JSON.stringify({ winners: { ...state.winners } }))
}

function setSaveStatus(value: 'idle' | 'saving' | 'saved' | 'error'): void {
  saveStatus.value = value
}

defineExpose({ flushSave, setSaveStatus })

const saveStatusLabel = computed(() => {
  if (saveStatus.value === 'saving') return `↻ ${t('bracketProgression.saving')}`
  if (saveStatus.value === 'saved') return `✓ ${t('bracketProgression.saved')}`
  if (saveStatus.value === 'error') return `⚠ ${t('bracketProgression.errorSaving')}`
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
