import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { League } from '../src/types/index.js'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const {
  mockSelect,
  mockFrom,
  mockSelectWhere,
  mockOrderBy,
  mockLimit,
  mockUpdate,
  mockSet,
  mockUpdateWhere,
  mockReturning,
  mockInsert,
  mockValues,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockSelectWhere = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  const mockReturning = vi.fn().mockResolvedValue([])
  const mockUpdateWhere = vi.fn()
  const mockSet = vi.fn()
  const mockUpdate = vi.fn()
  const mockValues = vi.fn().mockResolvedValue(undefined)
  const mockInsert = vi.fn()
  return {
    mockSelect, mockFrom, mockSelectWhere, mockOrderBy, mockLimit,
    mockUpdate, mockSet, mockUpdateWhere, mockReturning, mockInsert, mockValues,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}))

import {
  getLeagues,
  archiveLeague,
  restoreLeague,
} from '../src/services/leagues.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-07-21T00:00:00.000Z')

const LEAGUE_ROW = {
  id: 'league-uuid-1',
  name: 'World Cup 2026',
  shortName: 'WC2026',
  startsAt: null,
  archivedAt: null as Date | null,
  createdAt: NOW,
  updatedAt: NOW,
}

const ACTOR_ID = 'actor-uuid-99'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupSelectChain(rows: unknown[]): void {
  mockOrderBy.mockResolvedValue(rows)
  mockLimit.mockResolvedValue(rows)
  mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
  // getLeagues with no filter calls .from().orderBy() directly (no where)
  mockFrom.mockReturnValue({ orderBy: mockOrderBy, where: mockSelectWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateChain(rows: unknown[]): void {
  mockReturning.mockResolvedValue(rows)
  mockUpdateWhere.mockReturnValue({ returning: mockReturning })
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

function setupInsertChain(): void {
  mockValues.mockResolvedValue(undefined)
  mockInsert.mockReturnValue({ values: mockValues })
}

// ─── getLeagues ─────────────────────────────────────────────────────────────

describe('getLeagues', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupSelectChain([])
  })

  it('default (no options) → filters archivedAt IS NULL via where', async () => {
    mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockResolvedValue([LEAGUE_ROW])

    const result = await getLeagues()

    expect(mockSelectWhere).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
    expect(result[0]?.archivedAt).toBeNull()
  })

  it('includeArchived: true → no where filter, returns all leagues', async () => {
    mockFrom.mockReturnValue({ orderBy: mockOrderBy })
    const archivedRow = { ...LEAGUE_ROW, id: 'l2', archivedAt: NOW }
    mockOrderBy.mockResolvedValue([LEAGUE_ROW, archivedRow])

    const result = await getLeagues({ includeArchived: true })

    expect(mockSelectWhere).not.toHaveBeenCalled()
    expect(result).toHaveLength(2)
    expect(result[1]?.archivedAt).toBe(NOW.toISOString())
  })

  it('maps archivedAt to ISO string when set', async () => {
    mockFrom.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockResolvedValue([{ ...LEAGUE_ROW, archivedAt: NOW }])

    const result = await getLeagues({ includeArchived: true })

    expect(result[0]?.archivedAt).toBe(NOW.toISOString())
  })
})

// ─── archiveLeague ────────────────────────────────────────────────────────────

describe('archiveLeague', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('non-existing league → AppError 404', async () => {
    setupSelectChain([])
    await expect(archiveLeague('nonexistent', ACTOR_ID)).rejects.toMatchObject({
      status: 404,
      message: 'League not found',
    })
  })

  it('active league → sets archivedAt, writes audit log, returns updated league', async () => {
    setupSelectChain([LEAGUE_ROW])
    setupUpdateChain([{ ...LEAGUE_ROW, archivedAt: NOW }])
    setupInsertChain()

    const result = await archiveLeague('league-uuid-1', ACTOR_ID)

    expect(mockSet).toHaveBeenCalledOnce()
    const [setArg] = mockSet.mock.calls[0] as [Record<string, unknown>]
    expect(setArg['archivedAt']).toBeInstanceOf(Date)
    expect(result.archivedAt).toBe(NOW.toISOString())

    expect(mockValues).toHaveBeenCalledOnce()
    const [auditArg] = mockValues.mock.calls[0] as [Record<string, unknown>]
    expect(auditArg).toMatchObject({
      actorId: ACTOR_ID,
      action: 'league_archive',
      entityType: 'league',
      entityId: 'league-uuid-1',
    })
  })

  it('already archived → idempotent: does not overwrite timestamp, no audit log', async () => {
    const alreadyArchived = { ...LEAGUE_ROW, archivedAt: NOW }
    setupSelectChain([alreadyArchived])
    setupInsertChain()

    const result = await archiveLeague('league-uuid-1', ACTOR_ID)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result.archivedAt).toBe(NOW.toISOString())
  })
})

// ─── restoreLeague ────────────────────────────────────────────────────────────

describe('restoreLeague', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('non-existing league → AppError 404', async () => {
    setupSelectChain([])
    await expect(restoreLeague('nonexistent', ACTOR_ID)).rejects.toMatchObject({
      status: 404,
      message: 'League not found',
    })
  })

  it('archived league → nulls archivedAt, writes audit log, returns updated league', async () => {
    const archived = { ...LEAGUE_ROW, archivedAt: NOW }
    setupSelectChain([archived])
    setupUpdateChain([{ ...LEAGUE_ROW, archivedAt: null }])
    setupInsertChain()

    const result = await restoreLeague('league-uuid-1', ACTOR_ID)

    expect(mockSet).toHaveBeenCalledOnce()
    const [setArg] = mockSet.mock.calls[0] as [Record<string, unknown>]
    expect(setArg['archivedAt']).toBeNull()
    expect(result.archivedAt).toBeNull()

    expect(mockValues).toHaveBeenCalledOnce()
    const [auditArg] = mockValues.mock.calls[0] as [Record<string, unknown>]
    expect(auditArg).toMatchObject({
      actorId: ACTOR_ID,
      action: 'league_restore',
      entityType: 'league',
      entityId: 'league-uuid-1',
    })
  })

  it('already active → idempotent: no update, no audit log', async () => {
    setupSelectChain([LEAGUE_ROW])
    setupInsertChain()

    const result = await restoreLeague('league-uuid-1', ACTOR_ID)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result.archivedAt).toBeNull()
  })
})
