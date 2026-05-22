import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect,
  mockSelectDistinctOn,
  mockInsert,
  isNullSpy,
  eqSpy,
  andSpy,
  minSpy,
} = vi.hoisted(() => {
  const isNullSpy = vi.fn((col: unknown) => ({ __op: 'isNull', col }))
  const eqSpy = vi.fn((a: unknown, b: unknown) => ({ __op: 'eq', a, b }))
  const andSpy = vi.fn((...parts: unknown[]) => ({ __op: 'and', parts }))
  const minSpy = vi.fn((col: unknown) => ({ __op: 'min', col }))
  return {
    mockSelect: vi.fn(),
    mockSelectDistinctOn: vi.fn(),
    mockInsert: vi.fn(),
    isNullSpy,
    eqSpy,
    andSpy,
    minSpy,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    selectDistinctOn: mockSelectDistinctOn,
    insert: mockInsert,
  },
}))

vi.mock('../src/db/schema/index.js', () => ({
  matches: {
    leagueId: 'matches.leagueId',
    scheduledAt: 'matches.scheduledAt',
    deletedAt: 'matches.deletedAt',
    homeTeamId: 'matches.homeTeamId',
    awayTeamId: 'matches.awayTeamId',
  },
  teams: { id: 'teams.id', name: 'teams.name', shortCode: 'teams.shortCode', flagUrl: 'teams.flagUrl' },
  userLeagueFavorites: {
    id: 'ulf.id',
    userId: 'ulf.userId',
    leagueId: 'ulf.leagueId',
    teamId: 'ulf.teamId',
    setAt: 'ulf.setAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: eqSpy,
  and: andSpy,
  isNull: isNullSpy,
  min: minSpy,
  sql: Object.assign(vi.fn(() => ({ __op: 'sql' })), { raw: vi.fn() }),
}))

import {
  getFavoritesForUser,
  setFavorite,
  getTeamsForLeague,
} from '../src/services/user-league-favorites.service.js'

interface ChainHandle {
  whereArg: unknown
  resolved: unknown[]
}

function buildSelectChain(rows: unknown[]): ChainHandle {
  const handle: ChainHandle = { whereArg: undefined, resolved: rows }
  const groupBy = vi.fn().mockResolvedValue(rows)
  const where = vi.fn((arg: unknown) => {
    handle.whereArg = arg
    return Object.assign(Promise.resolve(rows), { groupBy })
  })
  const innerJoin = vi.fn(() => ({ where, orderBy: vi.fn().mockResolvedValue(rows) }))
  const from = vi.fn(() => ({ where, innerJoin }))
  mockSelect.mockReturnValueOnce({ from })
  return handle
}

function buildSelectDistinctOnChain(rows: unknown[]): ChainHandle {
  const handle: ChainHandle = { whereArg: undefined, resolved: rows }
  const orderBy = vi.fn().mockResolvedValue(rows)
  const where = vi.fn((arg: unknown) => {
    handle.whereArg = arg
    return { orderBy }
  })
  const innerJoin = vi.fn(() => ({ where }))
  const from = vi.fn(() => ({ innerJoin }))
  mockSelectDistinctOn.mockReturnValueOnce({ from })
  return handle
}

function findIsNullCall(arg: unknown): boolean {
  if (!arg || typeof arg !== 'object') return false
  const op = (arg as { __op?: string }).__op
  if (op === 'isNull') {
    return (arg as { col: unknown }).col === 'matches.deletedAt'
  }
  if (op === 'and') {
    const parts = (arg as { parts: unknown[] }).parts
    return parts.some(findIsNullCall)
  }
  return false
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('user-league-favorites.service deletedAt filtering', () => {
  it('isLeagueLocked (via setFavorite) filters out soft-deleted matches', async () => {
    const lockChain = buildSelectChain([{ earliest: null }])
    // setFavorite also triggers an insert; mock that briefly:
    const returning = vi.fn().mockResolvedValue([
      { id: 'fav-1', userId: 'u1', leagueId: 'l1', teamId: 't1', setAt: new Date() },
    ])
    const onConflictDoUpdate = vi.fn().mockReturnValue({ returning })
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    mockInsert.mockReturnValueOnce({ values })

    await setFavorite('u1', 'l1', 't1')

    expect(findIsNullCall(lockChain.whereArg)).toBe(true)
  })

  it('getLeagueLockMap (via getFavoritesForUser) filters out soft-deleted matches', async () => {
    const favoritesChain = buildSelectChain([{ id: 'f1', userId: 'u1', leagueId: 'l1', teamId: 't1', setAt: new Date() }])
    const lockMapChain = buildSelectChain([{ leagueId: 'l1', earliest: null }])

    await getFavoritesForUser('u1')

    expect(findIsNullCall(lockMapChain.whereArg)).toBe(true)
    expect(favoritesChain.whereArg).toBeDefined()
  })

  it('getTeamsForLeague filters out teams from only-soft-deleted matches', async () => {
    const teamsChain = buildSelectDistinctOnChain([])

    await getTeamsForLeague('l1')

    expect(findIsNullCall(teamsChain.whereArg)).toBe(true)
  })
})
