import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { Player, PlayerInput } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useAdminPlayersStore = defineStore('admin-players', () => {
  const players = ref<Player[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPlayers(teamId?: string): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      players.value = await api.admin.players.list(token, teamId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function createPlayer(input: PlayerInput): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const created = await api.admin.players.create(token, input)
      players.value = [...players.value, created]
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  async function updatePlayer(id: string, input: Partial<PlayerInput>): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      const updated = await api.admin.players.update(token, id, input)
      players.value = players.value.map(p => (p.id === id ? updated : p))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  async function deletePlayer(id: string): Promise<void> {
    error.value = null
    try {
      const token = await getAccessToken()
      await api.admin.players.delete(token, id)
      players.value = players.value.filter(p => p.id !== id)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    }
  }

  return { players, isLoading, error, fetchPlayers, createPlayer, updatePlayer, deletePlayer }
})
