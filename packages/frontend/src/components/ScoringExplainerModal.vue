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

const diffGroups = computed(() => {
  if (!data.value) return []
  if (singleGroup.value) return []
  const def = data.value.default
  return groups.value
    .map(g => {
      const diffs = RULE_KEYS.filter(k => g.config[k] !== def[k]).map(k => ({
        key: k,
        groupValue: g.config[k],
        defaultValue: def[k],
      }))
      return { group: g, diffs }
    })
    .filter(x => x.diffs.length > 0)
})

const bonusGroups = computed(() => groups.value.filter(g => g.favoriteTeamDoublePoints))
const showBonus = computed(() => bonusGroups.value.length > 0)

const specialGroupOwned = computed(() => {
  const out: Array<{ groupName: string; types: typeof groups.value[0]['specialTypes'] }> = []
  for (const g of groups.value) {
    const owned = g.specialTypes.filter(s => s.source === 'group')
    if (owned.length > 0) out.push({ groupName: g.name, types: owned })
  }
  return out
})

const specialSubscribed = computed(() => {
  const seen = new Map<string, typeof groups.value[0]['specialTypes'][number]>()
  for (const g of groups.value) {
    for (const s of g.specialTypes) {
      if (s.source === 'global' && !seen.has(s.id)) seen.set(s.id, s)
    }
  }
  return Array.from(seen.values())
})

const hasSpecials = computed(() => specialGroupOwned.value.length > 0 || specialSubscribed.value.length > 0)

function pointsPillClass(value: number): string {
  if (value > 0) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (value < 0) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="close"
  >
      <div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <div class="mb-4 flex items-start justify-between gap-4">
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ headerTitle }}</h2>
            <span
              v-if="isFrozen"
              data-testid="scoring-explainer-frozen"
              :title="t('scoringExplainer.frozenTooltip')"
              aria-label="frozen"
            >🔒</span>
          </div>
          <button
            type="button"
            class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            :aria-label="t('scoringExplainer.close')"
            @click="close"
          >✕</button>
        </div>
        <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">{{ subtitle }}</p>

        <section class="mb-6">
          <h3 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('scoringExplainer.matchScoring') }}
          </h3>
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 text-left dark:border-gray-700">
                <th class="py-2 font-medium">{{ t('scoringExplainer.columns.case') }}</th>
                <th class="py-2 font-medium">{{ t('scoringExplainer.columns.points') }}</th>
                <th class="py-2 font-medium">{{ t('scoringExplainer.columns.example') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="key in RULE_KEYS" :key="key" class="border-b border-gray-100 dark:border-gray-800">
                <td class="py-2 text-gray-900 dark:text-gray-100">{{ t(`scoringExplainer.rules.${key}`) }}</td>
                <td class="py-2">
                  <span
                    class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="pointsPillClass(displayConfig?.[key] ?? 0)"
                  >{{ displayConfig?.[key] ?? 0 }}</span>
                </td>
                <td class="py-2 text-xs text-gray-600 dark:text-gray-400">
                  {{ t(`scoringExplainer.examples.${key}`) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section v-if="diffGroups.length > 0" class="mb-6 space-y-3">
          <div
            v-for="entry in diffGroups"
            :key="entry.group.id"
            class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/20"
          >
            <h4 class="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
              {{ t('scoringExplainer.diffBadge', { groupName: entry.group.name }) }}
            </h4>
            <ul class="space-y-1 text-xs">
              <li v-for="d in entry.diffs" :key="d.key" class="flex items-center gap-2">
                <span class="text-gray-700 dark:text-gray-300">{{ t(`scoringExplainer.rules.${d.key}`) }}:</span>
                <span class="text-gray-500 line-through">{{ d.defaultValue }}</span>
                <span class="font-semibold text-amber-900 dark:text-amber-200">→ {{ d.groupValue }}</span>
              </li>
            </ul>
          </div>
        </section>

        <section v-if="showBonus" class="mb-6">
          <h3 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('scoringExplainer.bonus.heading') }}
          </h3>
          <div class="rounded-md border border-violet-200 bg-violet-50 p-3 dark:border-violet-800/50 dark:bg-violet-900/20">
            <p class="font-medium text-violet-900 dark:text-violet-200">
              {{ t('scoringExplainer.bonus.favoriteTeamTitle') }}
            </p>
            <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
              {{ t('scoringExplainer.bonus.favoriteTeamDesc') }}
            </p>
            <p v-if="groups.length > 1" class="mt-2 text-xs text-gray-600 dark:text-gray-400">
              {{ t('scoringExplainer.bonus.active', { groups: bonusGroups.map(g => g.name).join(', ') }) }}
            </p>
          </div>
        </section>

        <section v-if="hasSpecials" class="mb-6">
          <h3 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">
            {{ t('scoringExplainer.special.heading') }}
          </h3>
          <div v-for="entry in specialGroupOwned" :key="entry.groupName" class="mb-3">
            <h4 class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{{ entry.groupName }}</h4>
            <ul class="space-y-1 text-sm">
              <li v-for="s in entry.types" :key="s.id" class="flex items-center justify-between">
                <span class="text-gray-900 dark:text-gray-100">{{ s.label }}</span>
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="pointsPillClass(s.points)"
                >{{ s.points }}</span>
              </li>
            </ul>
          </div>
          <ul v-if="specialSubscribed.length > 0" class="space-y-1 text-sm">
            <li v-for="s in specialSubscribed" :key="s.id" class="flex items-center justify-between">
              <span class="text-gray-900 dark:text-gray-100">{{ s.label }}</span>
              <span
                class="inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="pointsPillClass(s.points)"
              >{{ s.points }}</span>
            </li>
          </ul>
        </section>

        <p class="mb-4 text-xs text-gray-500 dark:text-gray-500">{{ t('scoringExplainer.footnote') }}</p>

        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            @click="close"
          >{{ t('scoringExplainer.ack') }}</button>
        </div>
      </div>
  </div>
</template>
