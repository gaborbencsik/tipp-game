<script setup lang="ts">
import { computed } from 'vue'
import SupporterBadge from './SupporterBadge.vue'
import OutcomeAfterDrawBadge from './OutcomeAfterDrawBadge.vue'
import { resolveOutcomeAfterDrawStatus, isKnockoutStage } from '../lib/outcomeAfterDrawStatus.js'
import type { MatchPrediction, MatchResult, MatchStage, MatchTeam } from '../types/index.js'

const props = defineProps<{
  predictions: MatchPrediction[]
  currentUserId: string
  // UX-043: knockout meccsek esetén a "döntetlen esetén továbbjutó" tipp megjelenítéséhez.
  // Mind a négy prop együtt kell — bármelyik hiánya kikapcsolja a badge megjelenítését
  // (visszafelé-kompatibilitás a csoportkörös használattal).
  stage?: MatchStage
  result?: MatchResult | null
  homeTeam?: MatchTeam
  awayTeam?: MatchTeam
  extraTimeBonusPoints?: number
}>()

function isExactMatch(p: MatchPrediction): boolean {
  return p.pointsResult === 3
}

function isCurrentUser(p: MatchPrediction): boolean {
  return p.userId === props.currentUserId
}

function scorerChipClass(p: MatchPrediction): string {
  if (p.scorerBonusPoints !== null && p.scorerBonusPoints > 0) {
    return 'text-green-700 bg-green-50 font-medium'
  }
  return 'text-gray-600 bg-gray-50'
}

const showOutcomeBadges = computed((): boolean => {
  return props.stage !== undefined
    && props.homeTeam !== undefined
    && props.awayTeam !== undefined
    && isKnockoutStage(props.stage)
})

function outcomeStatus(p: MatchPrediction) {
  return resolveOutcomeAfterDrawStatus({
    stage: props.stage!,
    result: props.result ?? null,
    predictionOutcome: p.outcomeAfterDraw,
  })
}

// A scoring service azt a +N pontot adja, amit a config `extraTimeBonusPoints`-ja előír.
// Ha a parent megadja, mi a sor pontjából vonatkoztatva a badge-be írjuk.
function bonusForRow(p: MatchPrediction): number | null {
  if (props.extraTimeBonusPoints !== undefined) return props.extraTimeBonusPoints
  // Fallback: ha a pointsResult ismert, jelezzük csak hogy "+pont" — konkrét érték nélkül a 1 ésszerű alapérték.
  return p.pointsResult !== null && p.pointsResult > 0 ? 1 : null
}
</script>

<template>
  <section class="bg-white rounded-lg shadow-sm border p-4">
    <h2 class="text-lg font-semibold mb-3">{{ $t('matchPredictions.title') }}</h2>
    <ul class="space-y-1">
      <li
        v-for="p in predictions"
        :key="p.userId"
        :data-testid="`prediction-row-${p.userId}`"
        class="px-3 py-2 rounded-md border-l-4"
        :class="[
          isExactMatch(p) ? 'border-green-500 bg-green-50' : 'border-transparent',
          isCurrentUser(p) ? 'ring-2 ring-blue-300 bg-blue-50' : '',
        ]"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-sm flex-1 inline-flex items-center gap-1 min-w-0">
            <span class="truncate">{{ p.displayName }}</span>
            <span
              v-if="p.isPaid"
              data-testid="match-prediction-paid-badge"
              aria-label="Paid"
              class="inline-flex items-center justify-center bg-amber-50 ring-1 ring-amber-200 rounded-full w-5 h-5 text-xs leading-none shrink-0"
            >💰</span>
            <SupporterBadge
              v-if="p.isSupporter"
              size="xs"
              testid="match-prediction-supporter-badge"
            />
            <span
              v-if="p.scorerPlayerNameSnapshot"
              :data-testid="`prediction-row-scorer-${p.userId}`"
              class="hidden sm:inline-flex items-center text-xs px-1.5 py-0.5 rounded shrink min-w-0 truncate"
              :class="scorerChipClass(p)"
            >⚽&nbsp;<span class="truncate">{{ p.scorerPlayerNameSnapshot }}</span></span>
          </span>
          <span class="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded shrink-0">
            {{ p.homeGoals }} – {{ p.awayGoals }}
          </span>
          <span
            class="text-sm font-semibold min-w-[4rem] text-right shrink-0"
            :class="isExactMatch(p) ? 'text-green-700' : 'text-gray-600'"
          >
            {{ $t('matchPredictions.points', { n: p.pointsResult ?? '–' }) }}
          </span>
        </div>
        <div
          v-if="p.scorerPlayerNameSnapshot"
          :data-testid="`prediction-row-scorer-mobile-${p.userId}`"
          class="mt-1 inline-flex items-center text-xs px-1.5 py-0.5 rounded sm:hidden"
          :class="scorerChipClass(p)"
        >
          ⚽ {{ p.scorerPlayerNameSnapshot }}
        </div>
        <div
          v-if="showOutcomeBadges"
          class="mt-1 flex flex-wrap"
        >
          <OutcomeAfterDrawBadge
            :status="outcomeStatus(p)"
            :prediction-outcome="p.outcomeAfterDraw"
            :home-team="homeTeam!"
            :away-team="awayTeam!"
            :bonus-points="bonusForRow(p)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
