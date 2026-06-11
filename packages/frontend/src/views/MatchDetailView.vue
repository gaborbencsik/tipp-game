<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-6">
        <router-link
          to="/app/matches"
          data-testid="back-link"
          class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
        >
          {{ $t('matchDetail.back') }}
        </router-link>
      </div>

      <div v-if="matchesStore.isLoading" class="flex justify-center py-16">
        <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="!match" class="text-center text-gray-500 py-16">
        {{ $t('matchDetail.notFound') }}
      </div>

      <template v-else>
        <VenueBanner :venue="match.venue" />

        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">
            {{ stageLabel(match.stage) }}
            <span v-if="match.groupName"> – {{ $t('matches.groupLabel', { name: match.groupName }) }}</span>
          </span>
          <span
            class="text-xs font-bold px-2 py-0.5 rounded"
            :class="statusClass(match.status)"
          >
            {{ statusLabel(match.status) }}
          </span>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-4" :class="ownFavoriteClass">
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

          <div v-if="match.venue" class="text-sm text-gray-400 text-center mt-3" data-testid="venue-location">
            {{ match.venue.name }}, {{ match.venue.city }}<template v-if="match.venue.country">, {{ match.venue.country }}</template>
          </div>

          <div
            v-if="favoriteIndicator"
            class="text-center text-xs flex items-center justify-center gap-1 mt-3"
            data-testid="favorite-indicator"
          >
            <span class="text-yellow-500">⭐</span>
            <span v-if="favoriteIndicator.self" class="font-semibold text-gray-700">{{ favoriteIndicator.self }}</span>
            <span v-if="favoriteIndicator.self && favoriteIndicator.othersText" class="text-gray-500">,&nbsp;</span>
            <span v-if="favoriteIndicator.othersText" class="text-gray-500">{{ favoriteIndicator.othersText }}</span>
          </div>
        </div>

        <!-- Tipp szekció -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <div class="flex items-center gap-2 mb-3">
            <h2 class="text-sm font-semibold text-gray-600">{{ $t('matchDetail.tipTitle') }}</h2>
            <ScoringExplainerTrigger source="match-tip" variant="icon" />
          </div>

          <!-- Tippelhető meccs -->
          <template v-if="isTippable(match)">
            <div class="flex items-center gap-3 justify-center">
              <input
                :value="draftGoals.home ?? ''"
                inputmode="numeric"
                pattern="[0-9]*"
                min="0"
                max="99"
                placeholder="0"
                data-testid="input-home"
                class="w-[2.6rem] h-8 text-center text-base font-bold text-gray-900 bg-gray-50 border-[1.5px] border-gray-300 rounded-md transition-all duration-150 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                @focus="onGoalFocus('home', $event)"
                @input="onGoalInput('home', ($event.target as HTMLInputElement).value)"
                @keydown="onGoalKeydown('home', $event)"
              />
              <span class="text-gray-400 font-bold">–</span>
              <input
                ref="awayInputRef"
                :value="draftGoals.away ?? ''"
                inputmode="numeric"
                pattern="[0-9]*"
                min="0"
                max="99"
                placeholder="0"
                data-testid="input-away"
                class="w-[2.6rem] h-8 text-center text-base font-bold text-gray-900 bg-gray-50 border-[1.5px] border-gray-300 rounded-md transition-all duration-150 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
                :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                @focus="onGoalFocus('away', $event)"
                @input="onGoalInput('away', ($event.target as HTMLInputElement).value)"
                @keydown="onGoalKeydown('away', $event)"
              />
            </div>

            <!-- Outcome selector egyenes kieséses meccseknél döntetlen tipp esetén -->
            <div v-if="showOutcomeSelector" class="mt-3 flex flex-col gap-1 items-center">
              <div class="flex gap-1">
                <span class="text-xs text-gray-400 w-20 text-right self-center">{{ $t('matches.extraTimeShort') }}</span>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'extra_time_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('extra_time_home')"
                >{{ $t('matches.homeWin') }}</button>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'extra_time_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('extra_time_away')"
                >{{ $t('matches.awayWin') }}</button>
              </div>
              <div class="flex gap-1">
                <span class="text-xs text-gray-400 w-20 text-right self-center">{{ $t('matches.penaltyShort') }}</span>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'penalties_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('penalties_home')"
                >{{ $t('matches.homeWin') }}</button>
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded border transition-colors"
                  :class="draftOutcome === 'penalties_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'"
                  @click="setOutcome('penalties_away')"
                >{{ $t('matches.awayWin') }}</button>
              </div>
            </div>

            <div class="mt-3 pt-3 border-t border-gray-100">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-gray-700 flex items-center gap-1">
                  ⚽ {{ $t('matches.scorer.label').replace(':', '') }}
                  <button
                    v-if="isKnockoutStage"
                    type="button"
                    class="text-gray-400 hover:text-blue-500 ml-1"
                    :title="$t('matches.scorer.tooltipKnockout')"
                    aria-label="info"
                    data-testid="scorer-knockout-info"
                  >ⓘ</button>
                </span>
                <span class="text-xs text-gray-400">{{ $t('matches.scorer.optional') }}</span>
              </div>
              <div :class="isScorerDirty ? 'ring-1 ring-blue-500 rounded-md' : ''" data-testid="scorer-pick-row">
                <PlayerSelectCombobox
                  :model-value="draftScorerPick"
                  :restrict-to-teams="[
                    { id: match.homeTeam.id, name: match.homeTeam.name, shortCode: match.homeTeam.shortCode, flagUrl: match.homeTeam.flagUrl },
                    { id: match.awayTeam.id, name: match.awayTeam.name, shortCode: match.awayTeam.shortCode, flagUrl: match.awayTeam.flagUrl },
                  ]"
                  :allow-explicit-clear="true"
                  :show-player-meta="true"
                  size="comfortable"
                  @update:model-value="onScorerPickChange"
                />
              </div>
            </div>

            <div class="text-center mt-1 text-xs">
              <span
                v-if="predictionsStore.saveStatus[match.id] === 'saved'"
                class="text-green-600"
                data-testid="save-success"
              >
                {{ $t('matchDetail.tipSaved') }}
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
                  {{ $t('matchDetail.myTip') }}
                  <strong class="text-gray-700">{{ myPrediction.homeGoals }} – {{ myPrediction.awayGoals }}</strong>
                </span>
                <span v-if="myPrediction.pointsGlobal !== null" class="ml-3">
                  {{ $t('matchDetail.pointsLabel') }} <strong class="text-blue-700">{{ myPrediction.pointsGlobal }}</strong>
                </span>
              </template>
              <template v-else>
                <span>{{ $t('matchDetail.noTip') }}</span>
              </template>
            </div>
            <div
              v-if="myPrediction?.scorerPickPlayerId"
              class="text-center text-sm flex items-center justify-center gap-2 mt-2"
              data-testid="scorer-badge"
            >
              <span :class="lockedScorerNameClass">⚽ {{ $t('matches.scorer.label') }} {{ myPrediction.scorerPlayerNameSnapshot }}</span>
              <span :class="lockedScorerBadgeClass" class="text-xs font-semibold px-2 py-0.5 rounded border">
                {{ lockedScorerBadgeLabel }}
              </span>
            </div>
          </template>
        </div>

        <!-- Insights + market values section (shared reveal-gate) -->
        <div
          v-if="matchOdds || hasMarketValues"
          class="mt-4 relative"
          data-testid="insights-section"
        >
          <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">{{ $t('matchDetail.insightsTitle') }}</h3>
          <div :class="{ 'blur-sm select-none pointer-events-none transition-[filter] duration-300': !isRevealed }">
            <MatchOddsBar v-if="matchOdds" :odds="isRevealed ? matchOdds : blurredOdds" />
            <MarketValuesBar
              v-if="hasMarketValues && match"
              :home-team="match.homeTeam"
              :away-team="match.awayTeam"
            />
          </div>
          <div v-if="!isRevealed" class="absolute inset-0 top-7 flex items-center justify-center rounded-lg">
            <button
              type="button"
              class="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 py-1.5 rounded-md shadow-sm"
              :disabled="isRevealing"
              data-testid="insights-reveal-btn"
              @click="onRevealClick"
            >
              {{ $t('matchDetail.insightsRevealCta') }}
            </button>
          </div>
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
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { useGroupFavoritesStore, type FavoriteMember } from '../stores/group-favorites.store.js'
import { useInsightsRevealStore } from '../stores/insights-reveal.store.js'
import { useToast } from '../composables/useToast.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { Match, MatchOutcome, MatchPrediction, MatchStage, MatchStatus, MatchOdds } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'
import ScoringExplainerTrigger from '../components/ScoringExplainerTrigger.vue'
import TeamBadge from '../components/TeamBadge.vue'
import VenueBanner from '../components/VenueBanner.vue'
import MatchPredictionsList from '../components/MatchPredictionsList.vue'
import MatchOddsBar from '../components/MatchOddsBar.vue'
import MarketValuesBar from '../components/MarketValuesBar.vue'
import PlayerSelectCombobox from '../components/predictions/PlayerSelectCombobox.vue'
import { getDateLocale } from '../lib/dateLocale.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

const { t } = useI18n()
const route = useRoute()
const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()
const authStore = useAuthStore()
const groupFavStore = useGroupFavoritesStore()
const insightsRevealStore = useInsightsRevealStore()
const { showToast } = useToast()

const now = ref(new Date())
const draftGoals = ref<{ home: number | null, away: number | null }>({ home: null, away: null })
const draftOutcome = ref<MatchOutcome | null>(null)
const draftScorerPick = ref<string | null>(null)
const awayInputRef = ref<HTMLInputElement | null>(null)
const matchPredictions = ref<MatchPrediction[]>([])
const matchOdds = ref<MatchOdds | null>(null)
const isRevealing = ref(false)
const blurredOdds = computed((): MatchOdds | null => {
  const m = match.value
  if (!m) return null
  return {
    homeTeam: { name: m.homeTeam.name, odds: 0.33 },
    draw: 0.34,
    awayTeam: { name: m.awayTeam.name, odds: 0.33 },
    oneDayChange: { home: null, draw: null, away: null },
    volume: null,
    avgVolume: null,
    competitive: null,
    contextDescription: null,
    source: 'polymarket',
    sourceUrl: null,
    updatedAt: new Date().toISOString(),
  }
})
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

const KNOCKOUT_STAGES: readonly MatchStage[] = ['round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

const matchId = computed(() => route.params.id as string)
const isRevealed = computed((): boolean => insightsRevealStore.isRevealed(matchId.value))

const match = computed((): Match | undefined =>
  matchesStore.matches.find(m => m.id === matchId.value)
)

const hasMarketValues = computed((): boolean => {
  const m = match.value
  if (!m) return false
  return m.homeTeam.marketValueEur !== null || m.awayTeam.marketValueEur !== null
})

const myPrediction = computed(() => predictionsStore.predictionByMatchId(matchId.value))

interface FavoriteIndicator {
  readonly self: string | null
  readonly othersText: string
}

const favoriteIndicator = computed<FavoriteIndicator | null>(() => {
  if (!match.value) return null
  const { self, others } = groupFavStore.membersForMatch(match.value, authStore.user?.id ?? null)
  if (!self && others.length === 0) return null
  let othersText = ''
  if (others.length > 0 && others.length <= 3) {
    othersText = others.map((o: FavoriteMember) => o.displayName).join(', ')
  } else if (others.length >= 4) {
    othersText = t('matches.favoriteCount', { count: others.length })
  }
  return { self: self?.displayName ?? null, othersText }
})

const ownFavoriteClass = computed<string>(() => {
  if (!match.value) return ''
  return groupFavStore.hasOwnFavorite(match.value, authStore.user?.id ?? null)
    ? 'ring-2 ring-yellow-300 bg-yellow-50/40'
    : ''
})

onMounted(async () => {
  if (matchesStore.matches.length === 0) {
    await matchesStore.fetchMatches()
  }
  await predictionsStore.fetchMyPredictions()
  const existing = myPrediction.value
  if (existing) {
    draftGoals.value = { home: existing.homeGoals, away: existing.awayGoals }
    draftOutcome.value = existing.outcomeAfterDraw
    draftScorerPick.value = existing.scorerPickPlayerId
  }
  if (match.value?.status === 'finished' || match.value?.status === 'live') {
    await loadMatchPredictions()
  }
  loadMatchOdds()

  // UX-016: load favorites for this match's league
  const leagueId = match.value?.league?.id
  if (leagueId) {
    void groupFavStore.ensureLoaded(leagueId).catch(() => undefined)
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
    scorerPickPlayerId: draftScorerPick.value,
  })
}

function onScorerPickChange(playerId: string | null): void {
  draftScorerPick.value = playerId
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => { void savePrediction() }, 2000)
}

const isScorerDirty = computed((): boolean => {
  const existing = myPrediction.value
  if (!existing) return draftScorerPick.value !== null
  return draftScorerPick.value !== (existing.scorerPickPlayerId ?? null)
})

const isKnockoutStage = computed((): boolean => {
  if (!match.value) return false
  return KNOCKOUT_STAGES.includes(match.value.stage)
})

const lockedScorerStatus = computed((): 'pending' | 'hit' | 'miss' => {
  const pred = myPrediction.value
  if (!pred || pred.scorerBonusPoints === null || pred.scorerBonusPoints === undefined) return 'pending'
  return pred.scorerBonusPoints > 0 ? 'hit' : 'miss'
})

const lockedScorerNameClass = computed((): string =>
  lockedScorerStatus.value === 'miss'
    ? 'text-gray-500 line-through decoration-gray-300'
    : 'text-gray-700',
)

const lockedScorerBadgeClass = computed((): string => {
  switch (lockedScorerStatus.value) {
    case 'hit':     return 'bg-green-50 text-green-700 border-green-200'
    case 'miss':    return 'bg-gray-50 text-gray-500 border-gray-200'
    case 'pending': return 'bg-blue-50 text-blue-700 border-blue-200'
  }
})

const lockedScorerBadgeLabel = computed((): string => {
  switch (lockedScorerStatus.value) {
    case 'hit':     return t('matches.scorer.hit')
    case 'miss':    return t('matches.scorer.miss')
    case 'pending': return t('matches.scorer.pending')
  }
})

async function loadMatchPredictions(): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return
    matchPredictions.value = await api.predictions.forMatch(token, matchId.value)
  } catch {
    // silent — non-critical
  }
}

async function loadMatchOdds(): Promise<void> {
  try {
    const token = await getToken()
    if (!token) return
    const response = await api.matches.odds(token, matchId.value)
    matchOdds.value = response.odds
    insightsRevealStore.setRevealed(matchId.value, response.revealed)
  } catch {
    // silent — odds are supplementary
  }
}

async function onRevealClick(): Promise<void> {
  if (isRevealing.value || isRevealed.value) return
  isRevealing.value = true
  try {
    const token = await getToken()
    if (!token) return
    await insightsRevealStore.reveal(token, matchId.value)
  } catch {
    showToast(t('matchDetail.insightsRevealError'), 'error')
  } finally {
    isRevealing.value = false
  }
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'live': return t('status.live')
    case 'finished': return t('status.finished')
    case 'scheduled': return t('status.scheduled')
    case 'cancelled': return t('status.cancelled')
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
    case 'group': return t('stage.group')
    case 'round_of_16': return t('stage.round16')
    case 'quarter_final': return t('stage.quarter')
    case 'semi_final': return t('stage.semi')
    case 'third_place': return t('stage.thirdPlace')
    case 'final': return t('stage.final')
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(getDateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
