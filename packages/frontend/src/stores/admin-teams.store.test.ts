import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Team } from '@/types/index'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const {
  mockGetSession,
  mockTeamsList,
  mockTeamsCreate,
  mockTeamsUpdate,
  mockTeamsDelete,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockTeamsList: vi.fn(),
  mockTeamsCreate: vi.fn(),
  mockTeamsUpdate: vi.fn(),
  mockTeamsDelete: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
    matches: { list: vi.fn() },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    admin: {
      teams: {
        list: mockTeamsList,
        get: vi.fn(),
        create: mockTeamsCreate,
        update: mockTeamsUpdate,
        delete: mockTeamsDelete,
      },
    },
  },
}))

import { useAdminTeamsStore } from '@/stores/admin-teams.store'

const TEAM_1: Team = {
  id: 'team-uuid-1',
  name: 'Germany',
  shortCode: 'GER',
  flagUrl: 'https://example.com/ger.png',
  group: 'A',
  teamType: 'national',
  countryCode: 'de',
}

const TEAM_2: Team = {
  id: 'team-uuid-2',
  name: 'France',
  shortCode: 'FRA',
  flagUrl: null,
  group: 'B',
  teamType: 'national',
  countryCode: 'fr',
}

describe('admin-teams.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockTeamsList.mockReset()
    mockTeamsCreate.mockReset()
    mockTeamsUpdate.mockReset()
    mockTeamsDelete.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  it('initial teams is empty', () => {
    const store = useAdminTeamsStore()
    expect(store.teams).toEqual([])
  })

  it('initial isLoading is false', () => {
    const store = useAdminTeamsStore()
    expect(store.isLoading).toBe(false)
  })

  it('initial error is null', () => {
    const store = useAdminTeamsStore()
    expect(store.error).toBeNull()
  })

  it('fetchTeams() → teams populated', async () => {
    mockTeamsList.mockResolvedValue([TEAM_1, TEAM_2])
    const store = useAdminTeamsStore()
    await store.fetchTeams()
    expect(store.teams).toEqual([TEAM_1, TEAM_2])
    expect(store.isLoading).toBe(false)
  })

  it('fetchTeams() error → error set, teams remain empty', async () => {
    mockTeamsList.mockRejectedValue(new Error('Network error'))
    const store = useAdminTeamsStore()
    await store.fetchTeams()
    expect(store.error).toBe('Network error')
    expect(store.teams).toEqual([])
  })

  it('createTeam() → team added to list', async () => {
    mockTeamsList.mockResolvedValue([])
    mockTeamsCreate.mockResolvedValue(TEAM_1)
    const store = useAdminTeamsStore()
    await store.fetchTeams()
    await store.createTeam({ name: 'Germany', shortCode: 'GER', flagUrl: 'https://example.com/ger.png', group: 'A' })
    expect(store.teams).toContainEqual(TEAM_1)
  })

  it('updateTeam() → team updated in list', async () => {
    mockTeamsList.mockResolvedValue([TEAM_1, TEAM_2])
    const updatedTeam = { ...TEAM_1, name: 'Deutschland' }
    mockTeamsUpdate.mockResolvedValue(updatedTeam)
    const store = useAdminTeamsStore()
    await store.fetchTeams()
    await store.updateTeam('team-uuid-1', { name: 'Deutschland' })
    expect(store.teams.find(t => t.id === 'team-uuid-1')?.name).toBe('Deutschland')
  })

  it('deleteTeam() → team removed from list', async () => {
    mockTeamsList.mockResolvedValue([TEAM_1, TEAM_2])
    mockTeamsDelete.mockResolvedValue(undefined)
    const store = useAdminTeamsStore()
    await store.fetchTeams()
    await store.deleteTeam('team-uuid-1')
    expect(store.teams).not.toContainEqual(TEAM_1)
    expect(store.teams).toHaveLength(1)
  })

  it('deleteTeam() error → error set', async () => {
    mockTeamsList.mockResolvedValue([TEAM_1])
    mockTeamsDelete.mockRejectedValue(new Error('Team has associated matches'))
    const store = useAdminTeamsStore()
    await store.fetchTeams()
    await store.deleteTeam('team-uuid-1')
    expect(store.error).toBe('Team has associated matches')
  })
})
