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
  createLeague,
  updateLeague,
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
  status: 'active' as 'active' | 'archived',
  syncEnabled: false,
  externalId: null as number | null,
  season: null as number | null,
  syncFrom: null as Date | null,
  syncTo: null as Date | null,
  fixtureAllowlist: null as number[] | null,
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

  it('default (no options) → filters status = active via where', async () => {
    mockSelectWhere.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockResolvedValue([LEAGUE_ROW])

    const result = await getLeagues()

    expect(mockSelectWhere).toHaveBeenCalledOnce()
    expect(result).toHaveLength(1)
    expect(result[0]?.status).toBe('active')
    expect(result[0]?.archivedAt).toBeNull()
  })

  it('includeArchived: true → no where filter, returns all leagues', async () => {
    mockFrom.mockReturnValue({ orderBy: mockOrderBy })
    const archivedRow = { ...LEAGUE_ROW, id: 'l2', status: 'archived' as const }
    mockOrderBy.mockResolvedValue([LEAGUE_ROW, archivedRow])

    const result = await getLeagues({ includeArchived: true })

    expect(mockSelectWhere).not.toHaveBeenCalled()
    expect(result).toHaveLength(2)
    expect(result[1]?.status).toBe('archived')
    expect(result[1]?.archivedAt).toBe(NOW.toISOString())
  })

  it('maps archived status to a derived archivedAt ISO string', async () => {
    mockFrom.mockReturnValue({ orderBy: mockOrderBy })
    mockOrderBy.mockResolvedValue([{ ...LEAGUE_ROW, status: 'archived' }])

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

  it('active league → sets status archived, writes audit log, returns updated league', async () => {
    setupSelectChain([LEAGUE_ROW])
    setupUpdateChain([{ ...LEAGUE_ROW, status: 'archived' }])
    setupInsertChain()

    const result = await archiveLeague('league-uuid-1', ACTOR_ID)

    expect(mockSet).toHaveBeenCalledOnce()
    const [setArg] = mockSet.mock.calls[0] as [Record<string, unknown>]
    expect(setArg['status']).toBe('archived')
    expect(result.status).toBe('archived')
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

  it('already archived → idempotent: no update, no audit log', async () => {
    const alreadyArchived = { ...LEAGUE_ROW, status: 'archived' as const }
    setupSelectChain([alreadyArchived])
    setupInsertChain()

    const result = await archiveLeague('league-uuid-1', ACTOR_ID)

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
    expect(result.status).toBe('archived')
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

  it('archived league → sets status active, writes audit log, returns updated league', async () => {
    const archived = { ...LEAGUE_ROW, status: 'archived' as const }
    setupSelectChain([archived])
    setupUpdateChain([{ ...LEAGUE_ROW, status: 'active' }])
    setupInsertChain()

    const result = await restoreLeague('league-uuid-1', ACTOR_ID)

    expect(mockSet).toHaveBeenCalledOnce()
    const [setArg] = mockSet.mock.calls[0] as [Record<string, unknown>]
    expect(setArg['status']).toBe('active')
    expect(result.status).toBe('active')
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
    expect(result.status).toBe('active')
  })
})

// ─── createLeague ─────────────────────────────────────────────────────────────

describe('createLeague', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // uniqueness check: select().from().where().limit() → no conflict
    setupSelectChain([])
    // insert().values().returning()
    mockReturning.mockResolvedValue([LEAGUE_ROW])
    mockValues.mockReturnValue({ returning: mockReturning })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('persists all sync fields and maps them back', async () => {
    const syncedRow = {
      ...LEAGUE_ROW,
      syncEnabled: true,
      externalId: 1,
      season: 2026,
      syncFrom: new Date('2026-06-01T00:00:00.000Z'),
      syncTo: new Date('2026-07-31T00:00:00.000Z'),
      fixtureAllowlist: [10, 11],
    }
    mockReturning.mockResolvedValue([syncedRow])

    const result = await createLeague({
      name: 'World Cup 2026',
      shortName: 'WC2026',
      syncEnabled: true,
      externalId: 1,
      season: 2026,
      syncFrom: '2026-06-01T00:00:00.000Z',
      syncTo: '2026-07-31T00:00:00.000Z',
      fixtureAllowlist: [10, 11],
    })

    const [values] = mockValues.mock.calls[0] as [Record<string, unknown>]
    expect(values['syncEnabled']).toBe(true)
    expect(values['externalId']).toBe(1)
    expect(values['season']).toBe(2026)
    expect(values['fixtureAllowlist']).toEqual([10, 11])
    expect(result.externalId).toBe(1)
    expect(result.season).toBe(2026)
    expect(result.syncEnabled).toBe(true)
    expect(result.syncFrom).toBe('2026-06-01T00:00:00.000Z')
    expect(result.fixtureAllowlist).toEqual([10, 11])
  })

  it('defaults: syncEnabled false and status active when omitted', async () => {
    await createLeague({ name: 'L', shortName: 'L' })

    const [values] = mockValues.mock.calls[0] as [Record<string, unknown>]
    expect(values['syncEnabled']).toBe(false)
    expect(values['status']).toBe('active')
  })

  it('rejects duplicate externalId with 409', async () => {
    // uniqueness check returns an existing row
    mockLimit.mockResolvedValue([{ id: 'other' }])
    mockSelectWhere.mockReturnValue({ limit: mockLimit })

    await expect(
      createLeague({ name: 'L', shortName: 'L', externalId: 1 }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('rejects season out of range with 422', async () => {
    await expect(
      createLeague({ name: 'L', shortName: 'L', season: 1900 }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects syncFrom after syncTo with 422', async () => {
    await expect(
      createLeague({
        name: 'L',
        shortName: 'L',
        syncFrom: '2026-08-01T00:00:00.000Z',
        syncTo: '2026-06-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects syncEnabled true without externalId with 422', async () => {
    await expect(
      createLeague({ name: 'L', shortName: 'L', syncEnabled: true }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('rejects non-positive fixtureAllowlist entries with 422', async () => {
    await expect(
      createLeague({ name: 'L', shortName: 'L', fixtureAllowlist: [1, -3] }),
    ).rejects.toMatchObject({ status: 422 })
  })
})

// ─── updateLeague ─────────────────────────────────────────────────────────────

describe('updateLeague', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setupSelectChain([])
    setupUpdateChain([LEAGUE_ROW])
  })

  it('partial update: only provided fields are set', async () => {
    setupUpdateChain([{ ...LEAGUE_ROW, syncEnabled: true, externalId: 5 }])

    await updateLeague('league-uuid-1', { syncEnabled: true, externalId: 5 })

    const [setArg] = mockSet.mock.calls[0] as [Record<string, unknown>]
    expect(setArg['syncEnabled']).toBe(true)
    expect(setArg['externalId']).toBe(5)
    expect(setArg).not.toHaveProperty('name')
    expect(setArg).not.toHaveProperty('shortName')
  })

  it('rejects duplicate externalId on another league with 409', async () => {
    mockLimit.mockResolvedValue([{ id: 'another-league' }])
    mockSelectWhere.mockReturnValue({ limit: mockLimit })

    await expect(
      updateLeague('league-uuid-1', { externalId: 1 }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('allows the same externalId on the same league (no conflict)', async () => {
    mockLimit.mockResolvedValue([{ id: 'league-uuid-1' }])
    mockSelectWhere.mockReturnValue({ limit: mockLimit })
    setupUpdateChain([{ ...LEAGUE_ROW, externalId: 1 }])

    const result = await updateLeague('league-uuid-1', { externalId: 1 })
    expect(result.externalId).toBe(1)
  })

  it('rejects season out of range with 422', async () => {
    await expect(
      updateLeague('league-uuid-1', { season: 3000 }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('non-existing league → AppError 404', async () => {
    setupUpdateChain([])
    await expect(
      updateLeague('nope', { name: 'X' }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

