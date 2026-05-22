<template>
  <AppLayout>
    <div class="flex items-center justify-between gap-3 mb-6 flex-wrap">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('myStats.title') }}</h1>
      <select
        v-if="userLeagues.length > 1"
        :value="matchesStore.leagueFilter ?? ''"
        class="h-10 px-3 text-sm text-gray-900 bg-gray-50 border border-gray-300 rounded-lg transition-all duration-150 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-500/10 focus:outline-none"
        data-testid="league-filter"
        @change="matchesStore.leagueFilter = ($event.target as HTMLSelectElement).value || null"
      >
        <option value="">{{ $t('matches.allLeagues') }}</option>
        <option v-for="league in userLeagues" :key="league.id" :value="league.id">
          {{ league.name }}
        </option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div v-for="n in 4" :key="n" class="h-24 bg-gray-100 rounded-xl animate-pulse" />
      </div>
      <div class="h-6 bg-gray-100 rounded-lg animate-pulse" />
      <div class="space-y-2">
        <div v-for="n in 5" :key="n" class="h-16 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    </div>

    <!-- Empty: no predictions at all -->
    <div
      v-else-if="stats.submittedCount === 0 && stats.totalAvailable > 0"
      class="bg-white border border-gray-200 rounded-xl p-8 text-center"
    >
      <div class="text-4xl mb-3">⚽</div>
      <p class="text-gray-700 mb-4">{{ $t('myStats.emptyState') }}</p>
      <router-link
        to="/app/matches"
        class="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
      >
        {{ $t('myStats.goToMatches') }}
      </router-link>
    </div>

    <div v-else class="space-y-6">
      <!-- KPI cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          :label="$t('myStats.submitted')"
          :value="stats.submittedCount"
          :suffix="`/ ${stats.totalAvailable}`"
          icon="📝"
        />
        <KpiCard
          :label="$t('myStats.totalPoints')"
          :value="stats.totalPoints"
          icon="🎯"
        />
        <KpiCard
          :label="$t('myStats.accuracy')"
          :value="stats.evaluatedCount === 0 ? '—' : stats.accuracyPercent + '%'"
          :hint="stats.evaluatedCount === 0 ? $t('myStats.noEvaluated') : `${stats.correctCount}/${stats.evaluatedCount}`"
          :tone="stats.accuracyPercent >= 50 ? 'positive' : 'default'"
          icon="✅"
        />
        <KpiCard
          :label="streakLabel"
          :value="streakValue"
          :hint="streakHint"
          :tone="streakTone"
          icon="🔥"
        />
      </div>

      <!-- Distribution bar -->
      <div v-if="stats.evaluatedCount > 0 || stats.distribution.missed > 0">
        <PointDistributionBar
          :distribution="stats.distribution"
          :labels="distributionLabels"
        />
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="shrink-0 px-3 py-1.5 text-sm font-medium rounded-full border transition-colors flex items-center gap-1.5"
          :class="activeFilter === f.key ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'"
          :data-testid="`filter-chip-${f.key}`"
          @click="activeFilter = f.key"
        >
          {{ f.label }}
          <span
            class="text-xs font-normal px-1.5 py-0.5 rounded-full"
            :class="activeFilter === f.key ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500'"
          >{{ f.count }}</span>
        </button>
      </div>

      <!-- List -->
      <div v-if="filteredItems.length === 0" class="text-center py-10 text-gray-500">
        <p class="mb-3">{{ $t('myStats.noFilterResults') }}</p>
        <button
          v-if="activeFilter !== 'all'"
          type="button"
          class="text-sm font-medium text-blue-600 hover:text-blue-700"
          @click="activeFilter = 'all'"
        >
          {{ $t('myStats.resetFilter') }}
        </button>
      </div>

      <div v-else class="space-y-2 max-w-3xl" data-testid="prediction-list">
        <PredictionListItem
          v-for="item in filteredItems"
          :key="item.match.id"
          :match="item.match"
          :prediction="item.prediction"
          :scoring-config="scoringConfig"
          :points-label="$t('myStats.points')"
          :missed-label="$t('myStats.missedShort')"
          data-testid="prediction-item"
          @click="goToMatch(item.match.id)"
        />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import KpiCard from '../components/dashboard/KpiCard.vue'
import PointDistributionBar from '../components/dashboard/PointDistributionBar.vue'
import PredictionListItem from '../components/dashboard/PredictionListItem.vue'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import { useGroupsStore } from '../stores/groups.store.js'
import { useMyStats, type ScoringBuckets } from '../composables/useMyStats.js'
import { useLeagueFilter } from '../composables/useLeagueFilter.js'
import { api } from '../api/index.js'
import { supabase } from '../lib/supabase.js'
import type { Match, Prediction } from '../types/index.js'

type FilterKey = 'all' | 'correct' | 'exact' | 'zero' | 'missed'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

const { t } = useI18n()
const router = useRouter()
const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()
const groupsStore = useGroupsStore()

const scoringConfig = ref<ScoringBuckets | null>(null)
const activeFilter = ref<FilterKey>('all')

const isLoading = computed(() => matchesStore.isLoading || predictionsStore.isLoading)

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

interface UserLeague {
  readonly id: string
  readonly name: string
  readonly shortName: string
}

const userLeagues = computed<readonly UserLeague[]>(() => {
  const seen = new Map<string, UserLeague>()
  for (const g of groupsStore.groups) {
    if (g.league && !seen.has(g.league.id)) seen.set(g.league.id, g.league)
  }
  return [...seen.values()]
})

const userLeagueIds = computed<readonly string[]>(() => userLeagues.value.map(l => l.id))
const { initFromStorage: initLeagueFilterFromStorage } = useLeagueFilter(userLeagueIds)

onMounted(async () => {
  const tasks: Promise<unknown>[] = []
  if (matchesStore.matches.length === 0) tasks.push(matchesStore.fetchMatches())
  if (predictionsStore.predictions.length === 0) tasks.push(predictionsStore.fetchMyPredictions())
  if (groupsStore.groups.length === 0) tasks.push(groupsStore.fetchMyGroups())
  tasks.push(loadScoringConfig())
  await Promise.all(tasks)
  initLeagueFilterFromStorage()
})

async function loadScoringConfig(): Promise<void> {
  try {
    const token = await getAccessToken()
    const config = await api.scoringConfig.default(token)
    scoringConfig.value = {
      exactScore: config.exactScore,
      correctWinnerAndDiff: config.correctWinnerAndDiff,
      correctWinner: config.correctWinner,
      correctDraw: config.correctDraw,
      correctOutcome: config.correctOutcome,
      incorrect: config.incorrect,
    }
  } catch {
    scoringConfig.value = null
  }
}

const matchesRef = computed(() => {
  const leagueId = matchesStore.leagueFilter
  if (!leagueId) return matchesStore.matches
  return matchesStore.matches.filter(m => m.league?.id === leagueId)
})
const predictionsRef = computed(() => predictionsStore.predictions)

const stats = useMyStats({
  predictions: predictionsRef,
  matches: matchesRef,
  scoringConfig,
})

const distributionLabels = computed(() => ({
  exact: t('myStats.distExact'),
  winnerAndDiff: t('myStats.distWinnerAndDiff'),
  winner: t('myStats.distWinner'),
  draw: t('myStats.distDraw'),
  incorrect: t('myStats.distZero'),
  missed: t('myStats.distMissed'),
}))

const streakValue = computed(() => {
  const v = stats.value.currentStreak
  if (v === 0) return '—'
  return Math.abs(v).toString()
})

const streakLabel = computed(() => t('myStats.currentStreak'))

const streakHint = computed(() => {
  if (stats.value.currentStreak === 0) return `${t('myStats.bestStreak')}: ${stats.value.bestStreak}`
  return stats.value.currentStreak > 0 ? t('myStats.currentStreakHint') : t('myStats.currentStreakHintNeg')
})

const streakTone = computed<'positive' | 'negative' | 'neutral'>(() => {
  if (stats.value.currentStreak > 0) return 'positive'
  if (stats.value.currentStreak < 0) return 'negative'
  return 'neutral'
})

interface ListItem {
  readonly match: Match
  readonly prediction: Prediction | null
}

const allItems = computed<ListItem[]>(() => {
  const predByMatch = new Map(predictionsStore.predictions.map(p => [p.matchId, p] as const))
  const items: ListItem[] = []
  for (const match of matchesRef.value) {
    const pred = predByMatch.get(match.id) ?? null
    if (pred || match.status === 'finished' || match.status === 'live') {
      items.push({ match, prediction: pred })
    }
  }
  items.sort((a, b) => new Date(b.match.scheduledAt).getTime() - new Date(a.match.scheduledAt).getTime())
  return items
})

function matchesFilter(item: ListItem, key: FilterKey): boolean {
  const p = item.prediction
  switch (key) {
    case 'all':
      return true
    case 'correct':
      return !!p && p.pointsGlobal !== null && p.pointsGlobal > 0
    case 'exact':
      if (!p || p.pointsGlobal === null) return false
      const exact = scoringConfig.value?.exactScore
      if (exact !== undefined) return p.pointsGlobal === exact
      const max = Math.max(...predictionsStore.predictions.map(x => x.pointsGlobal ?? 0))
      return p.pointsGlobal === max && max > 0
    case 'zero':
      return !!p && p.pointsGlobal === 0
    case 'missed':
      return !p && item.match.status === 'finished'
  }
}

const filteredItems = computed(() => allItems.value.filter(item => matchesFilter(item, activeFilter.value)))

const filters = computed(() => ([
  { key: 'all' as const, label: t('myStats.filterAll'), count: allItems.value.filter(i => matchesFilter(i, 'all')).length },
  { key: 'correct' as const, label: t('myStats.filterCorrect'), count: allItems.value.filter(i => matchesFilter(i, 'correct')).length },
  { key: 'exact' as const, label: t('myStats.filterExact'), count: allItems.value.filter(i => matchesFilter(i, 'exact')).length },
  { key: 'zero' as const, label: t('myStats.filterZero'), count: allItems.value.filter(i => matchesFilter(i, 'zero')).length },
  { key: 'missed' as const, label: t('myStats.filterMissed'), count: allItems.value.filter(i => matchesFilter(i, 'missed')).length },
]))

function goToMatch(matchId: string): void {
  router.push(`/app/matches/${matchId}`)
}
</script>
