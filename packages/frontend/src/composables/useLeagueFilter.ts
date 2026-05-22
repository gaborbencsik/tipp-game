import { watch, type ComputedRef } from 'vue'
import { useMatchesStore } from '../stores/matches.store.js'

export const MATCHES_LEAGUE_FILTER_LS_KEY = 'matches_league_filter'

export interface UseLeagueFilterReturn {
  initFromStorage(): void
}

export function useLeagueFilter(
  userLeagueIds: ComputedRef<readonly string[]>,
): UseLeagueFilterReturn {
  const matchesStore = useMatchesStore()

  function initFromStorage(): void {
    if (matchesStore.leagueFilter !== null) return

    let stored: string | null = null
    try {
      stored = localStorage.getItem(MATCHES_LEAGUE_FILTER_LS_KEY)
    } catch {
      stored = null
    }

    const ids = userLeagueIds.value
    if (stored && ids.includes(stored)) {
      matchesStore.leagueFilter = stored
      return
    }

    if (stored && !ids.includes(stored)) {
      try {
        localStorage.removeItem(MATCHES_LEAGUE_FILTER_LS_KEY)
      } catch {
        // ignore
      }
    }

    if (ids.length === 1) {
      matchesStore.leagueFilter = ids[0]!
    }
  }

  watch(
    () => matchesStore.leagueFilter,
    (val) => {
      try {
        if (val) {
          localStorage.setItem(MATCHES_LEAGUE_FILTER_LS_KEY, val)
        } else {
          localStorage.removeItem(MATCHES_LEAGUE_FILTER_LS_KEY)
        }
      } catch {
        // ignore
      }
    },
  )

  return { initFromStorage }
}
