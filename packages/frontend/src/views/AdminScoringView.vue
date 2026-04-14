<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Pontrendszer beállítása</h1>
    </div>
    <div class="flex gap-2 mb-6">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
    </div>

    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <div v-if="store.isLoading" data-testid="spinner" class="text-center py-8 text-gray-500">
      Betöltés…
    </div>

    <form
      v-else-if="store.config"
      data-testid="scoring-form"
      class="max-w-md space-y-4"
      @submit.prevent="submitForm"
    >
      <div v-for="field in fields" :key="field.key" class="flex items-center justify-between gap-4">
        <label class="text-sm font-medium text-gray-700">{{ field.label }}</label>
        <input
          v-model.number="draft[field.key]"
          :data-testid="`field-${field.key}`"
          type="number"
          min="0"
          max="10"
          required
          class="w-20 border rounded px-2 py-1 text-center"
        />
      </div>

      <div class="flex items-center gap-4 pt-2">
        <button
          type="submit"
          data-testid="submit-btn"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          :disabled="store.saveStatus === 'saving'"
        >
          Mentés
        </button>
        <span
          v-if="store.saveStatus === 'saved'"
          data-testid="save-status"
          class="text-sm text-green-600"
        >
          Elmentve!
        </span>
        <span
          v-else-if="store.saveStatus === 'error'"
          data-testid="save-status"
          class="text-sm text-red-600"
        >
          Hiba a mentés során
        </span>
      </div>
    </form>
  </AppLayout>
</template>

<script setup lang="ts">
import { reactive, watch, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useAdminScoringStore } from '../stores/admin-scoring.store.js'
import type { ScoringConfigInput } from '../types/index.js'

const store = useAdminScoringStore()

const fields: Array<{ key: keyof ScoringConfigInput; label: string }> = [
  { key: 'exactScore', label: 'Pontos találat' },
  { key: 'correctWinnerAndDiff', label: 'Helyes győztes + gólkülönbség' },
  { key: 'correctWinner', label: 'Helyes győztes' },
  { key: 'correctDraw', label: 'Döntetlen tipp döntetlenre' },
  { key: 'correctOutcome', label: 'Outcome bónusz (hossz./tizenegyes)' },
  { key: 'incorrect', label: 'Helytelen tipp' },
]

type DraftConfig = {
  exactScore: number
  correctWinnerAndDiff: number
  correctWinner: number
  correctDraw: number
  correctOutcome: number
  incorrect: number
}

const draft = reactive<DraftConfig>({
  exactScore: 0,
  correctWinnerAndDiff: 0,
  correctWinner: 0,
  correctDraw: 0,
  correctOutcome: 0,
  incorrect: 0,
})

watch(
  () => store.config,
  (cfg) => {
    if (!cfg) return
    draft.exactScore = cfg.exactScore
    draft.correctWinnerAndDiff = cfg.correctWinnerAndDiff
    draft.correctWinner = cfg.correctWinner
    draft.correctDraw = cfg.correctDraw
    draft.correctOutcome = cfg.correctOutcome
    draft.incorrect = cfg.incorrect
  },
  { immediate: true },
)

async function submitForm(): Promise<void> {
  await store.updateConfig({ ...draft })
}

onMounted(() => {
  void store.fetchConfig()
})
</script>
