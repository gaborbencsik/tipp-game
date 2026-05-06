<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">{{ $t('matches.title') }}</h1>
      </div>

      <SpecialPendingBanner
        v-if="totalPendingCount > 0"
        :pending-groups="pendingGroups"
        :total-pending-count="totalPendingCount"
        :now="pendingNow"
        class="mb-4"
      />

      <div
        v-if="showFavBanner"
        class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <span class="text-yellow-600 text-lg">⭐</span>
          <span class="text-sm text-yellow-800">{{ $t('matches.favBanner') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <router-link to="/app/profile" class="text-sm font-medium text-yellow-700 hover:text-yellow-900 underline">
            {{ $t('matches.favBannerLink') }}
          </router-link>
          <button class="text-yellow-400 hover:text-yellow-600 text-lg leading-none" @click="favBannerDismissed = true">&times;</button>
        </div>
      </div>

      <div class="flex gap-2 mb-6">
        <button
          class="px-3 py-1 text-sm rounded"
          :class="!matchesStore.stageFilter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = null"
        >
          {{ $t('matches.allStages') }}
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'group'"
        >
          {{ $t('matches.groupStage') }}
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter && matchesStore.stageFilter !== 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'round_of_16'"
        >
          {{ $t('matches.knockout') }}
        </button>

        <select
          v-if="favStore.leagues.length > 1"
          :value="matchesStore.leagueFilter ?? ''"
          class="ml-auto px-3 py-1 text-sm rounded border border-gray-300 bg-white text-gray-700"
          data-testid="league-filter"
          @change="matchesStore.leagueFilter = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">{{ $t('matches.allLeagues') }}</option>
          <option v-for="league in favStore.leagues" :key="league.id" :value="league.id">
            {{ league.name }}
          </option>
        </select>
      </div>

      <div v-if="matchesStore.isLoading" class="flex justify-center py-16">
        <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="matchesStore.error" class="bg-red-50 border border-red-200 text-red-700 rounded p-4">
        {{ matchesStore.error }}
      </div>

      <div v-else-if="matchesStore.matchesByDate.length === 0" class="text-center text-gray-500 py-16">
        {{ $t('matches.empty') }}
      </div>

      <div v-else>
        <!-- Lejátszott meccsek – összecsomagolt szekció -->
        <div v-if="finishedDayGroups.length > 0" class="mb-8">
          <div class="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
            <button
              data-testid="finished-section-toggle"
              class="flex items-center gap-1 cursor-pointer select-none hover:text-gray-900 group"
              @click="toggleFinishedSection"
            >
              <span class="text-lg font-semibold text-gray-500 group-hover:text-gray-700">
                {{ $t('matches.finishedMatches') }}
                <span class="text-sm font-normal text-gray-400 ml-1">
                  {{ $t('matches.finishedDays', { count: finishedDayGroups.length }) }}
                </span>
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0"
                :class="finishedSectionOpen ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <DayNavigator
              v-if="finishedSectionOpen"
              :date-label="finishedNav.dateLabel.value"
              :can-go-prev="finishedNav.canGoPrev.value"
              :can-go-next="finishedNav.canGoNext.value"
              :is-showing-all="finishedNav.isShowingAll.value"
              @prev="finishedNav.goPrev()"
              @next="finishedNav.goNext()"
              @show-all="finishedNav.isShowingAll.value ? finishedNav.showSingleDay() : finishedNav.showAll()"
            />
          </div>

          <template v-if="finishedSectionOpen">
            <div v-for="group in visibleFinishedGroups" :key="group.date" class="mb-8">
              <h2 class="text-base font-semibold text-gray-600 mb-3 border-b border-gray-100 pb-1">
                {{ group.label }}
              </h2>
              <div
                v-for="match in group.matches"
                :key="match.id"
                class="bg-white rounded-lg shadow-sm border p-4 mb-3"
                :class="cardBorderClass(match)"
              >
                <router-link :to="`/app/matches/${match.id}`" class="block">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {{ stageLabel(match.stage) }}
                      <span v-if="match.groupName"> – {{ $t('matches.groupLabel', { name: match.groupName }) }}</span>
                    </span>
                    <span class="text-xs font-bold px-2 py-0.5 rounded" :class="statusClass(match.status)">
                      {{ statusLabel(match.status) }}
                    </span>
                  </div>
                  <div class="flex items-center justify-center gap-4">
                    <span class="font-semibold text-gray-800 text-right flex-1">
                      <TeamBadge :team="match.homeTeam" />
                    </span>
                    <div class="text-xl font-bold text-gray-900 min-w-[5rem] text-center">
                      <template v-if="match.result">
                        {{ match.result.homeGoals }} – {{ match.result.awayGoals }}
                      </template>
                      <template v-else>
                        {{ formatTime(match.scheduledAt) }}
                      </template>
                    </div>
                    <span class="font-semibold text-gray-800 text-left flex-1">
                      <TeamBadge :team="match.awayTeam" />
                    </span>
                  </div>
                  <div v-if="match.venue" class="text-xs text-gray-400 text-center mt-1">
                    {{ match.venue.city }}
                  </div>
                </router-link>

                <div class="mt-3 pt-3 border-t border-gray-100">
                  <div class="text-center text-xs text-gray-400">
                    <template v-if="predictionsStore.predictionByMatchId(match.id)">
                      <span class="mr-1">🔒</span>
                      <span class="mr-2">{{ $t('matches.myTip') }} <strong class="text-gray-600">{{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }} – {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}</strong></span>
                      <span v-if="predictionsStore.predictionByMatchId(match.id)!.pointsGlobal !== null">· <strong class="text-blue-600">{{ predictionsStore.predictionByMatchId(match.id)!.pointsGlobal }} {{ $t('common.points') }}</strong></span>
                    </template>
                    <template v-else>
                      <span>{{ $t('matches.missedTip') }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Aktuális és jövőbeli meccsnapok -->
        <div v-if="upcomingDayGroups.length > 0" class="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
          <span class="text-lg font-semibold text-gray-700">{{ $t('matches.upcomingMatches') }}</span>
          <DayNavigator
            :date-label="upcomingNav.dateLabel.value"
            :can-go-prev="upcomingNav.canGoPrev.value"
            :can-go-next="upcomingNav.canGoNext.value"
            :is-showing-all="upcomingNav.isShowingAll.value"
            @prev="upcomingNav.goPrev()"
            @next="upcomingNav.goNext()"
            @show-all="upcomingNav.isShowingAll.value ? upcomingNav.showSingleDay() : upcomingNav.showAll()"
          />
        </div>
        <div
          v-for="group in visibleUpcomingGroups"
          :key="group.date"
          class="mb-8"
        >
          <h2 class="text-base font-semibold text-gray-600 mb-3 border-b border-gray-100 pb-1">
            {{ group.label }}
          </h2>
          <div
            v-for="match in group.matches"
            :key="match.id"
            class="bg-white rounded-lg shadow-sm border p-4 mb-3"
            :class="cardBorderClass(match)"
          >
            <router-link :to="`/app/matches/${match.id}`" class="block">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {{ stageLabel(match.stage) }}
                  <span v-if="match.groupName"> – {{ $t('matches.groupLabel', { name: match.groupName }) }}</span>
                </span>
                <span class="text-xs font-bold px-2 py-0.5 rounded" :class="statusClass(match.status)">
                  {{ statusLabel(match.status) }}
                </span>
              </div>
              <div class="flex items-center justify-center gap-4">
                <span class="font-semibold text-gray-800 text-right flex-1">
                  <TeamBadge :team="match.homeTeam" />
                </span>
                <div class="text-xl font-bold text-gray-900 min-w-[5rem] text-center">
                  <template v-if="match.result">
                    {{ match.result.homeGoals }} – {{ match.result.awayGoals }}
                  </template>
                  <template v-else>
                    {{ formatTime(match.scheduledAt) }}
                  </template>
                </div>
                <span class="font-semibold text-gray-800 text-left flex-1">
                  <TeamBadge :team="match.awayTeam" />
                </span>
              </div>
              <div v-if="match.venue" class="text-xs text-gray-400 text-center mt-1">
                {{ match.venue.city }}
              </div>
            </router-link>

            <!-- Tipp szekció -->
            <div class="mt-3 pt-3 border-t border-gray-100">
              <template v-if="isTippable(match)">
                <div class="flex items-center gap-2 justify-center">
                  <span class="text-sm">{{ predictionsStore.predictionByMatchId(match.id) ? '✅' : '⏳' }}</span>
                  <input
                    :ref="el => { if (el) homeInputs[match.id] = el as HTMLInputElement }"
                    :value="draftGoals[match.id]?.home ?? ''"
                    type="number" min="0" max="99" placeholder="0"
                    data-testid="input-home"
                    class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    @focus="onGoalFocus(match.id, 'home', $event)"
                    @input="onGoalInput(match.id, 'home', ($event.target as HTMLInputElement).value)"
                    @keydown="onGoalKeydown(match.id, 'home', $event)"
                  />
                  <span class="text-gray-400 text-sm">–</span>
                  <input
                    :ref="el => { if (el) awayInputs[match.id] = el as HTMLInputElement }"
                    :value="draftGoals[match.id]?.away ?? ''"
                    type="number" min="0" max="99" placeholder="0"
                    data-testid="input-away"
                    class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    @focus="onGoalFocus(match.id, 'away', $event)"
                    @input="onGoalInput(match.id, 'away', ($event.target as HTMLInputElement).value)"
                    @keydown="onGoalKeydown(match.id, 'away', $event)"
                  />
                </div>

                <div v-if="showOutcomeSelector(match.id, match.stage)" class="mt-2 flex flex-col gap-1 items-center">
                  <div class="flex gap-1">
                    <span class="text-xs text-gray-400 w-20 text-right self-center">{{ $t('matches.extraTimeShort') }}</span>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'extra_time_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-extra-time-home" @click="setOutcome(match.id, 'extra_time_home')">{{ $t('matches.homeWin') }}</button>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'extra_time_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-extra-time-away" @click="setOutcome(match.id, 'extra_time_away')">{{ $t('matches.awayWin') }}</button>
                  </div>
                  <div class="flex gap-1">
                    <span class="text-xs text-gray-400 w-20 text-right self-center">{{ $t('matches.penaltyShort') }}</span>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'penalties_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-penalties-home" @click="setOutcome(match.id, 'penalties_home')">{{ $t('matches.homeWin') }}</button>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'penalties_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-penalties-away" @click="setOutcome(match.id, 'penalties_away')">{{ $t('matches.awayWin') }}</button>
                  </div>
                </div>
                <div class="text-center mt-1 text-xs">
                  <span v-if="predictionsStore.saveStatus[match.id] === 'saved'" class="text-green-600" data-testid="save-success">{{ $t('matches.tipSaved') }}</span>
                  <span v-else-if="predictionsStore.saveStatus[match.id] === 'error'" class="text-red-500">{{ predictionsStore.error }}</span>
                  <span v-else-if="predictionsStore.predictionByMatchId(match.id)" class="text-gray-400">{{ $t('matches.lastModified', { date: formatDateTime(predictionsStore.predictionByMatchId(match.id)!.updatedAt) }) }}</span>
                </div>
              </template>

              <template v-else>
                <div class="text-center text-xs text-gray-400">
                  <template v-if="predictionsStore.predictionByMatchId(match.id)">
                    <span class="mr-1">🔒</span>
                    <span class="mr-2">{{ $t('matches.myTip') }} <strong class="text-gray-600">{{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }} – {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}</strong></span>
                    <span v-if="predictionsStore.predictionByMatchId(match.id)!.pointsGlobal !== null">· <strong class="text-blue-600">{{ predictionsStore.predictionByMatchId(match.id)!.pointsGlobal }} {{ $t('common.points') }}</strong></span>
                  </template>
                  <template v-else>
                    <span>{{ $t('matches.missedTip') }}</span>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>

      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useLeagueFavoritesStore } from '../stores/league-favorites.store.js'
import type { Match, MatchDateGroup, MatchOutcome, MatchStage, MatchStatus } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'
import TeamBadge from '../components/TeamBadge.vue'
import SpecialPendingBanner from '../components/SpecialPendingBanner.vue'
import DayNavigator from '../components/DayNavigator.vue'
import { usePendingSpecialTips } from '../composables/usePendingSpecialTips.js'
import { useDayNavigation } from '../composables/useDayNavigation.js'

const { t } = useI18n()
const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()
const groupsStore = useGroupsStore()
const favStore = useLeagueFavoritesStore()
const { pendingGroups, totalPendingCount, now: pendingNow } = usePendingSpecialTips()

const now = ref(new Date())
const draftGoals = ref<Record<string, { home: number | null, away: number | null }>>({})
const homeInputs = ref<Record<string, HTMLInputElement>>({})
const awayInputs = ref<Record<string, HTMLInputElement>>({})
const autosaveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

const draftOutcomes = ref<Record<string, MatchOutcome | null>>({})
const favBannerDismissed = ref(false)

const showFavBanner = computed((): boolean => {
  if (favBannerDismissed.value) return false
  if (favStore.leagues.length === 0) return false
  const leagueIdsWithoutFav = favStore.leagues
    .filter(l => !favStore.favoriteByLeagueId(l.id))
    .map(l => l.id)
  if (leagueIdsWithoutFav.length === 0) return false
  for (const leagueId of leagueIdsWithoutFav) {
    const leagueMatches = matchesStore.matches.filter(m => m.league?.id === leagueId)
    const earliest = leagueMatches.reduce<Date | null>((min, m) => {
      const d = new Date(m.scheduledAt)
      return !min || d < min ? d : min
    }, null)
    if (!earliest || earliest > now.value) return true
  }
  return false
})

const LS_KEY = 'matches_finished_expanded'
const LS_LEAGUE_KEY = 'matches_league_filter'
const finishedSectionOpen = ref(true)

function toggleFinishedSection(): void {
  finishedSectionOpen.value = !finishedSectionOpen.value
  try {
    localStorage.setItem(LS_KEY, String(finishedSectionOpen.value))
  } catch {
    // ignore
  }
}

function isFinishedDay(group: MatchDateGroup): boolean {
  return group.matches.every(m => m.status === 'finished' || m.status === 'cancelled')
}

const finishedDayGroups = computed((): MatchDateGroup[] =>
  matchesStore.matchesByDate.filter(g => isFinishedDay(g)),
)


const upcomingDayGroups = computed((): MatchDateGroup[] =>
  matchesStore.matchesByDate.filter(g => !isFinishedDay(g)),
)

const finishedNav = useDayNavigation({
  groups: finishedDayGroups,
  storageKey: 'matches_finished_day_index',
  defaultIndex: 'last',
})

const upcomingNav = useDayNavigation({
  groups: upcomingDayGroups,
  storageKey: 'matches_upcoming_day_index',
  defaultIndex: 'first',
})

const visibleFinishedGroups = computed((): MatchDateGroup[] => {
  if (finishedNav.isShowingAll.value) return finishedDayGroups.value
  const group = finishedNav.currentGroup.value
  return group ? [group] : []
})

const visibleUpcomingGroups = computed((): MatchDateGroup[] => {
  if (upcomingNav.isShowingAll.value) return upcomingDayGroups.value
  const group = upcomingNav.currentGroup.value
  return group ? [group] : []
})

const inputOrder = computed((): Array<{ matchId: string; side: 'home' | 'away' }> => {
  const order: Array<{ matchId: string; side: 'home' | 'away' }> = []
  for (const group of visibleUpcomingGroups.value) {
    for (const match of group.matches) {
      if (isTippable(match)) {
        order.push({ matchId: match.id, side: 'home' })
        order.push({ matchId: match.id, side: 'away' })
      }
    }
  }
  return order
})

onMounted(async () => {
  try {
    const stored = localStorage.getItem(LS_KEY)
    if (stored !== null) finishedSectionOpen.value = stored === 'true'
  } catch {
    // ignore
  }
  await matchesStore.fetchMatches()
  await predictionsStore.fetchMyPredictions()
  initDrafts()

  try {
    if (groupsStore.groups.length === 0) await groupsStore.fetchMyGroups()
    await Promise.all(
      groupsStore.groups.map(g => groupsStore.fetchSpecialPredictions(g.id))
    )
  } catch {
    // silent — banner simply won't show
  }

  try {
    await Promise.all([favStore.fetchLeagues(), favStore.fetchFavorites()])
  } catch {
    // silent — fav banner simply won't show
  }

  const userLeagueIds = new Set(groupsStore.groups.map(g => g.league?.id).filter(Boolean))
  try {
    const storedLeague = localStorage.getItem(LS_LEAGUE_KEY)
    if (storedLeague) {
      matchesStore.leagueFilter = storedLeague
    } else if (userLeagueIds.size === 1) {
      matchesStore.leagueFilter = [...userLeagueIds][0]!
    }
  } catch {
    if (userLeagueIds.size === 1) {
      matchesStore.leagueFilter = [...userLeagueIds][0]!
    }
  }
})

watch(() => matchesStore.leagueFilter, (val) => {
  try {
    if (val) {
      localStorage.setItem(LS_LEAGUE_KEY, val)
    } else {
      localStorage.removeItem(LS_LEAGUE_KEY)
    }
  } catch {
    // ignore
  }
})

function initDrafts(): void {
  for (const match of matchesStore.matches) {
    const existing = predictionsStore.predictionByMatchId(match.id)
    if (existing) {
      draftGoals.value[match.id] = { home: existing.homeGoals, away: existing.awayGoals }
      draftOutcomes.value[match.id] = existing.outcomeAfterDraw
    }
  }
}

function isTippable(match: Match): boolean {
  return match.status === 'scheduled' && new Date(match.scheduledAt) > now.value
}

const KNOCKOUT_STAGES: readonly MatchStage[] = ['round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

function showOutcomeSelector(matchId: string, stage: MatchStage): boolean {
  if (!KNOCKOUT_STAGES.includes(stage)) return false
  const goals = draftGoals.value[matchId]
  return goals?.home != null && goals?.away != null && goals.home === goals.away
}

function setOutcome(matchId: string, outcome: MatchOutcome): void {
  draftOutcomes.value = {
    ...draftOutcomes.value,
    [matchId]: draftOutcomes.value[matchId] === outcome ? null : outcome,
  }
  if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
  autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
}

function cardBorderClass(match: Match): string {
  const prediction = predictionsStore.predictionByMatchId(match.id)
  if (isTippable(match) && !prediction) return 'border-amber-300 bg-amber-50'
  if ((match.status === 'finished' || match.status === 'live') && !prediction) return 'border-red-200'
  return 'border-gray-100'
}

function onGoalFocus(matchId: string, side: 'home' | 'away', event: FocusEvent): void {
  const input = event.target as HTMLInputElement
  if (draftGoals.value[matchId]?.[side] == null) {
    const current = draftGoals.value[matchId] ?? { home: null, away: null }
    draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: 0 } }
  }
  nextTick(() => input.select())
}

function onGoalInput(matchId: string, side: 'home' | 'away', raw: string): void {
  const val = raw === '' ? null : Math.min(99, Math.max(0, parseInt(raw, 10)))
  const current = draftGoals.value[matchId] ?? { home: null, away: null }
  draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
  if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
  autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
}

function onGoalKeydown(matchId: string, side: 'home' | 'away', event: KeyboardEvent): void {
  if (/^[0-9]$/.test(event.key)) {
    const currentIdx = inputOrder.value.findIndex(e => e.matchId === matchId && e.side === side)
    const next = inputOrder.value[currentIdx + 1]
    if (!next) return
    event.preventDefault()
    const val = parseInt(event.key, 10)
    const current = draftGoals.value[matchId] ?? { home: null, away: null }
    draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
    if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
    autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
    nextTick(() => {
      const target = next.side === 'home' ? homeInputs.value[next.matchId] : awayInputs.value[next.matchId]
      if (target) { target.focus(); target.select() }
    })
  }
}

async function savePrediction(matchId: string): Promise<void> {
  const draft = draftGoals.value[matchId]
  if (draft?.home == null || draft?.away == null) return
  await predictionsStore.upsertPrediction({
    matchId,
    homeGoals: draft.home,
    awayGoals: draft.away,
    outcomeAfterDraw: draftOutcomes.value[matchId] ?? null,
  })
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
  return new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}
</script>
