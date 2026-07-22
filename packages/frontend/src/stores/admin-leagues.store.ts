import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { useToastStore } from './toast.store.js'
import type { League, LeagueInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminLeaguesStore = defineStore('admin-leagues', () => {
  const leagues = ref<League[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchLeagues(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      leagues.value = await api.admin.leagues.list(token, true)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function archiveLeague(id: string): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      const updated = await api.admin.leagues.archive(token, id)
      leagues.value = leagues.value.map(l => (l.id === id ? updated : l))
      toast.addToast('Liga archiválva', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function restoreLeague(id: string): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      const updated = await api.admin.leagues.restore(token, id)
      leagues.value = leagues.value.map(l => (l.id === id ? updated : l))
      toast.addToast('Liga visszaállítva', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function createLeague(input: LeagueInput): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      const created = await api.admin.leagues.create(token, input)
      leagues.value = [...leagues.value, created]
      toast.addToast('Liga létrehozva', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function updateLeague(id: string, input: Partial<LeagueInput>): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      const updated = await api.admin.leagues.update(token, id, input)
      leagues.value = leagues.value.map(l => (l.id === id ? updated : l))
      toast.addToast('Liga frissítve', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  return { leagues, isLoading, error, fetchLeagues, archiveLeague, restoreLeague, createLeague, updateLeague }
})
