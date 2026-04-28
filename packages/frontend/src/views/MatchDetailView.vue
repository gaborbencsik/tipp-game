<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-6">
        <router-link
          to="/app/matches"
          data-testid="back-link"
          class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          ← Vissza
        </router-link>
      </div>

      <div v-if="matchesStore.isLoading" class="flex justify-center py-16">
        <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="!match" class="text-center text-gray-500 py-16">
        A mérkőzés nem található.
      </div>

      <template v-else>
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">
            {{ stageLabel(match.stage) }}
            <span v-if="match.groupName"> – {{ match.groupName }} csoport</span>
          </span>
          <span
            class="text-xs font-bold px-2 py-0.5 rounded"
            :class="statusClass(match.status)"
          >
            {{ statusLabel(match.status) }}
          </span>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-4">
          <div class="flex items-center justify-center gap-4">
            <div class="flex-1 text-right">
              <span class="font-semibold text-gray-800 text-lg">
                <TeamBadge :team="match.homeTeam" />
              </span>
            </div>

            <div class="text-2xl font-bold text-gray-900 min-w-[6rem] text-center">
              <template v-if="match.result">
                {{ match.result.homeGoals }} – {{ match.result.awayGoals }}
              </template>
              <template v-else>
                {{ formatTime(match.scheduledAt) }}
              </template>
            </div>

            <div class="flex-1 text-left">
              <span class="font-semibold text-gray-800 text-lg">
                <TeamBadge :team="match.awayTeam" />
              </span>
            </div>
          </div>

          <div v-if="match.venue" class="text-sm text-gray-400 text-center mt-3">
            {{ match.venue.name }}, {{ match.venue.city }}
          </div>
        </div>

        <!-- Tipp szekció -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <h2 class="text-sm font-semibold text-gray-600 mb-3">Tipp</h2>

          <!-- Tippelhető meccs -->
          <template v-if="isTippable(match)">
            <div class="flex items-center gap-2 justify-center">
              <input
                ref="homeInputRef"
                :value="draftGoals.home ?? ''"
                type="number"
                min="0"
                max="99"
                placeholder="0"
                data-testid="input-home"
                class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                @focus="onGoalFocus('home', $event)"
                @input="onGoalInput('home', ($event.target as HTMLInputElement).value)"
                @keydown="onGoalKeydown('home', $event)"
              />
              <span class="text-gray-400 text-sm">–</span>
              <input
                ref="awayInputRef"
                :value="draftGoals.away ?? ''"
                type="number"
                min="0"
                max="99"
                placeholder="0"
                data-testid="input-away"
                class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                @focus="onGoalFocus('away', $event)"
                @input="onGoalInput('away', ($event.target as HTMLInputElement).value)"
                @keydown="onGoalKeydown('away', $event)"
              />
            </div>

            <!-- Outcome selector egyenes kieséses meccseknél döntetlen tipp esetén -->
            <div v-if="showOutcomeSelector" class="mt-3 flex flex-col gap-1 items-center">
              <div class="flex gap-1">
                <span class="text-xs text-gray-400 w-20 text-right self-center">Hossz.:</span>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'extra_time_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('extra_time_home')"
                >← Hazai</button>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'extra_time_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('extra_time_away')"
                >Vendég →</button>
              </div>
              <div class="flex gap-1">
                <span class="text-xs text-gray-400 w-20 text-right self-center">Tizenegyes:</span>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'penalties_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('penalties_home')"
                >← Hazai</button>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'penalties_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('penalties_away')"
                >Vendég →</button>
              </div>
            </div>

            <div class="text-center mt-1 text-xs">
              <span
                v-if="predictionsStore.saveStatus[match.id] === 'saved'"
                class="text-green-600"
                data-testid="save-success"
              >
                Tipp elmentve! ✓
              </span>
              <span
                v-else-if="predictionsStore.saveStatus[match.id] === 'error'"
                class="text-red-500"
              >
                {{ predictionsStore.error }}
              </span>
            </div>
          </template>

          <!-- Lezárt meccs -->
          <template v-else>
            <div class="text-center text-sm text-gray-500">
              <template v-if="myPrediction">
                <span>
                  Az én tippem:
                  <strong class="text-gray-700">{{ myPrediction.homeGoals }} – {{ myPrediction.awayGoals }}</strong>
                </span>
                <span v-if="myPrediction.pointsGlobal !== null" class="ml-3">
                  Pontok: <strong class="text-blue-700">{{ myPrediction.pointsGlobal }}</strong>
                </span>
              </template>
              <template v-else>
                <span>Nem adtál tippet erre a mérkőzésre</span>
              </template>
            </div>
          </template>
        </div>

        <MatchPredictionsList
          v-if="(match.status === 'finished' || match.status === 'live') && matchPredictions.length > 0"
          :predictions="matchPredictions"
          :current-user-id="authStore.user?.id ?? ''"
          class="mt-4"
          data-testid="match-predictions-list"
        />
      </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { Match, MatchOutcome, MatchPrediction, MatchStage, MatchStatus } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'
import TeamBadge from '../components/TeamBadge.vue'
import MatchPredictionsList from '../components/MatchPredictionsList.vue'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const route = useRoute()
const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()
const authStore = useAuthStore()

const now = ref(new Date())
const draftGoals = ref<{ home: number | null, away: number | null }>({ home: null, away: null })
const draftOutcome = ref<MatchOutcome | null>(null)
const homeInputRef = ref<HTMLInputElement | null>(null)
const awayInputRef = ref<HTMLInputElement | null>(null)
const matchPredictions = ref<MatchPrediction[]>([])
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

const KNOCKOUT_STAGES: readonly MatchStage[] = ['round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

const matchId = computed(() => route.params.id as string)

const match = computed((): Match | undefined =>
  matchesStore.matches.find(m => m.id === matchId.value)
)

const myPrediction = computed(() => predictionsStore.predictionByMatchId(matchId.value))

onMounted(async () => {
  if (matchesStore.matches.length === 0) {
    await matchesStore.fetchMatches()
  }
  await predictionsStore.fetchMyPredictions()
  const existing = myPrediction.value
  if (existing) {
    draftGoals.value = { home: existing.homeGoals, away: existing.awayGoals }
    draftOutcome.value = existing.outcomeAfterDraw
  }
  if (match.value?.status === 'finished' || match.value?.status === 'live') {
    await loadMatchPredictions()
  }
})

onUnmounted(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
})

function isTippable(m: Match): boolean {
  return m.status === 'scheduled' && new Date(m.scheduledAt) > now.value
}

const showOutcomeSelector = computed((): boolean => {
  if (!match.value) return false
  if (!KNOCKOUT_STAGES.includes(match.value.stage)) return false
  return draftGoals.value.home != null && draftGoals.value.away != null && draftGoals.value.home === draftGoals.value.away
})

function setOutcome(outcome: MatchOutcome): void {
  draftOutcome.value = draftOutcome.value === outcome ? null : outcome
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => { void savePrediction() }, 2000)
}

function onGoalFocus(side: 'home' | 'away', event: FocusEvent): void {
  const input = event.target as HTMLInputElement
  if (draftGoals.value[side] == null) {
    draftGoals.value = { ...draftGoals.value, [side]: 0 }
  }
  nextTick(() => input.select())
}

function onGoalInput(side: 'home' | 'away', raw: string): void {
  const val = raw === '' ? null : Math.min(99, Math.max(0, parseInt(raw, 10)))
  draftGoals.value = { ...draftGoals.value, [side]: val }
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => { void savePrediction() }, 2000)
}

function onGoalKeydown(side: 'home' | 'away', event: KeyboardEvent): void {
  if (/^[0-9]$/.test(event.key)) {
    const target = side === 'home' ? awayInputRef.value : null
    if (!target) return
    event.preventDefault()
    const val = parseInt(event.key, 10)
    draftGoals.value = { ...draftGoals.value, [side]: val }
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => { void savePrediction() }, 2000)
    nextTick(() => { target.focus(); target.select() })
  }
}

async function savePrediction(): Promise<void> {
  if (draftGoals.value.home == null || draftGoals.value.away == null) return
  await predictionsStore.upsertPrediction({
    matchId: matchId.value,
    homeGoals: draftGoals.value.home,
    awayGoals: draftGoals.value.away,
    outcomeAfterDraw: draftOutcome.value,
  })
}

async function loadMatchPredictions(): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return
    matchPredictions.value = await api.predictions.forMatch(token, matchId.value)
  } catch {
    // silent — non-critical
  }
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'live': return 'ÉLŐBEN'
    case 'finished': return 'Befejezett'
    case 'scheduled': return 'Tervezett'
    case 'cancelled': return 'Törölve'
  }
}

function statusClass(status: MatchStatus): string {
  switch (status) {
    case 'live': return 'bg-red-500 text-white'
    case 'finished': return 'bg-gray-200 text-gray-600'
    case 'scheduled': return 'bg-blue-100 text-blue-700'
    case 'cancelled': return 'bg-gray-100 text-gray-400'
  }
}

function stageLabel(stage: MatchStage): string {
  switch (stage) {
    case 'group': return 'Csoportkör'
    case 'round_of_16': return 'Nyolcaddöntő'
    case 'quarter_final': return 'Negyeddöntő'
    case 'semi_final': return 'Elődöntő'
    case 'third_place': return 'Bronzmérkőzés'
    case 'final': return 'Döntő'
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
