import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { SpecialPredictionType, SpecialTypeInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminGlobalTypesStore = defineStore('admin-global-types', () => {
  const globalTypes = ref<SpecialPredictionType[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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

  async function createGlobalType(input: SpecialTypeInput): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const created = await api.admin.globalSpecialTypes.create(token, input)
      globalTypes.value = [...globalTypes.value, created]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  async function updateGlobalType(typeId: string, input: Partial<SpecialTypeInput>): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.globalSpecialTypes.update(token, typeId, input)
      globalTypes.value = globalTypes.value.map(t => (t.id === typeId ? updated : t))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  async function deactivateGlobalType(typeId: string): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      await api.admin.globalSpecialTypes.deactivate(token, typeId)
      globalTypes.value = globalTypes.value.filter(t => t.id !== typeId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  async function evaluateGlobalType(typeId: string, correctAnswer: string): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.globalSpecialTypes.setAnswer(token, typeId, correctAnswer)
      globalTypes.value = globalTypes.value.map(t => (t.id === typeId ? updated : t))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  return { globalTypes, isLoading, error, fetchGlobalTypes, createGlobalType, updateGlobalType, deactivateGlobalType, evaluateGlobalType }
})
