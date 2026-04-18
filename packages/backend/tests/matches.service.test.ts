import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Match } from '../src/types/index.js'

const {
  mockSelect,
  mockFrom,
  mockLeftJoin,
  mockWhere,
  mockOrderBy,
  mockInsert,
  mockValues,
  mockReturning,
  mockUpdate,
  mockSet,
} = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([])
  const mockSet = vi.fn()
  const mockValues = vi.fn()
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }))
  const mockLeftJoin = vi.fn(function () {
    return { leftJoin: mockLeftJoin, where: mockWhere }
  })
  const mockFrom = vi.fn(() => ({ leftJoin: mockLeftJoin, where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  const mockInsert = vi.fn()
  const mockUpdate = vi.fn()
  return {
    mockSelect, mockFrom, mockLeftJoin, mockWhere, mockOrderBy,
    mockInsert, mockValues, mockReturning, mockUpdate, mockSet,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}))

import {
  getMatches,
  createMatch,
  updateMatch,
  deleteMatch,
  setResult,
} from '../src/services/matches.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEAM_HOME = {
  id: 'team-home-uuid',
  name: 'Germany',
  shortCode: 'GER',
  flagUrl: 'https://example.com/ger.png',
  group: 'A',
  teamType: 'national' as const,
  countryCode: 'de',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const TEAM_AWAY = {
  id: 'team-away-uuid',
  name: 'France',
  shortCode: 'FRA',
  flagUrl: 'https://example.com/fra.png',
  group: 'A',
  teamType: 'national' as const,
  countryCode: 'fr',
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

// ─── getMatches ────────────────────────────────────────────────────────────────

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

  it('empty DB → returns []', async () => {
    mockOrderBy.mockResolvedValue([])
    const result = await getMatches()
    expect(result).toEqual([])
  })

  it('2 matches → 2 items with correct Match structure', async () => {
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

  it('finished match → result populated', async () => {
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

    expect(result[0]?.result).toEqual({ homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null })
  })

  it('scheduled match → result: null', async () => {
    const row = makeRow({ status: 'scheduled' })
    mockOrderBy.mockResolvedValue([row])

    const result = await getMatches()

    expect(result[0]?.result).toBeNull()
  })

  it('status: live filter → where called with eq condition', async () => {
    mockOrderBy.mockResolvedValue([])

    await getMatches({ status: 'live' })

    expect(mockWhere).toHaveBeenCalledOnce()
    const [condition] = mockWhere.mock.calls[0] as unknown[]
    expect(condition).toBeDefined()
  })

  it('stage filter → where called with eq condition', async () => {
    mockOrderBy.mockResolvedValue([])

    await getMatches({ stage: 'final' })

    expect(mockWhere).toHaveBeenCalledOnce()
  })

  it('venue null → match.venue is null', async () => {
    const row = makeRow()
    row.venues = null as unknown as typeof VENUE
    mockOrderBy.mockResolvedValue([row])

    const result = await getMatches()

    expect(result[0]?.venue).toBeNull()
  })
})

// ─── createMatch ──────────────────────────────────────────────────────────────

describe('createMatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('valid input → returns new Match', async () => {
    mockReturning.mockResolvedValue([BASE_MATCH])
    mockValues.mockReturnValue({ returning: mockReturning })
    mockInsert.mockReturnValue({ values: mockValues })

    const result = await createMatch({
      homeTeamId: 'team-home-uuid',
      awayTeamId: 'team-away-uuid',
      stage: 'group',
      scheduledAt: '2026-06-11T15:00:00Z',
    })

    expect(result.id).toBe('match-uuid-1')
    expect(result.homeTeamId).toBe('team-home-uuid')
    expect(result.stage).toBe('group')
  })

  it('insert fails → throws error', async () => {
    mockReturning.mockResolvedValue([])
    mockValues.mockReturnValue({ returning: mockReturning })
    mockInsert.mockReturnValue({ values: mockValues })

    await expect(createMatch({
      homeTeamId: 'h',
      awayTeamId: 'a',
      stage: 'group',
      scheduledAt: '2026-06-11T15:00:00Z',
    })).rejects.toMatchObject({ status: 500 })
  })
})

// ─── updateMatch ──────────────────────────────────────────────────────────────

describe('updateMatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('existing id → returns updated match row', async () => {
    const updated = { ...BASE_MATCH, status: 'live' as const }
    mockReturning.mockResolvedValue([updated])
    const mockWhere2 = vi.fn().mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere2 })
    mockUpdate.mockReturnValue({ set: mockSet })

    const result = await updateMatch('match-uuid-1', { status: 'live' })
    expect(result.status).toBe('live')
  })

  it('non-existing id → AppError 404', async () => {
    mockReturning.mockResolvedValue([])
    const mockWhere2 = vi.fn().mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere2 })
    mockUpdate.mockReturnValue({ set: mockSet })

    await expect(updateMatch('nonexistent', { status: 'live' }))
      .rejects.toMatchObject({ status: 404, message: 'Match not found' })
  })
})

// ─── deleteMatch ──────────────────────────────────────────────────────────────

describe('deleteMatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('existing id → soft-deletes (sets deletedAt)', async () => {
    const softDeleted = { ...BASE_MATCH, deletedAt: new Date() }
    mockReturning.mockResolvedValue([softDeleted])
    const mockWhere2 = vi.fn().mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere2 })
    mockUpdate.mockReturnValue({ set: mockSet })

    await expect(deleteMatch('match-uuid-1')).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledOnce()
  })

  it('non-existing id → AppError 404', async () => {
    mockReturning.mockResolvedValue([])
    const mockWhere2 = vi.fn().mockReturnValue({ returning: mockReturning })
    mockSet.mockReturnValue({ where: mockWhere2 })
    mockUpdate.mockReturnValue({ set: mockSet })

    await expect(deleteMatch('nonexistent'))
      .rejects.toMatchObject({ status: 404, message: 'Match not found' })
  })
})

// ─── setResult ────────────────────────────────────────────────────────────────

describe('setResult', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('upserts result + sets match status to finished', async () => {
    // insert result → returning
    const resultRow = {
      id: 'result-uuid',
      matchId: 'match-uuid-1',
      homeGoals: 2,
      awayGoals: 1,
      recordedBy: 'admin-uuid',
      recordedAt: new Date(),
      updatedAt: new Date(),
    }
    mockReturning.mockResolvedValueOnce([resultRow]) // upsert result
    mockValues.mockReturnValue({ onConflictDoUpdate: vi.fn().mockReturnValue({ returning: mockReturning }) })
    mockInsert.mockReturnValue({ values: mockValues })

    // update match status + calculateAndSavePoints updates
    const mockWhere2 = vi.fn().mockResolvedValue(undefined)
    mockSet.mockReturnValue({ where: mockWhere2 })
    mockUpdate.mockReturnValue({ set: mockSet })

    // calculateAndSavePoints: select predictions (empty) + select config
    // calculateAndSaveGroupPoints: select predictions (empty)
    const CONFIG_ROW = { id: 'cfg-1', exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2, incorrect: 0, isGlobalDefault: true }
    mockWhere
      .mockResolvedValueOnce([])        // predictions for match → empty, no updates needed
      .mockResolvedValueOnce([CONFIG_ROW]) // scoring config
      .mockResolvedValueOnce([])        // calculateAndSaveGroupPoints: predictions for match → empty

    const result = await setResult('match-uuid-1', 2, 1, 'admin-uuid')
    expect(result.homeGoals).toBe(2)
    expect(result.awayGoals).toBe(1)
  })

  it('insert returns empty → AppError 500', async () => {
    mockReturning.mockResolvedValue([])
    mockValues.mockReturnValue({ onConflictDoUpdate: vi.fn().mockReturnValue({ returning: mockReturning }) })
    mockInsert.mockReturnValue({ values: mockValues })

    const mockWhere2 = vi.fn().mockResolvedValue(undefined)
    mockSet.mockReturnValue({ where: mockWhere2 })
    mockUpdate.mockReturnValue({ set: mockSet })

    await expect(setResult('match-uuid-1', 2, 1, 'admin-uuid'))
      .rejects.toMatchObject({ status: 500 })
  })
})
