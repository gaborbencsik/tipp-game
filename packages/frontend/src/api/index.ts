import type { User, Match, MatchesFilters, MatchInput, MatchResultInput, Prediction, PredictionInput, Team, TeamInput, AdminUser, Group, GroupInput, GroupMember, JoinGroupInput, LeaderboardEntry, ScoringConfigFull, ScoringConfigInput, WaitlistListResult, WaitlistFilters, WaitlistEntry, WaitlistSource, SpecialPredictionType, SpecialTypeInput, SpecialPredictionWithType, SpecialPredictionInput, StatPredictionTemplate, Player, PlayerInput, GlobalTypeWithSubscription, League, LeagueInput } from '../types/index.js'

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
    me: (token: string) =>
      request<User>('/auth/me', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  teams: {
    list: (token: string) =>
      request<Team[]>('/teams', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  players: {
    list: (token: string) =>
      request<Player[]>('/players', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  leagues: {
    list: (token: string) =>
      request<League[]>('/leagues', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  statPredictionTemplates: {
    list: (token: string) =>
      request<StatPredictionTemplate[]>('/stat-prediction-templates', {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  users: {
    updateProfile: (token: string, displayName: string) =>
      request<User>('/users/me', {
        method: 'PUT',
        body: JSON.stringify({ displayName }),
        headers: { Authorization: `Bearer ${token}` },
      }),
    completeOnboarding: (token: string) =>
      request<User>('/users/me/onboarding', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
  matches: {
    list: (token: string, filters?: MatchesFilters) => {
      const params = new URLSearchParams()
      if (filters?.stage) params.set('stage', filters.stage)
      if (filters?.status) params.set('status', filters.status)
      const query = params.toString() ? `?${params.toString()}` : ''
      return request<Match[]>(`/matches${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
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
      request<ScoringConfigFull | null>(`/groups/${groupId}/scoring-config`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    setScoringConfig: (token: string, groupId: string, input: ScoringConfigInput) =>
      request<ScoringConfigFull>(`/groups/${groupId}/scoring-config`, {
        method: 'PUT',
        body: JSON.stringify(input),
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
    },
    scoringConfig: {
      get: (token: string) =>
        request<ScoringConfigFull>('/admin/scoring-config', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      update: (token: string, input: ScoringConfigInput) =>
        request<ScoringConfigFull>('/admin/scoring-config', {
          method: 'PUT',
          body: JSON.stringify(input),
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
      list: (token: string) =>
        request<League[]>('/admin/leagues', {
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
}
