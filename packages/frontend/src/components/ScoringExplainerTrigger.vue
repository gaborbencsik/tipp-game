<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useScoringExplainerStore, type ScoringExplainerSource } from '../stores/scoring-explainer.store.js'

interface Props {
  source: ScoringExplainerSource
  variant?: 'icon' | 'link'
  label?: string
}

const props = withDefaults(defineProps<Props>(), { variant: 'icon' })
const store = useScoringExplainerStore()
const { t } = useI18n()

function handleClick(): void {
  void store.open(props.source)
}
</script>

<template>
  <button
    v-if="variant === 'icon'"
    type="button"
    class="inline-flex w-4 h-4 rounded-full border border-blue-600 text-blue-600 items-center justify-center text-[10px] font-bold italic cursor-pointer hover:bg-blue-50"
    :aria-label="t('scoringExplainer.trigger.iconAria')"
    :data-testid="`scoring-explainer-trigger-${source}`"
    @click="handleClick"
  >
    i
  </button>
  <button
    v-else
    type="button"
    class="inline-flex items-center gap-1.5 text-blue-700 font-medium text-sm hover:underline"
    :data-testid="`scoring-explainer-trigger-${source}`"
    @click="handleClick"
  >
    <span class="inline-flex w-4 h-4 rounded-full border border-current items-center justify-center text-[10px] font-bold italic">i</span>
    {{ label ?? t('scoringExplainer.trigger.leaderboard') }}
  </button>
</template>
