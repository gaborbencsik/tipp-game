import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { UserLeagueFavorite, LeagueTeam, League } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useLeagueFavoritesStore = defineStore('leagueFavorites', () => {
  const favorites = ref<UserLeagueFavorite[]>([])
  const leagues = ref<League[]>([])
  const leagueTeamsMap = ref<Record<string, LeagueTeam[]>>({})
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function favoriteByLeagueId(leagueId: string): UserLeagueFavorite | undefined {
    return favorites.value.find(f => f.leagueId === leagueId)
  }

  async function fetchFavorites(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getToken()
      favorites.value = await api.users.getLeagueFavorites(token)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchLeagues(): Promise<void> {
    const token = await getToken()
    leagues.value = await api.leagues.list(token)
  }

  async function setFavorite(leagueId: string, teamId: string): Promise<void> {
    const token = await getToken()
    const updated = await api.users.setLeagueFavorite(token, leagueId, teamId)
    const idx = favorites.value.findIndex(f => f.leagueId === leagueId)
    if (idx >= 0) {
      favorites.value[idx] = updated
    } else {
      favorites.value.push(updated)
    }
  }

  async function fetchLeagueTeams(leagueId: string): Promise<void> {
    if (leagueTeamsMap.value[leagueId]) return
    const token = await getToken()
    leagueTeamsMap.value[leagueId] = await api.leagueTeams.forLeague(token, leagueId)
  }

  return {
    favorites,
    leagues,
    leagueTeamsMap,
    isLoading,
    error,
    favoriteByLeagueId,
    fetchFavorites,
    fetchLeagues,
    setFavorite,
    fetchLeagueTeams,
  }
})
