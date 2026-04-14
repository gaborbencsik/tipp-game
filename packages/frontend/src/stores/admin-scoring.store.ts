import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { ScoringConfigFull, ScoringConfigInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export const useAdminScoringStore = defineStore('admin-scoring', () => {
  const config = ref<ScoringConfigFull | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const saveStatus = ref<SaveStatus>('idle')

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
    try {
      const token = await getAccessToken()
      config.value = await api.admin.scoringConfig.update(token, input)
      saveStatus.value = 'saved'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
      saveStatus.value = 'error'
    }
  }

  return { config, isLoading, error, saveStatus, fetchConfig, updateConfig }
})
