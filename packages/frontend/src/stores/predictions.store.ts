import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from './auth.store.js'
import { api } from '../api/index.js'
import type { Prediction, PredictionInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const usePredictionsStore = defineStore('predictions', () => {
  const predictions = ref<Prediction[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const saveStatus = ref<Record<string, 'saving' | 'saved' | 'error'>>({})

  const predictionByMatchId = computed(
    () => (matchId: string): Prediction | undefined =>
      predictions.value.find(p => p.matchId === matchId)
  )

  async function fetchMyPredictions(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      const authStore = useAuthStore()
      const userId = authStore.user?.id ?? ''
      predictions.value = await api.predictions.mine(token, userId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function upsertPrediction(input: PredictionInput): Promise<void> {
    saveStatus.value = { ...saveStatus.value, [input.matchId]: 'saving' }
    error.value = null
    try {
      const token = await getAccessToken()
      const saved = await api.predictions.upsert(token, input)
      const idx = predictions.value.findIndex(p => p.matchId === input.matchId)
      if (idx >= 0) {
        predictions.value = predictions.value.map((p, i) => i === idx ? saved : p)
      } else {
        predictions.value = [...predictions.value, saved]
      }
      saveStatus.value = { ...saveStatus.value, [input.matchId]: 'saved' }
    } catch (err) {
      saveStatus.value = { ...saveStatus.value, [input.matchId]: 'error' }
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  return {
    predictions,
    isLoading,
    error,
    saveStatus,
    predictionByMatchId,
    fetchMyPredictions,
    upsertPrediction,
  }
})
