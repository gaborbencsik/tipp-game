import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { ScoringConfigFull, ScoringConfigInput, ScoringConfigWithImpact, ScoringOverrideInput, RecalcStatus } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type RecalcRunState = 'idle' | 'starting' | 'running' | 'error'

export const useAdminScoringStore = defineStore('admin-scoring', () => {
  const config = ref<ScoringConfigWithImpact | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('idle')
  const recalcStatus = ref<RecalcStatus>({ status: 'idle', lastResult: null })
  const recalcRunState = ref<RecalcRunState>('idle')
  const conflictError = ref<string | null>(null)

  const isFrozen = computed(() => Boolean(config.value?.frozenAt))

  async function fetchConfig(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      config.value = await api.admin.scoringConfig.get(token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function updateConfig(input: ScoringConfigInput): Promise<void> {
    saveStatus.value = 'saving'
    error.value = null
    conflictError.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.scoringConfig.update(token, input)
      mergeUpdated(updated)
      saveStatus.value = 'saved'
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
      if (message.includes('frozen')) {
        conflictError.value = message
        await fetchConfig()
      } else {
        error.value = message
      }
      saveStatus.value = 'error'
    }
  }

  async function overrideConfig(input: ScoringOverrideInput): Promise<void> {
    saveStatus.value = 'saving'
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.scoringConfig.override(token, input)
      mergeUpdated(updated)
      saveStatus.value = 'saved'
      if (input.recalculate) {
        recalcRunState.value = 'running'
        await fetchRecalcStatus()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
      saveStatus.value = 'error'
    }
  }

  async function triggerRecalculate(): Promise<void> {
    recalcRunState.value = 'starting'
    try {
      const token = await getAccessToken()
      await api.admin.scoring.recalculateAll(token)
      recalcRunState.value = 'running'
      await fetchRecalcStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
      conflictError.value = message
      recalcRunState.value = 'error'
    }
  }

  async function fetchRecalcStatus(): Promise<void> {
    try {
      const token = await getAccessToken()
      recalcStatus.value = await api.admin.scoring.recalculateStatus(token)
      if (recalcStatus.value.status === 'idle') {
        recalcRunState.value = 'idle'
        await fetchConfig()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  function mergeUpdated(updated: ScoringConfigFull): void {
    config.value = {
      ...updated,
      affectedMatches: config.value?.affectedMatches ?? 0,
      affectedPredictions: config.value?.affectedPredictions ?? 0,
    }
  }

  return {
    config,
    isLoading,
    error,
    saveStatus,
    recalcStatus,
    recalcRunState,
    conflictError,
    isFrozen,
    fetchConfig,
    updateConfig,
    overrideConfig,
    triggerRecalculate,
    fetchRecalcStatus,
  }
})
