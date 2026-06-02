<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScoringExplainerStore } from '../stores/scoring-explainer.store.js'

const store = useScoringExplainerStore()
const { t } = useI18n()

type MatchRuleKey = 'correctOutcome' | 'exactBonus' | 'extraTimeBonus'
const MATCH_RULES: ReadonlyArray<{ key: MatchRuleKey; points: number; bonus: boolean }> = [
  { key: 'correctOutcome', points: 1, bonus: false },
  { key: 'exactBonus', points: 1, bonus: true },
  { key: 'extraTimeBonus', points: 1, bonus: true },
]

type TournamentKey =
  | 'groupOrder' | 'round32' | 'round16' | 'round8' | 'round4' | 'finalist' | 'champion'
const TOURNAMENT_RULES: ReadonlyArray<{ key: TournamentKey; points: number; hasDesc?: boolean }> = [
  { key: 'groupOrder', points: 3, hasDesc: true },
  { key: 'round32', points: 2 },
  { key: 'round16', points: 3 },
  { key: 'round8', points: 4 },
  { key: 'round4', points: 6 },
  { key: 'finalist', points: 8 },
  { key: 'champion', points: 10 },
]

type StatKey =
  | 'topScorerGroup' | 'lowScorerGroup' | 'mostConcededGroup' | 'leastConcededGroup' | 'topGoalscorer'
const STAT_RULES: ReadonlyArray<{ key: StatKey; points: number }> = [
  { key: 'topScorerGroup', points: 3 },
  { key: 'lowScorerGroup', points: 3 },
  { key: 'mostConcededGroup', points: 3 },
  { key: 'leastConcededGroup', points: 3 },
  { key: 'topGoalscorer', points: 5 },
]

const data = computed(() => store.data)
const groups = computed(() => store.data?.groups ?? [])
const singleGroup = computed(() => groups.value.length === 1 ? groups.value[0]! : null)

const headerTitle = computed(() => {
  const sg = singleGroup.value
  if (sg) return t('scoringExplainer.groupTitle', { groupName: sg.name })
  return t('scoringExplainer.title')
})

const subtitle = computed(() =>
  groups.value.length <= 1
    ? t('scoringExplainer.subtitleSingle')
    : t('scoringExplainer.subtitleMulti'),
)

const bonusGroups = computed(() => groups.value.filter(g => g.favoriteTeamDoublePoints))
const showBonus = computed(() => bonusGroups.value.length > 0)

function pointsPillClass(value: number): string {
  if (value === 0) return 'bg-gray-200 text-gray-600'
  return 'bg-blue-100 text-blue-700'
}

function close(): void {
  store.close()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') close()
}

watch(() => store.isOpen, (open) => {
  if (open) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="store.isOpen && data"
    role="dialog"
    aria-modal="true"
    data-testid="scoring-explainer-modal"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="close"
  >
    <div class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
      <div class="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4">
        <div class="min-w-0">
          <h2 class="truncate text-base font-bold text-gray-900">{{ headerTitle }}</h2>
          <p class="mt-0.5 text-xs text-gray-500">{{ subtitle }}</p>
        </div>
        <button
          type="button"
          data-testid="scoring-explainer-close"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
          :aria-label="t('scoringExplainer.close')"
          @click="close"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {{ t('scoringExplainer.matchScoring') }}
          </h3>
          <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 text-left text-xs text-gray-500">
                  <th class="px-3 py-2.5 font-medium">{{ t('scoringExplainer.columns.case') }}</th>
                  <th class="w-20 px-3 py-2.5 text-center font-medium">{{ t('scoringExplainer.columns.points') }}</th>
                  <th class="px-3 py-2.5 font-medium">{{ t('scoringExplainer.columns.example') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rule in MATCH_RULES"
                  :key="rule.key"
                  class="border-b border-gray-100 last:border-0"
                >
                  <td class="px-3 py-2.5 text-gray-800">
                    {{ t(`scoringExplainer.rules.${rule.key}`) }}
                  </td>
                  <td class="w-20 px-3 py-2.5 text-center">
                    <span
                      class="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                      :class="pointsPillClass(rule.points)"
                    >{{ rule.bonus ? `+${rule.points}` : rule.points }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-xs text-gray-500">
                    {{ t(`scoringExplainer.examples.${rule.key}`) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-xs italic text-gray-500">{{ t('scoringExplainer.matchScoringNote') }}</p>
        </div>

        <div class="mt-5">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {{ t('scoringExplainer.tournament.heading') }}
          </h3>
          <div
            v-for="rule in TOURNAMENT_RULES"
            :key="rule.key"
            class="mb-2 rounded-lg border border-gray-200 bg-white p-3 transition-colors last:mb-0 hover:bg-gray-50"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-800">{{ t(`scoringExplainer.tournament.${rule.key}`) }}</div>
                <div v-if="rule.hasDesc" class="mt-0.5 text-xs text-gray-500">
                  {{ t('scoringExplainer.tournament.groupOrderDesc') }}
                </div>
              </div>
              <span
                class="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                :class="pointsPillClass(rule.points)"
              >{{ rule.points }}</span>
            </div>
          </div>
        </div>

        <div class="mt-5">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {{ t('scoringExplainer.stats.heading') }}
          </h3>
          <div
            v-for="rule in STAT_RULES"
            :key="rule.key"
            class="mb-2 rounded-lg border border-gray-200 bg-white p-3 transition-colors last:mb-0 hover:bg-gray-50"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-800">{{ t(`scoringExplainer.stats.${rule.key}`) }}</div>
              </div>
              <span
                class="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                :class="pointsPillClass(rule.points)"
              >{{ rule.points }}</span>
            </div>
          </div>
        </div>

        <div v-if="showBonus" class="mt-5">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {{ t('scoringExplainer.bonus.heading') }}
          </h3>
          <div class="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3.5">
            <div class="mb-0.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900">
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {{ t('scoringExplainer.bonus.favoriteTeamTitle') }}
            </div>
            <div class="text-sm text-amber-800">{{ t('scoringExplainer.bonus.favoriteTeamDesc') }}</div>
            <div v-if="bonusGroups.length > 0" class="mt-1 text-xs italic text-amber-700">
              {{ t('scoringExplainer.bonus.active', { groups: bonusGroups.map(g => g.name).join(', ') }) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
