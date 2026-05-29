import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { SpecialPredictionWithType, SpecialPredictionInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export const useTournamentTipsStore = defineStore('tournamentTips', () => {
  const tips = ref<SpecialPredictionWithType[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const saveStatusByTypeId = ref<Record<string, SaveStatus>>({})
  const hasAccess = ref<boolean | null>(null)

  async function fetchAccess(): Promise<void> {
    try {
      const token = await getAccessToken()
      const result = await api.tournamentTips.access(token)
      hasAccess.value = result.hasAccess
    } catch {
      hasAccess.value = false
    }
  }

  async function fetchTips(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      tips.value = await api.tournamentTips.list(token)
      hasAccess.value = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      if (msg.toLowerCase().includes('no tournament access')) {
        hasAccess.value = false
        tips.value = []
      } else {
        error.value = msg
      }
    } finally {
      isLoading.value = false
    }
  }

  async function upsertTip(input: SpecialPredictionInput): Promise<void> {
    saveStatusByTypeId.value[input.typeId] = 'saving'
    try {
      const token = await getAccessToken()
      const updated = await api.tournamentTips.upsert(token, input)
      tips.value = tips.value.map(t => t.typeId === input.typeId ? updated : t)
      saveStatusByTypeId.value[input.typeId] = 'saved'
    } catch (err) {
      saveStatusByTypeId.value[input.typeId] = 'error'
      throw err
    }
  }

  function reset(): void {
    tips.value = []
    error.value = null
    saveStatusByTypeId.value = {}
    hasAccess.value = null
  }

  return {
    tips,
    isLoading,
    error,
    saveStatusByTypeId,
    hasAccess,
    fetchAccess,
    fetchTips,
    upsertTip,
    reset,
  }
})
