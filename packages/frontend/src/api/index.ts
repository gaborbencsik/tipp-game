import type { User, Match, MatchesFilters, MatchInput, MatchResultInput, MatchPrediction, Prediction, PredictionInput, Team, TeamInput, AdminUser, Group, GroupInput, GroupMember, JoinGroupInput, LeaderboardEntry, ScoringConfigFull, ScoringConfigInput, ScoringConfigWithImpact, ScoringOverrideInput, RecalcStatus, WaitlistListResult, WaitlistFilters, WaitlistEntry, WaitlistSource, SpecialPredictionType, SpecialTypeInput, SpecialPredictionWithType, SpecialPredictionInput, StatPredictionTemplate, Player, PlayerInput, GlobalTypeWithSubscription, League, LeagueInput, LeagueSyncSummary, UserLeagueFavorite, LeagueTeam, GroupMyPredictionsResult, AdminStatsResponse, AdminStatsMatchesResponse, MatchOddsResponse, VirtualPointEntry, ScoringExplainerResponse } from '../types/index.js'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { headers: optHeaders, ...restOptions } = options ?? {}
  const response = await fetch(`${BASE_URL}${path}`, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...optHeaders,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText })) as { error?: string }
    throw new Error(body.error ?? response.statusText)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  health: () => request<{ status: string; timestamp: string }>('/health'),
  auth: {
    me: (token: string, preferredLocale?: string) =>
      request<User>('/auth/me', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        ...(preferredLocale ? { body: JSON.stringify({ preferredLocale }) } : {}),
      }),
  },
  teams: {
    list: (token: string) =>
      request<Team[]>('/teams', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  players: {
    list: (token: string, leagueId?: string, teamId?: string) => {
      const params = new URLSearchParams()
      if (leagueId) params.set('leagueId', leagueId)
      if (teamId) params.set('teamId', teamId)
      const qs = params.toString()
      return request<Player[]>(`/players${qs ? `?${qs}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
  },
  leagues: {
    list: (token: string) =>
      request<League[]>('/leagues', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    favoritesSummary: (token: string, leagueId: string) =>
      request<{ members: { userId: string; displayName: string; teamId: string }[] }>(
        `/leagues/${leagueId}/favorites-summary`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
  },
  statPredictionTemplates: {
    list: (token: string) =>
      request<StatPredictionTemplate[]>('/stat-prediction-templates', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  users: {
    updateProfile: (token: string, params: { displayName: string; preferredLocale?: string }) =>
      request<User>('/users/me', {
        method: 'PUT',
        body: JSON.stringify(params),
        headers: { Authorization: `Bearer ${token}` },
      }),
    completeOnboarding: (token: string) =>
      request<User>('/users/me/onboarding', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      }),
    getLeagueFavorites: (token: string) =>
      request<UserLeagueFavorite[]>('/users/me/league-favorites', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    setLeagueFavorite: (token: string, leagueId: string, teamId: string) =>
      request<UserLeagueFavorite>(`/users/me/league-favorites/${leagueId}`, {
        method: 'PUT',
        body: JSON.stringify({ teamId }),
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  leagueTeams: {
    forLeague: (token: string, leagueId: string) =>
      request<LeagueTeam[]>(`/leagues/${leagueId}/teams`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  matches: {
    list: (token: string, filters?: MatchesFilters) => {
      const params = new URLSearchParams()
      if (filters?.stage) params.set('stage', filters.stage)
      if (filters?.status) params.set('status', filters.status)
      if (filters?.leagueId) params.set('leagueId', filters.leagueId)
      if (filters?.leagueIds) {
        for (const id of filters.leagueIds) params.append('leagueIds', id)
      }
      if (filters?.matchIds) {
        for (const id of filters.matchIds) params.append('matchIds', id)
      }
      const query = params.toString() ? `?${params.toString()}` : ''
      return request<Match[]>(`/matches${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    odds: (token: string, matchId: string) =>
      request<MatchOddsResponse>(`/matches/${matchId}/odds`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    revealInsight: (token: string, matchId: string) =>
      request<{ revealed: true }>(`/matches/${matchId}/insights/reveal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
    virtualPoints: (token: string, groupId: string) =>
      request<VirtualPointEntry[]>(`/matches/virtual-points?groupId=${encodeURIComponent(groupId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  predictions: {
    mine: (token: string, userId: string) =>
      request<Prediction[]>(`/users/${userId}/predictions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    upsert: (token: string, input: PredictionInput) =>
      request<Prediction>('/predictions', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
    forMatch: (token: string, matchId: string) =>
      request<MatchPrediction[]>(`/matches/${matchId}/predictions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  scoringConfig: {
    default: (token: string) =>
      request<ScoringConfigFull>('/scoring-config/default', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  scoring: {
    explainer: (token: string) =>
      request<ScoringExplainerResponse>('/scoring/explainer', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  groups: {
    mine: (token: string) =>
      request<Group[]>('/groups/mine', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    create: (token: string, input: GroupInput) =>
      request<Group>('/groups', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
    join: (token: string, input: JoinGroupInput) =>
      request<Group>('/groups/join', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
    leaderboard: (token: string, groupId: string) =>
      request<LeaderboardEntry[]>(`/groups/${groupId}/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    myPredictions: (token: string, groupId: string) =>
      request<GroupMyPredictionsResult>(`/groups/${groupId}/my-predictions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    members: (token: string, groupId: string) =>
      request<GroupMember[]>(`/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    removeMember: (token: string, groupId: string, userId: string) =>
      request<{ success: boolean }>(`/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
    updateMemberRole: (token: string, groupId: string, userId: string, isAdmin: boolean) =>
      request<GroupMember>(`/groups/${groupId}/members/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ isAdmin }),
        headers: { Authorization: `Bearer ${token}` },
      }),
    regenerateInvite: (token: string, groupId: string) =>
      request<Group>(`/groups/${groupId}/invite`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      }),
    setInviteActive: (token: string, groupId: string, active: boolean) =>
      request<Group>(`/groups/${groupId}/invite`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
        headers: { Authorization: `Bearer ${token}` },
      }),
    delete: (token: string, groupId: string) =>
      request<void>(`/groups/${groupId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
    getScoringConfig: (token: string, groupId: string) =>
      request<ScoringConfigWithImpact | null>(`/groups/${groupId}/scoring-config`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    setScoringConfig: (token: string, groupId: string, input: ScoringConfigInput) =>
      request<ScoringConfigFull>(`/groups/${groupId}/scoring-config`, {
        method: 'PUT',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
    overrideScoringConfig: (token: string, groupId: string, input: ScoringOverrideInput) =>
      request<ScoringConfigFull>(`/groups/${groupId}/scoring-config/override`, {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
    updateSettings: (token: string, groupId: string, settings: { favoriteTeamDoublePoints: boolean }) =>
      request<Group>(`/groups/${groupId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify(settings),
        headers: { Authorization: `Bearer ${token}` },
      }),
    addLeague: (token: string, groupId: string, leagueId: string) =>
      request<Group>(`/groups/${groupId}/leagues`, {
        method: 'POST',
        body: JSON.stringify({ leagueId }),
        headers: { Authorization: `Bearer ${token}` },
      }),
    removeLeague: (token: string, groupId: string, leagueId: string) =>
      request<Group>(`/groups/${groupId}/leagues/${leagueId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
    matches: (token: string, groupId: string) =>
      request<Match[]>(`/groups/${groupId}/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    addMatch: (token: string, groupId: string, matchId: string) =>
      request<{ ok: boolean }>(`/groups/${groupId}/matches`, {
        method: 'POST',
        body: JSON.stringify({ matchId }),
        headers: { Authorization: `Bearer ${token}` },
      }),
    removeMatch: (token: string, groupId: string, matchId: string) =>
      request<{ ok: boolean }>(`/groups/${groupId}/matches/${matchId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
    specialTypes: {
      list: (token: string, groupId: string) =>
        request<SpecialPredictionType[]>(`/groups/${groupId}/special-types`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      create: (token: string, groupId: string, input: SpecialTypeInput) =>
        request<SpecialPredictionType>(`/groups/${groupId}/special-types`, {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, groupId: string, typeId: string, input: SpecialTypeInput) =>
        request<SpecialPredictionType>(`/groups/${groupId}/special-types/${typeId}`, {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      deactivate: (token: string, groupId: string, typeId: string) =>
        request<void>(`/groups/${groupId}/special-types/${typeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      setAnswer: (token: string, groupId: string, typeId: string, correctAnswer: string) =>
        request<SpecialPredictionType>(`/groups/${groupId}/special-types/${typeId}/answer`, {
          method: 'PUT',
          body: JSON.stringify({ correctAnswer }),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    specialPredictions: {
      list: (token: string, groupId: string) =>
        request<SpecialPredictionWithType[]>(`/groups/${groupId}/special-predictions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      upsert: (token: string, groupId: string, input: SpecialPredictionInput) =>
        request<SpecialPredictionWithType>(`/groups/${groupId}/special-predictions`, {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    globalTypeSubscriptions: {
      list: (token: string, groupId: string) =>
        request<GlobalTypeWithSubscription[]>(`/groups/${groupId}/global-type-subscriptions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      subscribe: (token: string, groupId: string, typeId: string) =>
        request<{ ok: boolean }>(`/groups/${groupId}/global-type-subscriptions/${typeId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      unsubscribe: (token: string, groupId: string, typeId: string) =>
        request<void>(`/groups/${groupId}/global-type-subscriptions/${typeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
  },
  tournamentTips: {
    access: (token: string) =>
      request<{ hasAccess: boolean }>('/tournament-tips/access', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    list: (token: string) =>
      request<SpecialPredictionWithType[]>('/tournament-tips', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    upsert: (token: string, input: SpecialPredictionInput) =>
      request<SpecialPredictionWithType>('/tournament-tips', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  admin: {
    teams: {
      list: (token: string) =>
        request<Team[]>('/admin/teams', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      get: (token: string, id: string) =>
        request<Team>(`/admin/teams/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      create: (token: string, input: TeamInput) =>
        request<Team>('/admin/teams', {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, id: string, input: Partial<TeamInput>) =>
        request<Team>(`/admin/teams/${id}`, {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      delete: (token: string, id: string) =>
        request<void>(`/admin/teams/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    matches: {
      create: (token: string, input: MatchInput) =>
        request<unknown>('/admin/matches', {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, id: string, input: Partial<MatchInput>) =>
        request<unknown>(`/admin/matches/${id}`, {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      delete: (token: string, id: string) =>
        request<void>(`/admin/matches/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      setResult: (token: string, id: string, input: MatchResultInput) =>
        request<unknown>(`/admin/matches/${id}/result`, {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    users: {
      list: (token: string) =>
        request<AdminUser[]>('/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      updateRole: (token: string, id: string, role: 'user' | 'admin') =>
        request<AdminUser>(`/admin/users/${id}/role`, {
          method: 'PUT',
          body: JSON.stringify({ role }),
          headers: { Authorization: `Bearer ${token}` },
        }),
      ban: (token: string, id: string, ban: boolean) =>
        request<AdminUser>(`/admin/users/${id}/ban`, {
          method: 'PUT',
          body: JSON.stringify({ ban }),
          headers: { Authorization: `Bearer ${token}` },
        }),
      setSupporter: (token: string, id: string, supporter: boolean) =>
        request<AdminUser>(`/admin/users/${id}/supporter`, {
          method: 'PUT',
          body: JSON.stringify({ supporter }),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    groups: {
      setMemberPaid: (token: string, groupId: string, userId: string, paid: boolean) =>
        request<GroupMember>(`/admin/groups/${groupId}/members/${userId}/paid`, {
          method: 'PUT',
          body: JSON.stringify({ paid }),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    scoringConfig: {
      get: (token: string) =>
        request<ScoringConfigWithImpact>('/admin/scoring-config', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, input: ScoringConfigInput) =>
        request<ScoringConfigFull>('/admin/scoring-config', {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      override: (token: string, input: ScoringOverrideInput) =>
        request<ScoringConfigFull>('/admin/scoring-config/override', {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    scoring: {
      recalculateAll: (token: string) =>
        request<{ status: string }>('/admin/scoring/recalculate-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      recalculateStatus: (token: string) =>
        request<RecalcStatus>('/admin/scoring/recalculate-status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    players: {
      list: (token: string, teamId?: string) => {
        const params = new URLSearchParams()
        if (teamId) params.set('teamId', teamId)
        const query = params.toString() ? `?${params.toString()}` : ''
        return request<Player[]>(`/admin/players${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      },
      get: (token: string, id: string) =>
        request<Player>(`/admin/players/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      create: (token: string, input: PlayerInput) =>
        request<Player>('/admin/players', {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, id: string, input: Partial<PlayerInput>) =>
        request<Player>(`/admin/players/${id}`, {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      delete: (token: string, id: string) =>
        request<void>(`/admin/players/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    leagues: {
      list: (token: string, includeArchived = false) =>
        request<League[]>(`/admin/leagues${includeArchived ? '?includeArchived=true' : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      create: (token: string, input: LeagueInput) =>
        request<League>('/admin/leagues', {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, id: string, input: Partial<LeagueInput>) =>
        request<League>(`/admin/leagues/${id}`, {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      delete: (token: string, id: string) =>
        request<void>(`/admin/leagues/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      archive: (token: string, id: string) =>
        request<League>(`/admin/leagues/${id}/archive`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      restore: (token: string, id: string) =>
        request<League>(`/admin/leagues/${id}/restore`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      sync: (token: string, id: string) =>
        request<LeagueSyncSummary>(`/admin/leagues/${id}/sync`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    globalSpecialTypes: {
      list: (token: string) =>
        request<SpecialPredictionType[]>('/admin/global-special-types', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      create: (token: string, input: SpecialTypeInput) =>
        request<SpecialPredictionType>('/admin/global-special-types', {
          method: 'POST',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, typeId: string, input: Partial<SpecialTypeInput>) =>
        request<SpecialPredictionType>(`/admin/global-special-types/${typeId}`, {
          method: 'PUT',
          body: JSON.stringify(input),
          headers: { Authorization: `Bearer ${token}` },
        }),
      deactivate: (token: string, typeId: string) =>
        request<void>(`/admin/global-special-types/${typeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      setAnswer: (token: string, typeId: string, correctAnswer: string) =>
        request<SpecialPredictionType>(`/admin/global-special-types/${typeId}/answer`, {
          method: 'PUT',
          body: JSON.stringify({ correctAnswer }),
          headers: { Authorization: `Bearer ${token}` },
        }),
      // US-1311: split set-correct-answer + evaluate (per-slice).
      setCorrectAnswer: (token: string, typeId: string, correctAnswer: string) =>
        request<SpecialPredictionType>(`/admin/global-special-types/${typeId}/correct-answer`, {
          method: 'PATCH',
          body: JSON.stringify({ correctAnswer }),
          headers: { Authorization: `Bearer ${token}` },
        }),
      evaluate: (token: string, typeId: string, slice: string | null) =>
        request<{ evaluatedCount: number; totalPoints: number; lastRunAt: string }>(
          `/admin/global-special-types/${typeId}/evaluate`,
          {
            method: 'POST',
            body: JSON.stringify(slice ? { slice } : {}),
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
    },
    waitlist: {
      list: (token: string, filters?: WaitlistFilters) => {
        const params = new URLSearchParams()
        if (filters?.source) params.set('source', filters.source)
        if (filters?.search) params.set('search', filters.search)
        const query = params.toString() ? `?${params.toString()}` : ''
        return request<WaitlistListResult>(`/admin/waitlist${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      },
      delete: (token: string, id: string) =>
        request<void>(`/admin/waitlist/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }),
      add: (token: string, email: string, source?: WaitlistSource) =>
        request<WaitlistEntry>('/admin/waitlist', {
          method: 'POST',
          body: JSON.stringify({ email, ...(source ? { source } : {}) }),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    sync: {
      getSettings: (token: string) =>
        request<{ mode: string; lastSuccessfulSyncAt: string | null; apiCallsToday: number; syncInProgress: boolean; polymarketSyncEnabled: boolean; lastPolymarketSyncAt: string | null; playerSyncEnabled: boolean; lastPlayerSyncAt: string | null; transfermarktSyncEnabled: boolean; lastTransfermarktSyncAt: string | null; rawStatsSyncEnabled: boolean; lastRawStatsSyncAt: string | null; rawStatsSkipFresh: boolean; insightsSyncEnabled: boolean; lastInsightsSyncAt: string | null; configuredLeagues: Array<{ name: string; externalId: number; season: number }> }>('/admin/sync/settings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      updateSettings: (token: string, settings: { mode?: string; polymarketSyncEnabled?: boolean; playerSyncEnabled?: boolean; transfermarktSyncEnabled?: boolean; rawStatsSyncEnabled?: boolean; rawStatsSkipFresh?: boolean; insightsSyncEnabled?: boolean }) =>
        request<{ mode: string; polymarketSyncEnabled: boolean; playerSyncEnabled: boolean; transfermarktSyncEnabled: boolean; rawStatsSyncEnabled: boolean; rawStatsSkipFresh: boolean; insightsSyncEnabled: boolean }>('/admin/sync/settings', {
          method: 'PUT',
          body: JSON.stringify(settings),
          headers: { Authorization: `Bearer ${token}` },
        }),
      run: (token: string) =>
        request<{ results: Array<{ teamsUpserted: number; fixturesUpserted: number; resultsUpserted: number; errors: string[]; partial: boolean }> }>('/admin/sync/run', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      runPolymarket: (token: string) =>
        request<{ synced: number; failed: number; errors: string[] }>('/admin/sync/polymarket-run', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      runPlayers: (token: string) =>
        request<{ inserted: number; updated: number; statsUpserted: number; skipped: number; errors: string[] }>('/admin/sync/players-run', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      runTransfermarkt: (token: string) =>
        request<{ updated: number; skipped: number; errors: string[] }>('/admin/sync/transfermarkt-run', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      runRawStats: (token: string) =>
        request<{ processed: number; skipped: number; errors: Array<{ matchId: string; error: string }>; apiCalls: number; durationMs: number }>('/admin/sync/raw-stats-run', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
      runInsights: (token: string, matchId?: string) =>
        request<{ generated: number; skipped: number; errors: Array<{ matchId: string; error: string }> }>('/admin/sync/insights-run', {
          method: 'POST',
          body: JSON.stringify(matchId ? { matchId } : {}),
          headers: { Authorization: `Bearer ${token}` },
        }),
      runInsightsTranslate: (token: string, matchId?: string) =>
        request<{ translated: number; skipped: number; errors: Array<{ matchId: string; insightId?: string; error: string }> }>('/admin/sync/insights-translate', {
          method: 'POST',
          body: JSON.stringify(matchId ? { matchId } : {}),
          headers: { Authorization: `Bearer ${token}` },
        }),
      getInsightsUsage: (token: string) =>
        request<{ date: string; requestsToday: { generate: number; translate: number; total: number }; inputTokensToday: number; outputTokensToday: number; dailyLimit: number; remaining: number; last7Days: Array<{ date: string; requests: number; tokens: number }> }>('/admin/sync/insights-usage', {
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    stats: {
      get: (token: string) =>
        request<AdminStatsResponse>('/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      matches: (token: string) =>
        request<AdminStatsMatchesResponse>('/admin/stats/matches', {
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
    push: {
      targets: (token: string, segment: 'all' | 'missing-tournament-tips' | 'missing-today-match-tips' = 'all') =>
        request<{ count: number; segment: string }>(`/admin/push/targets?segment=${encodeURIComponent(segment)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      targetsDetails: (token: string, segment: 'all' | 'missing-tournament-tips' | 'missing-today-match-tips' = 'all') =>
        request<{ segment: string; users: { id: string; displayName: string | null; email: string }[] }>(`/admin/push/targets/details?segment=${encodeURIComponent(segment)}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      send: (token: string, params: { title: string; body: string; url?: string; bypassQuietHours?: boolean; bypassRateLimit?: boolean; segment?: 'all' | 'missing-tournament-tips' | 'missing-today-match-tips' }) =>
        request<{ totalTargets: number; delivered: number; failed: number; errors: string[] }>('/admin/push/send', {
          method: 'POST',
          body: JSON.stringify(params),
          headers: { Authorization: `Bearer ${token}` },
        }),
      getSettings: (token: string) =>
        request<{ kickoffReminderEnabled: boolean; dailyReviewEnabled: boolean }>('/admin/push/settings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      updateSettings: (token: string, params: { kickoffReminderEnabled?: boolean; dailyReviewEnabled?: boolean }) =>
        request<{ kickoffReminderEnabled: boolean; dailyReviewEnabled: boolean }>('/admin/push/settings', {
          method: 'PUT',
          body: JSON.stringify(params),
          headers: { Authorization: `Bearer ${token}` },
        }),
    },
  },
  leaderboard: {
    get: (token: string) =>
      request<LeaderboardEntry[]>('/leaderboard', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  waitlist: {
    subscribe: (email: string, source: 'hero' | 'footer', website: string, elapsed: number) =>
      request<{ message: string }>('/waitlist', {
        method: 'POST',
        body: JSON.stringify({ email, source, website, _t: elapsed }),
      }),
  },
  push: {
    status: (token: string) =>
      request<{ pushEnabled: boolean; activeSubscriptions: number }>('/push/status', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    setEnabled: (token: string, enabled: boolean) =>
      request<{ pushEnabled: boolean }>('/users/me/push-enabled', {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
        headers: { Authorization: `Bearer ${token}` },
      }),
    subscribe: (token: string, params: { endpoint: string; auth: string; p256dh: string; userAgent?: string }) =>
      request<{ message: string }>('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(params),
        headers: { Authorization: `Bearer ${token}` },
      }),
    unsubscribe: (token: string, endpoint?: string) =>
      request<void>('/push/subscribe', {
        method: 'DELETE',
        body: JSON.stringify(endpoint ? { endpoint } : {}),
        headers: { Authorization: `Bearer ${token}` },
      }),
    clicked: (logId: string) =>
      request<void>('/push/clicked', {
        method: 'POST',
        body: JSON.stringify({ logId }),
      }),
    listDevices: (token: string) =>
      request<{ devices: Array<{ id: string; endpoint: string; browserName: string; createdAt: string; lastUsedAt: string | null }> }>('/push/devices', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    removeDevice: (token: string, deviceId: string) =>
      request<{ success: boolean; remainingDevices: number; pushEnabled: boolean }>(`/push/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
    disableAll: (token: string) =>
      request<{ success: boolean }>('/push/disable-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
}
