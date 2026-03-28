import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Match } from '../src/types/index.js'

const {
  mockSelect,
  mockFrom,
  mockLeftJoin,
  mockWhere,
  mockOrderBy,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }))
  const mockLeftJoin = vi.fn(function () {
    return { leftJoin: mockLeftJoin, where: mockWhere }
  })
  const mockFrom = vi.fn(() => ({ leftJoin: mockLeftJoin, where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockSelect, mockFrom, mockLeftJoin, mockWhere, mockOrderBy }
})

vi.mock('../src/db/client.js', () => ({ db: { select: mockSelect } }))

import { getMatches } from '../src/services/matches.service.js'

const TEAM_HOME = {
  id: 'team-home-uuid',
  name: 'Germany',
  shortCode: 'GER',
  flagUrl: 'https://example.com/ger.png',
  group: 'A',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEAM_AWAY = {
  id: 'team-away-uuid',
  name: 'France',
  shortCode: 'FRA',
  flagUrl: 'https://example.com/fra.png',
  group: 'A',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const VENUE = {
  id: 'venue-uuid',
  name: 'Allianz Arena',
  city: 'Munich',
  country: 'Germany',
  capacity: 75000,
  createdAt: new Date(),
}

const BASE_MATCH = {
  id: 'match-uuid-1',
  homeTeamId: 'team-home-uuid',
  awayTeamId: 'team-away-uuid',
  venueId: 'venue-uuid',
  stage: 'group' as const,
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: new Date('2026-06-11T15:00:00Z'),
  status: 'scheduled' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    matches: { ...BASE_MATCH, ...overrides },
    home_team: TEAM_HOME,
    away_team: TEAM_AWAY,
    venues: VENUE,
    match_results: null,
  }
}

describe('getMatches', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockOrderBy.mockResolvedValue([])
    mockWhere.mockReturnValue({ orderBy: mockOrderBy })
    mockLeftJoin.mockImplementation(function () {
      return { leftJoin: mockLeftJoin, where: mockWhere }
    })
    mockFrom.mockReturnValue({ leftJoin: mockLeftJoin, where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })
  })

  it('üres DB → [] visszaadva', async () => {
    mockOrderBy.mockResolvedValue([])
    const result = await getMatches()
    expect(result).toEqual([])
  })

  it('2 meccs → 2 elem, helyes Match struktúra', async () => {
    const row1 = makeRow()
    const row2 = makeRow({ id: 'match-uuid-2' })
    mockOrderBy.mockResolvedValue([row1, row2])

    const result = await getMatches()

    expect(result).toHaveLength(2)
    const first = result[0] as Match
    expect(first.id).toBe('match-uuid-1')
    expect(first.homeTeam.id).toBe('team-home-uuid')
    expect(first.homeTeam.name).toBe('Germany')
    expect(first.homeTeam.shortCode).toBe('GER')
    expect(first.awayTeam.id).toBe('team-away-uuid')
    expect(first.awayTeam.name).toBe('France')
    expect(first.venue).not.toBeNull()
    expect(first.venue?.name).toBe('Allianz Arena')
    expect(first.venue?.city).toBe('Munich')
    expect(first.stage).toBe('group')
    expect(first.groupName).toBe('A')
    expect(first.matchNumber).toBe(1)
    expect(first.status).toBe('scheduled')
    expect(first.result).toBeNull()
    expect(typeof first.scheduledAt).toBe('string')
  })

  it('finished meccs → result kitöltve', async () => {
    const row = makeRow({ status: 'finished' })
    row.match_results = {
      id: 'result-uuid',
      matchId: 'match-uuid-1',
      homeGoals: 2,
      awayGoals: 1,
      recordedBy: 'admin-uuid',
      recordedAt: new Date(),
      updatedAt: new Date(),
    } as unknown as null
    mockOrderBy.mockResolvedValue([row])

    const result = await getMatches()

    expect(result[0]?.result).toEqual({ homeGoals: 2, awayGoals: 1 })
  })

  it('scheduled meccs → result: null', async () => {
    const row = makeRow({ status: 'scheduled' })
    mockOrderBy.mockResolvedValue([row])

    const result = await getMatches()

    expect(result[0]?.result).toBeNull()
  })

  it('status: live filter → where hívva eq feltétellel', async () => {
    mockOrderBy.mockResolvedValue([])

    await getMatches({ status: 'live' })

    expect(mockWhere).toHaveBeenCalledOnce()
    const [condition] = mockWhere.mock.calls[0] as unknown[]
    expect(condition).toBeDefined()
  })

  it('stage filter → where hívva eq feltétellel', async () => {
    mockOrderBy.mockResolvedValue([])

    await getMatches({ stage: 'final' })

    expect(mockWhere).toHaveBeenCalledOnce()
  })

  it('venue null → match.venue null', async () => {
    const row = makeRow()
    row.venues = null as unknown as typeof VENUE
    mockOrderBy.mockResolvedValue([row])

    const result = await getMatches()

    expect(result[0]?.venue).toBeNull()
  })
})
