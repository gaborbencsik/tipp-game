import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export interface FavoriteMember {
  readonly userId: string
  readonly displayName: string
  readonly teamId: string
}

export interface MatchLike {
  readonly homeTeam: { readonly id: string }
  readonly awayTeam: { readonly id: string }
  readonly league: { readonly id: string } | null
}

export const useGroupFavoritesStore = defineStore('groupFavorites', () => {
  // leagueId -> teamId -> members[]
  const byLeague = ref<Record<string, Record<string, FavoriteMember[]>>>({})
  const loadedLeagues = ref<Set<string>>(new Set())
  const inflight = new Map<string, Promise<void>>()

  function indexMembers(members: readonly FavoriteMember[]): Record<string, FavoriteMember[]> {
    const map: Record<string, FavoriteMember[]> = {}
    for (const m of members) {
      if (!map[m.teamId]) map[m.teamId] = []
      map[m.teamId]!.push(m)
    }
    return map
  }

  async function ensureLoaded(leagueId: string): Promise<void> {
    if (loadedLeagues.value.has(leagueId)) return
    const existing = inflight.get(leagueId)
    if (existing) return existing
    const promise = (async () => {
      const token = await getToken()
      const { members } = await api.leagues.favoritesSummary(token, leagueId)
      byLeague.value[leagueId] = indexMembers(members)
      loadedLeagues.value.add(leagueId)
    })().finally(() => {
      inflight.delete(leagueId)
    })
    inflight.set(leagueId, promise)
    return promise
  }

  function membersForMatch(
    match: MatchLike,
    currentUserId: string | null,
  ): { self: FavoriteMember | null; others: readonly FavoriteMember[] } {
    if (!match.league) return { self: null, others: [] }
    const leagueIdx = byLeague.value[match.league.id]
    if (!leagueIdx) return { self: null, others: [] }
    const collected = new Map<string, FavoriteMember>()
    for (const teamId of [match.homeTeam.id, match.awayTeam.id]) {
      for (const m of leagueIdx[teamId] ?? []) {
        if (!collected.has(m.userId)) collected.set(m.userId, m)
      }
    }
    let self: FavoriteMember | null = null
    const others: FavoriteMember[] = []
    for (const m of collected.values()) {
      if (currentUserId !== null && m.userId === currentUserId) self = m
      else others.push(m)
    }
    return { self, others }
  }

  function hasOwnFavorite(match: MatchLike, currentUserId: string | null): boolean {
    return membersForMatch(match, currentUserId).self !== null
  }

  function reset(): void {
    byLeague.value = {}
    loadedLeagues.value = new Set()
    inflight.clear()
  }

  return {
    byLeague,
    loadedLeagues,
    ensureLoaded,
    membersForMatch,
    hasOwnFavorite,
    reset,
  }
})
