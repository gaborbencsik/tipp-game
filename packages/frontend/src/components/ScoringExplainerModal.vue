<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useScoringExplainerStore } from '../stores/scoring-explainer.store.js'

const store = useScoringExplainerStore()
const { t } = useI18n()

type RuleKey = 'exactScore' | 'correctWinnerAndDiff' | 'correctWinner' | 'correctDraw' | 'correctOutcome' | 'incorrect'
const RULE_KEYS: readonly RuleKey[] = ['exactScore', 'correctWinnerAndDiff', 'correctWinner', 'correctDraw', 'correctOutcome', 'incorrect'] as const

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

const isFrozen = computed(() => {
  if (!data.value) return false
  if (data.value.defaultFrozenAt) return true
  return groups.value.some(g => g.configFrozenAt)
})

const displayConfig = computed(() => {
  const sg = singleGroup.value
  if (sg) return sg.config
  return data.value?.default ?? null
})

const ruleDiffs = computed<Record<RuleKey, Array<{ groupName: string; points: number }>>>(() => {
  const result = {} as Record<RuleKey, Array<{ groupName: string; points: number }>>
  for (const k of RULE_KEYS) result[k] = []
  if (!data.value || singleGroup.value || groups.value.length === 0) return result
  const def = data.value.default
  for (const g of groups.value) {
    for (const k of RULE_KEYS) {
      if (g.config[k] !== def[k]) result[k].push({ groupName: g.name, points: g.config[k] })
    }
  }
  return result
})

const bonusGroups = computed(() => groups.value.filter(g => g.favoriteTeamDoublePoints))
const showBonus = computed(() => bonusGroups.value.length > 0)

const specialGroupOwned = computed(() => {
  const out: Array<{ groupName: string; types: typeof groups.value[0]['specialTypes'] }> = []
  for (const g of groups.value) {
    const owned = g.specialTypes.filter(s => s.source === 'group-owned')
    if (owned.length > 0) out.push({ groupName: g.name, types: owned })
  }
  return out
})

const specialSubscribed = computed(() => {
  const seen = new Map<string, typeof groups.value[0]['specialTypes'][number]>()
  for (const g of groups.value) {
    for (const s of g.specialTypes) {
      if (s.source === 'subscribed-global' && !seen.has(s.id)) seen.set(s.id, s)
    }
  }
  return Array.from(seen.values())
})

const hasSpecials = computed(() => specialGroupOwned.value.length > 0 || specialSubscribed.value.length > 0)

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
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            :data-testid="isFrozen ? 'scoring-explainer-frozen' : undefined"
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            :class="isFrozen ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
            :title="isFrozen ? t('scoringExplainer.frozenTooltip') : undefined"
            :aria-label="isFrozen ? 'frozen' : undefined"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h2m4 0h2m-6-4h2m4 0h2" />
            </svg>
          </span>
          <div class="min-w-0">
            <h2 class="truncate text-base font-bold text-gray-900">{{ headerTitle }}</h2>
            <p class="mt-0.5 text-xs text-gray-500">{{ subtitle }}</p>
          </div>
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
                  v-for="key in RULE_KEYS"
                  :key="key"
                  class="border-b border-gray-100 last:border-0"
                >
                  <td class="px-3 py-2.5 text-gray-800">
                    {{ t(`scoringExplainer.rules.${key}`) }}
                    <span
                      v-for="diff in ruleDiffs[key]"
                      :key="diff.groupName"
                      class="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-700"
                    >⚠ {{ t('scoringExplainer.diffInline', { groupName: diff.groupName, points: diff.points }) }}</span>
                  </td>
                  <td class="w-20 px-3 py-2.5 text-center">
                    <span
                      class="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                      :class="pointsPillClass(displayConfig?.[key] ?? 0)"
                    >{{ displayConfig?.[key] ?? 0 }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-xs text-gray-500">
                    {{ t(`scoringExplainer.examples.${key}`) }}
                  </td>
                </tr>
              </tbody>
            </table>
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

        <div v-if="hasSpecials" class="mt-5">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            {{ t('scoringExplainer.special.heading') }}
          </h3>
          <div v-for="entry in specialGroupOwned" :key="entry.groupName">
            <div class="mb-2 mt-3 flex items-center gap-2 first:mt-0">
              <span class="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
              <span class="text-sm font-semibold text-gray-700">{{ entry.groupName }}</span>
            </div>
            <div
              v-for="s in entry.types"
              :key="s.id"
              class="mb-2 rounded-lg border border-gray-200 bg-white p-3 transition-colors last:mb-0 hover:bg-gray-50"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-800">{{ s.name }}</div>
                </div>
                <span
                  class="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                  :class="pointsPillClass(s.points)"
                >{{ s.points }}</span>
              </div>
            </div>
          </div>
          <div
            v-for="s in specialSubscribed"
            :key="s.id"
            class="mb-2 rounded-lg border border-gray-200 bg-white p-3 transition-colors last:mb-0 hover:bg-gray-50"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-medium text-gray-800">{{ s.name }}</div>
              </div>
              <span
                class="inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums"
                :class="pointsPillClass(s.points)"
              >{{ s.points }}</span>
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
          {{ t('scoringExplainer.footnote') }}
        </div>
      </div>

      <div class="flex justify-end border-t border-gray-200 bg-gray-50 px-5 py-3">
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          @click="close"
        >{{ t('scoringExplainer.ack') }}</button>
      </div>
    </div>
  </div>
</template>
