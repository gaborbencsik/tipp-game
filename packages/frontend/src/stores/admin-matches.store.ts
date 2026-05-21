import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { useToastStore } from './toast.store.js'
import type { Match, MatchInput, MatchResultInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminMatchesStore = defineStore('admin-matches', () => {
  const matches = ref<Match[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMatches(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      matches.value = await api.matches.list(token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function createMatch(input: MatchInput): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      await api.admin.matches.create(token, input)
      await fetchMatches()
      toast.addToast('Mérkőzés létrehozva', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function updateMatch(id: string, input: Partial<MatchInput>): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      await api.admin.matches.update(token, id, input)
      await fetchMatches()
      toast.addToast('Mérkőzés frissítve', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function deleteMatch(id: string): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      await api.admin.matches.delete(token, id)
      matches.value = matches.value.filter(m => m.id !== id)
      toast.addToast('Mérkőzés törölve', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function setResult(id: string, input: MatchResultInput): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      await api.admin.matches.setResult(token, id, input)
      await fetchMatches()
      toast.addToast('Eredmény elmentve', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  return { matches, isLoading, error, fetchMatches, createMatch, updateMatch, deleteMatch, setResult }
})
