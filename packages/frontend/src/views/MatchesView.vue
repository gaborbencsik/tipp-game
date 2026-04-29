<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Mérkőzések</h1>
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
          <span class="text-sm text-yellow-800">Állítsd be kedvenc csapatodat a profilodban!</span>
        </div>
        <div class="flex items-center gap-2">
          <router-link to="/app/profile" class="text-sm font-medium text-yellow-700 hover:text-yellow-900 underline">
            Beállítás
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
          Összes
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'group'"
        >
          Csoportkör
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter && matchesStore.stageFilter !== 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'round_of_16'"
        >
          Egyenes kiesés
        </button>

        <select
          v-if="favStore.leagues.length > 1"
          :value="matchesStore.leagueFilter ?? ''"
          class="ml-auto px-3 py-1 text-sm rounded border border-gray-300 bg-white text-gray-700"
          data-testid="league-filter"
          @change="matchesStore.leagueFilter = ($event.target as HTMLSelectElement).value || null"
        >
          <option value="">Összes liga</option>
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
        Nincs megjeleníthető mérkőzés.
      </div>

      <div v-else>
        <!-- Lejátszott meccsek – összecsomagolt szekció -->
        <div v-if="finishedDayGroups.length > 0" class="mb-8">
          <button
            data-testid="finished-section-toggle"
            class="w-full text-left flex items-center justify-between border-b border-gray-200 pb-1 mb-3 cursor-pointer select-none hover:text-gray-900 group"
            @click="toggleFinishedSection"
          >
            <span class="text-lg font-semibold text-gray-500 group-hover:text-gray-700">
              Lejátszott meccsek
              <span class="text-sm font-normal text-gray-400 ml-2">
                ({{ finishedDayGroups.length }} nap, {{ finishedMatchCount }} mérkőzés)
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

          <template v-if="finishedSectionOpen">
            <div v-for="group in finishedDayGroups" :key="group.date" class="mb-8">
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
                      <span v-if="match.groupName"> – {{ match.groupName }} csoport</span>
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
                      <span class="mr-2">Tippem: <strong class="text-gray-600">{{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }} – {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}</strong></span>
                      <span v-if="predictionsStore.predictionByMatchId(match.id)!.pointsGlobal !== null">· <strong class="text-blue-600">{{ predictionsStore.predictionByMatchId(match.id)!.pointsGlobal }} pont</strong></span>
                    </template>
                    <template v-else>
                      <span>❌ Nem tippeltél erre a meccsre</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Aktuális és jövőbeli meccsnapok -->
        <div
          v-for="group in visibleUpcomingGroups"
          :key="group.date"
          class="mb-8"
        >
          <h2 class="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
            {{ group.label }}
          </h2>
          <div
            v-for="match in group.matches"
            :key="match.id"
            class="bg-white rounded-lg shadow-sm border p-4 mb-3"
            :class="cardBorderClass(match)"
          >
            <router-link :to="`/matches/${match.id}`" class="block">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {{ stageLabel(match.stage) }}
                  <span v-if="match.groupName"> – {{ match.groupName }} csoport</span>
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
                    <span class="text-xs text-gray-400 w-20 text-right self-center">Hossz.:</span>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'extra_time_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-extra-time-home" @click="setOutcome(match.id, 'extra_time_home')">← Hazai</button>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'extra_time_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-extra-time-away" @click="setOutcome(match.id, 'extra_time_away')">Vendég →</button>
                  </div>
                  <div class="flex gap-1">
                    <span class="text-xs text-gray-400 w-20 text-right self-center">Tizenegyes:</span>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'penalties_home' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-penalties-home" @click="setOutcome(match.id, 'penalties_home')">← Hazai</button>
                    <button type="button" class="text-xs px-2 py-1 rounded border transition-colors" :class="draftOutcomes[match.id] === 'penalties_away' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'" data-testid="outcome-penalties-away" @click="setOutcome(match.id, 'penalties_away')">Vendég →</button>
                  </div>
                </div>
                <div class="text-center mt-1 text-xs">
                  <span v-if="predictionsStore.saveStatus[match.id] === 'saved'" class="text-green-600" data-testid="save-success">Tipp elmentve! ✓</span>
                  <span v-else-if="predictionsStore.saveStatus[match.id] === 'error'" class="text-red-500">{{ predictionsStore.error }}</span>
                  <span v-else-if="predictionsStore.predictionByMatchId(match.id)" class="text-gray-400">Utoljára módosítva: {{ formatDateTime(predictionsStore.predictionByMatchId(match.id)!.updatedAt) }}</span>
                </div>
              </template>

              <template v-else>
                <div class="text-center text-xs text-gray-400">
                  <template v-if="predictionsStore.predictionByMatchId(match.id)">
                    <span class="mr-1">🔒</span>
                    <span class="mr-2">Tippem: <strong class="text-gray-600">{{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }} – {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}</strong></span>
                    <span v-if="predictionsStore.predictionByMatchId(match.id)!.pointsGlobal !== null">· <strong class="text-blue-600">{{ predictionsStore.predictionByMatchId(match.id)!.pointsGlobal }} pont</strong></span>
                  </template>
                  <template v-else>
                    <span>❌ Nem tippeltél erre a meccsre</span>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- Távoli jövőbeli meccsek -->
        <button
          v-if="!showFutureMatches && hiddenFutureCount > 0"
          class="w-full text-sm text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg py-3 mb-4 transition-colors"
          @click="showFutureMatches = true"
        >
          ▶ {{ hiddenFutureCount }} további tervezett mérkőzés megjelenítése
        </button>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from 'vue'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useLeagueFavoritesStore } from '../stores/league-favorites.store.js'
import type { Match, MatchDateGroup, MatchOutcome, MatchStage, MatchStatus } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'
import TeamBadge from '../components/TeamBadge.vue'
import SpecialPendingBanner from '../components/SpecialPendingBanner.vue'
import { usePendingSpecialTips } from '../composables/usePendingSpecialTips.js'

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

const FUTURE_DAYS = 7
const showFutureMatches = ref(false)
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
const finishedSectionOpen = ref(false)

function toggleFinishedSection(): void {
  finishedSectionOpen.value = !finishedSectionOpen.value
  try {
    localStorage.setItem(LS_KEY, String(finishedSectionOpen.value))
  } catch {
    // ignore
  }
}

const cutoffDate = new Date(now.value)
cutoffDate.setDate(cutoffDate.getDate() + FUTURE_DAYS)
const cutoffStr = cutoffDate.toISOString().substring(0, 10)

function isFinishedDay(group: MatchDateGroup): boolean {
  return group.matches.every(m => m.status === 'finished' || m.status === 'cancelled')
}

const finishedDayGroups = computed((): MatchDateGroup[] =>
  matchesStore.matchesByDate.filter(g => isFinishedDay(g)),
)

const finishedMatchCount = computed((): number =>
  finishedDayGroups.value.reduce((sum, g) => sum + g.matches.length, 0),
)

const upcomingDayGroups = computed((): MatchDateGroup[] =>
  matchesStore.matchesByDate.filter(g => !isFinishedDay(g)),
)

const visibleUpcomingGroups = computed((): MatchDateGroup[] => {
  if (showFutureMatches.value) return upcomingDayGroups.value
  return upcomingDayGroups.value.filter(g => g.date <= cutoffStr || g.matches.some(m => m.status !== 'scheduled'))
})

const hiddenFutureCount = computed((): number => {
  return upcomingDayGroups.value
    .filter(g => g.date > cutoffStr && g.matches.every(m => m.status === 'scheduled'))
    .reduce((sum, g) => sum + g.matches.length, 0)
})

const inputOrder = computed((): Array<{ matchId: string; side: 'home' | 'away' }> => {
  const order: Array<{ matchId: string; side: 'home' | 'away' }> = []
  for (const group of upcomingDayGroups.value) {
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
  return new Date(iso).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}
</script>
