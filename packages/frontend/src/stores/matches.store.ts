import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { getDateLocale } from '../lib/dateLocale.js'
import type { Match, MatchDateGroup, MatchStage, MatchStatus } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

export const useMatchesStore = defineStore('matches', () => {
  const matches = ref<Match[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const stageFilter = ref<MatchStage | null>(null)
  const statusFilter = ref<MatchStatus | null>(null)
  const leagueFilter = ref<string | null>(null)

  const filteredMatches = computed<Match[]>(() => {
    return matches.value
      .filter(m => !stageFilter.value || m.stage === stageFilter.value)
      .filter(m => !statusFilter.value || m.status === statusFilter.value)
      .filter(m => !leagueFilter.value || m.league?.id === leagueFilter.value)
  })

  const matchesByDate = computed<MatchDateGroup[]>(() => {
    const groups = new Map<string, Match[]>()
    for (const match of filteredMatches.value) {
      const date = match.scheduledAt.substring(0, 10)
      const existing = groups.get(date)
      if (existing) {
        existing.push(match)
      } else {
        groups.set(date, [match])
      }
    }

    const formatter = new Intl.DateTimeFormat(getDateLocale(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })

    return Array.from(groups.entries()).map(([date, dateMatches]) => ({
      date,
      label: formatter.format(new Date(date + 'T00:00:00Z')),
      matches: dateMatches,
    }))
  })

  async function fetchMatches(leagueIds?: readonly string[]): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      const token = await getAccessToken()
      matches.value = await api.matches.list(
        token,
        leagueIds && leagueIds.length > 0 ? { leagueIds } : undefined,
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Patches a single match's status and live score from a push event so we
   * don't have to refetch the whole list on every score change.
   */
  function applyMatchUpdate(update: {
    matchId: string
    status: MatchStatus
    homeScore: number | null
    awayScore: number | null
  }): void {
    const idx = matches.value.findIndex(m => m.id === update.matchId)
    if (idx === -1) return
    const target = matches.value[idx]!
    matches.value[idx] = {
      ...target,
      status: update.status,
      result: target.result
        ? { ...target.result, homeGoals: update.homeScore ?? target.result.homeGoals, awayGoals: update.awayScore ?? target.result.awayGoals }
        : target.result,
    }
  }

  return {
    matches,
    isLoading,
    error,
    stageFilter,
    statusFilter,
    leagueFilter,
    filteredMatches,
    matchesByDate,
    fetchMatches,
    applyMatchUpdate,
  }
})
