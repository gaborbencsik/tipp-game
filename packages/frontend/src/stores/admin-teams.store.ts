import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { useToastStore } from './toast.store.js'
import type { Team, TeamInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminTeamsStore = defineStore('admin-teams', () => {
  const teams = ref<Team[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTeams(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      teams.value = await api.admin.teams.list(token)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function createTeam(input: TeamInput): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      const created = await api.admin.teams.create(token, input)
      teams.value = [...teams.value, created]
      toast.addToast('Csapat létrehozva', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function updateTeam(id: string, input: Partial<TeamInput>): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      const updated = await api.admin.teams.update(token, id, input)
      teams.value = teams.value.map(t => (t.id === id ? updated : t))
      toast.addToast('Csapat frissítve', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  async function deleteTeam(id: string): Promise<void> {
    error.value = null
    const toast = useToastStore()
    try {
      const token = await getAccessToken()
      await api.admin.teams.delete(token, id)
      teams.value = teams.value.filter(t => t.id !== id)
      toast.addToast('Csapat törölve', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ismeretlen hiba'
      error.value = msg
      toast.addToast(`Hiba: ${msg}`, 'error')
    }
  }

  return { teams, isLoading, error, fetchTeams, createTeam, updateTeam, deleteTeam }
})
