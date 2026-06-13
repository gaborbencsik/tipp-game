import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { SpecialPredictionType } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export interface EvaluationRunResult {
  readonly evaluatedCount: number
  readonly totalPoints: number
  readonly lastRunAt: string
}

export const useAdminTournamentEvaluationStore = defineStore('admin-tournament-evaluation', () => {
  const globalTypes = ref<SpecialPredictionType[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Last run-at per `${typeId}::${slice ?? 'all'}` — drives the "Legutóbb futott: …" hint. */
  const lastRunBySliceKey = ref<Record<string, EvaluationRunResult>>({})

  function sliceKey(typeId: string, slice: string | null): string {
    return `${typeId}::${slice ?? 'all'}`
  }

  async function fetchGlobalTypes(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      globalTypes.value = await api.admin.globalSpecialTypes.list(token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function setCorrectAnswer(typeId: string, correctAnswer: string): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.globalSpecialTypes.setCorrectAnswer(token, typeId, correctAnswer)
      globalTypes.value = globalTypes.value.map(t => (t.id === typeId ? updated : t))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
      throw err
    }
  }

  async function evaluate(typeId: string, slice: string | null): Promise<EvaluationRunResult> {
    error.value = null
    try {
      const token = await getAccessToken()
      const result = await api.admin.globalSpecialTypes.evaluate(token, typeId, slice)
      lastRunBySliceKey.value = { ...lastRunBySliceKey.value, [sliceKey(typeId, slice)]: result }
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
      throw err
    }
  }

  return {
    globalTypes,
    isLoading,
    error,
    lastRunBySliceKey,
    sliceKey,
    fetchGlobalTypes,
    setCorrectAnswer,
    evaluate,
  }
})
