import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockFrom, mockWhere, mockLimit,
  mockInnerJoin, mockLeftJoin, mockOrderBy,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn()
  const mockLeftJoin = vi.fn()
  const mockInnerJoin = vi.fn()
  const mockLimit = vi.fn()
  const mockWhere = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  return { mockSelect, mockFrom, mockWhere, mockLimit, mockInnerJoin, mockLeftJoin, mockOrderBy }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

vi.mock('../src/db/schema/index.js', () => ({
  predictions: { id: 'predictions.id', userId: 'predictions.userId', matchId: 'predictions.matchId', homeGoals: 'predictions.homeGoals', awayGoals: 'predictions.awayGoals', pointsGlobal: 'predictions.pointsGlobal' },
  matches: { id: 'matches.id', homeTeamId: 'matches.homeTeamId', awayTeamId: 'matches.awayTeamId', leagueId: 'matches.leagueId', scheduledAt: 'matches.scheduledAt', status: 'matches.status', deletedAt: 'matches.deletedAt' },
  matchResults: { matchId: 'matchResults.matchId', homeGoals: 'matchResults.homeGoals', awayGoals: 'matchResults.awayGoals' },
  teams: { id: 'teams.id', name: 'teams.name', shortCode: 'teams.shortCode', flagUrl: 'teams.flagUrl' },
  groups: { id: 'groups.id', favoriteTeamDoublePoints: 'groups.favoriteTeamDoublePoints', deletedAt: 'groups.deletedAt' },
  groupMembers: { id: 'groupMembers.id', groupId: 'groupMembers.groupId', userId: 'groupMembers.userId' },
  groupPredictionPoints: { predictionId: 'gpp.predictionId', groupId: 'gpp.groupId', points: 'gpp.points' },
  userLeagueFavorites: { userId: 'ulf.userId', leagueId: 'ulf.leagueId', teamId: 'ulf.teamId' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  desc: vi.fn(),
  sql: Object.assign(vi.fn(() => 'sql-expr'), { raw: vi.fn() }),
}))

vi.mock('drizzle-orm/pg-core', () => ({
  alias: vi.fn(() => ({ id: 'alias.id', name: 'alias.name', shortCode: 'alias.shortCode', flagUrl: 'alias.flagUrl' })),
}))

import { getMyGroupPredictions } from '../src/services/group-my-predictions.service.js'

const GROUP_ID = 'group-uuid-1'
const USER_ID = 'user-uuid-1'

function makeSelectChain(resolvedValue: unknown) {
  const limit = vi.fn().mockResolvedValue(resolvedValue)
  const orderBy = vi.fn().mockResolvedValue(resolvedValue)
  const leftJoin = vi.fn()
  const innerJoin = vi.fn()
  const where = vi.fn().mockReturnValue({ limit, orderBy, innerJoin, leftJoin })
  // For the favorites query, where() is awaited directly:
  where.mockResolvedValue(resolvedValue)
  // But for limit-based queries, where returns { limit }
  where.mockReturnValue({ limit, orderBy, innerJoin, leftJoin })
  const from = vi.fn().mockReturnValue({ where, innerJoin, leftJoin, orderBy })
  leftJoin.mockReturnValue({ where, leftJoin, orderBy })
  innerJoin.mockReturnValue({ innerJoin, leftJoin, where, orderBy })
  return { from }
}

function setupCalls(options: {
  groupExists: boolean
  isMember?: boolean
  flag?: boolean
  predictionRows?: unknown[]
  favorites?: Array<{ leagueId: string; teamId: string }>
}): void {
  const { groupExists, isMember = true, flag = false, predictionRows = [], favorites } = options

  // Call 1: assertGroupExists → select().from().where().limit()
  const existsChain = makeSelectChain(groupExists ? [{ id: GROUP_ID }] : [])
  mockSelect.mockReturnValueOnce({ from: existsChain.from })

  if (!groupExists) return

  // Call 2: assertGroupMember → select().from().where().limit()
  const memberChain = makeSelectChain(isMember ? [{ id: 'gm-1' }] : [])
  mockSelect.mockReturnValueOnce({ from: memberChain.from })

  if (!isMember) return

  // Call 3: group flag → select().from().where().limit()
  const flagChain = makeSelectChain([{ favoriteTeamDoublePoints: flag }])
  mockSelect.mockReturnValueOnce({ from: flagChain.from })

  // Call 4: main predictions query → select().from().innerJoin()...orderBy()
  const predsLimit = vi.fn().mockResolvedValue(predictionRows)
  const predsOrderBy = vi.fn().mockResolvedValue(predictionRows)
  const predsLeftJoin = vi.fn()
  const predsInnerJoin = vi.fn()
  const predsWhere = vi.fn().mockReturnValue({ orderBy: predsOrderBy, limit: predsLimit })
  predsLeftJoin.mockReturnValue({ where: predsWhere, leftJoin: predsLeftJoin, orderBy: predsOrderBy })
  predsInnerJoin.mockReturnValue({ innerJoin: predsInnerJoin, leftJoin: predsLeftJoin, where: predsWhere, orderBy: predsOrderBy })
  const predsFrom = vi.fn().mockReturnValue({ innerJoin: predsInnerJoin, leftJoin: predsLeftJoin, where: predsWhere, orderBy: predsOrderBy })
  mockSelect.mockReturnValueOnce({ from: predsFrom })

  // Call 5 (if flag=true): favorites → select().from().where()
  if (flag && favorites !== undefined) {
    const favWhere = vi.fn().mockResolvedValue(favorites)
    const favFrom = vi.fn().mockReturnValue({ where: favWhere })
    mockSelect.mockReturnValueOnce({ from: favFrom })
  }
}

describe('getMyGroupPredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws 404 if group does not exist', async () => {
    setupCalls({ groupExists: false })
    await expect(getMyGroupPredictions(GROUP_ID, USER_ID))
      .rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  it('throws 403 if user is not a group member', async () => {
    setupCalls({ groupExists: true, isMember: false })
    await expect(getMyGroupPredictions(GROUP_ID, USER_ID))
      .rejects.toMatchObject({ status: 403, message: 'Not a member of this group' })
  })

  it('returns empty predictions when no scored predictions exist', async () => {
    setupCalls({ groupExists: true, isMember: true, flag: false, predictionRows: [] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.predictions).toEqual([])
    expect(result.totalPoints).toBe(0)
  })

  it('uses groupPoints when available', async () => {
    setupCalls({ groupExists: true, flag: false, predictionRows: [{
      predictionId: 'pred-1', matchId: 'match-1',
      scheduledAt: new Date('2026-06-14T18:00:00Z'), leagueId: 'league-1',
      homeTeamId: 'team-h', awayTeamId: 'team-a',
      homeTeamName: 'Hungary', homeTeamShortCode: 'HUN', homeTeamFlagUrl: null,
      awayTeamName: 'France', awayTeamShortCode: 'FRA', awayTeamFlagUrl: null,
      predHomeGoals: 2, predAwayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1,
      pointsGlobal: 3, groupPoints: 5,
    }] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.predictions[0]!.points).toBe(5)
    expect(result.totalPoints).toBe(5)
  })

  it('falls back to pointsGlobal when groupPoints is null', async () => {
    setupCalls({ groupExists: true, flag: false, predictionRows: [{
      predictionId: 'pred-1', matchId: 'match-1',
      scheduledAt: new Date('2026-06-14T18:00:00Z'), leagueId: null,
      homeTeamId: 'team-h', awayTeamId: 'team-a',
      homeTeamName: 'Hungary', homeTeamShortCode: 'HUN', homeTeamFlagUrl: null,
      awayTeamName: 'France', awayTeamShortCode: 'FRA', awayTeamFlagUrl: null,
      predHomeGoals: 1, predAwayGoals: 0, resultHomeGoals: 2, resultAwayGoals: 1,
      pointsGlobal: 1, groupPoints: null,
    }] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.predictions[0]!.points).toBe(1)
  })

  it('sets doubledByFavorite: true when flag active and fav team plays', async () => {
    setupCalls({ groupExists: true, flag: true, predictionRows: [{
      predictionId: 'pred-1', matchId: 'match-1',
      scheduledAt: new Date('2026-06-14T18:00:00Z'), leagueId: 'league-1',
      homeTeamId: 'team-h', awayTeamId: 'team-a',
      homeTeamName: 'Hungary', homeTeamShortCode: 'HUN', homeTeamFlagUrl: null,
      awayTeamName: 'France', awayTeamShortCode: 'FRA', awayTeamFlagUrl: null,
      predHomeGoals: 2, predAwayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1,
      pointsGlobal: 3, groupPoints: 6,
    }], favorites: [{ leagueId: 'league-1', teamId: 'team-h' }] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.predictions[0]!.doubledByFavorite).toBe(true)
  })

  it('sets doubledByFavorite: false when flag is disabled', async () => {
    setupCalls({ groupExists: true, flag: false, predictionRows: [{
      predictionId: 'pred-1', matchId: 'match-1',
      scheduledAt: new Date('2026-06-14T18:00:00Z'), leagueId: 'league-1',
      homeTeamId: 'team-h', awayTeamId: 'team-a',
      homeTeamName: 'Hungary', homeTeamShortCode: 'HUN', homeTeamFlagUrl: null,
      awayTeamName: 'France', awayTeamShortCode: 'FRA', awayTeamFlagUrl: null,
      predHomeGoals: 2, predAwayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1,
      pointsGlobal: 3, groupPoints: 3,
    }] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.predictions[0]!.doubledByFavorite).toBe(false)
  })

  it('sets doubledByFavorite: false when user has no fav for the league', async () => {
    setupCalls({ groupExists: true, flag: true, predictionRows: [{
      predictionId: 'pred-1', matchId: 'match-1',
      scheduledAt: new Date('2026-06-14T18:00:00Z'), leagueId: 'league-1',
      homeTeamId: 'team-h', awayTeamId: 'team-a',
      homeTeamName: 'Hungary', homeTeamShortCode: 'HUN', homeTeamFlagUrl: null,
      awayTeamName: 'France', awayTeamShortCode: 'FRA', awayTeamFlagUrl: null,
      predHomeGoals: 2, predAwayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1,
      pointsGlobal: 3, groupPoints: 3,
    }], favorites: [] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.predictions[0]!.doubledByFavorite).toBe(false)
  })

  it('totalPoints equals sum of all prediction points', async () => {
    setupCalls({ groupExists: true, flag: false, predictionRows: [
      { predictionId: 'p1', matchId: 'm1', scheduledAt: new Date('2026-06-14T18:00:00Z'), leagueId: null, homeTeamId: 'th', awayTeamId: 'ta', homeTeamName: 'A', homeTeamShortCode: 'A', homeTeamFlagUrl: null, awayTeamName: 'B', awayTeamShortCode: 'B', awayTeamFlagUrl: null, predHomeGoals: 1, predAwayGoals: 0, resultHomeGoals: 1, resultAwayGoals: 0, pointsGlobal: 3, groupPoints: null },
      { predictionId: 'p2', matchId: 'm2', scheduledAt: new Date('2026-06-15T18:00:00Z'), leagueId: null, homeTeamId: 'th', awayTeamId: 'ta', homeTeamName: 'A', homeTeamShortCode: 'A', homeTeamFlagUrl: null, awayTeamName: 'B', awayTeamShortCode: 'B', awayTeamFlagUrl: null, predHomeGoals: 0, predAwayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 0, pointsGlobal: 0, groupPoints: null },
    ] })
    const result = await getMyGroupPredictions(GROUP_ID, USER_ID)
    expect(result.totalPoints).toBe(3)
  })
})
