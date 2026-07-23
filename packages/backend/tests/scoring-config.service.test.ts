import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScoringConfigFull } from '../src/types/index.js'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const {
  mockSelect,
  mockFrom,
  mockSelectWhere,
  mockLimit,
  mockUpdate,
  mockSet,
  mockUpdateWhere,
  mockReturning,
  mockInsert,
  mockInsertValues,
  mockInsertReturning,
  mockInnerJoin,
} = vi.hoisted(() => ({
  mockInsertReturning: vi.fn().mockResolvedValue([]),
  mockInsertValues: vi.fn(),
  mockInsert: vi.fn(),
  mockReturning: vi.fn().mockResolvedValue([]),
  mockLimit: vi.fn().mockResolvedValue([]),
  mockSelectWhere: vi.fn(),
  mockUpdateWhere: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockSet: vi.fn(),
  mockUpdate: vi.fn(),
  mockInnerJoin: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}))

import {
  getGlobalConfig,
  getGlobalConfigWithImpact,
  updateGlobalConfig,
  overrideGlobalConfig,
  getGroupConfig,
  getGroupConfigWithImpact,
  setGroupConfig,
  overrideGroupConfig,
} from '../src/services/scoring-config.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')
const PAST = new Date('2025-12-01T00:00:00.000Z')
const FUTURE = new Date('2027-01-01T00:00:00.000Z')

const CONFIG_ROW = {
  id: 'config-uuid-1',
  name: 'Default',
  isGlobalDefault: true,
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
  createdAt: NOW,
  updatedAt: NOW,
}

const CONFIG_API: ScoringConfigFull = {
  id: 'config-uuid-1',
  name: 'Default',
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
  frozenAt: null,
}

const GROUP_CONFIG_ROW = {
  id: 'config-uuid-2',
  name: 'Group Override',
  isGlobalDefault: false,
  correctOutcomePoints: 2,
  exactBonusPoints: 3,
  extraTimeBonusPoints: 1,
  createdAt: NOW,
  updatedAt: NOW,
}

const SCORING_INPUT = {
  correctOutcomePoints: 2,
  exactBonusPoints: 3,
  extraTimeBonusPoints: 1,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** select(...).from(...).where(...)[.orderBy(...)].limit(...) — used for single-row lookups */
function queueSelectLimit(rows: unknown[]) {
  mockLimit.mockResolvedValueOnce(rows)
  const afterWhere = { orderBy: vi.fn().mockReturnValue({ limit: mockLimit }), limit: mockLimit }
  mockSelectWhere.mockReturnValueOnce(afterWhere)
  mockFrom.mockReturnValueOnce({ where: mockSelectWhere })
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

/** select(...).from(table) — used for leagues / count(*) where chain ends at .from */
function queueSelectFromOnly(rows: unknown[]) {
  mockFrom.mockReturnValueOnce(Promise.resolve(rows))
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

/** select(...).from(...).where(...) — used for groupLeagues / partial count chain */
function queueSelectFromWhere(rows: unknown[]) {
  mockSelectWhere.mockReturnValueOnce(Promise.resolve(rows))
  mockFrom.mockReturnValueOnce({ where: mockSelectWhere })
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

/** select(...).from(...).innerJoin(...).where(...) — used for group impact predictions count */
function queueSelectJoinWhere(rows: unknown[]) {
  mockSelectWhere.mockReturnValueOnce(Promise.resolve(rows))
  mockInnerJoin.mockReturnValueOnce({ where: mockSelectWhere })
  mockFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin })
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

/** Push a not-frozen leagues response (used for global / no-group queries) */
function queueLeaguesNotFrozen() {
  queueSelectFromOnly([{ id: 'l1', startsAt: FUTURE }])
}

/** Push a frozen leagues response (at least one past startsAt) */
function queueLeaguesFrozen() {
  queueSelectFromOnly([{ id: 'l1', startsAt: PAST }])
}

/** Push group-scoped frozen check: leagues + groupLeagues map */
function queueGroupNotFrozen() {
  queueSelectFromOnly([{ id: 'l1', startsAt: FUTURE }])
  queueSelectFromWhere([{ leagueId: 'l1' }])
}

function queueGroupFrozen() {
  queueSelectFromOnly([{ id: 'l1', startsAt: PAST }])
  queueSelectFromWhere([{ leagueId: 'l1' }])
}

function setupUpdateChain(rows: unknown[]) {
  mockReturning.mockResolvedValue(rows)
  mockUpdateWhere.mockReturnValue({ returning: mockReturning })
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

function setupInsertChain(rows: unknown[]) {
  mockInsertReturning.mockResolvedValue(rows)
  mockInsertValues.mockReturnValue({ returning: mockInsertReturning })
  mockInsert.mockReturnValue({ values: mockInsertValues })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('scoring-config.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── getGlobalConfig ──────────────────────────────────────────────────────

  it('getGlobalConfig() → returns the global config (frozenAt null when no past leagues)', async () => {
    queueSelectLimit([CONFIG_ROW])
    queueLeaguesNotFrozen()
    const result = await getGlobalConfig()
    expect(result).toEqual(CONFIG_API)
  })

  it('getGlobalConfig() → frozenAt is ISO string when at least one league has started', async () => {
    queueSelectLimit([CONFIG_ROW])
    queueLeaguesFrozen()
    const result = await getGlobalConfig()
    expect(result.frozenAt).toBe(PAST.toISOString())
  })

  it('getGlobalConfig() → 404 if no global default exists', async () => {
    queueSelectLimit([])
    await expect(getGlobalConfig()).rejects.toMatchObject({ status: 404, message: 'Global scoring config not found' })
  })

  // ─── getGlobalConfigWithImpact ────────────────────────────────────────────

  it('getGlobalConfigWithImpact() → adds affected counts', async () => {
    queueSelectLimit([CONFIG_ROW])
    queueLeaguesNotFrozen()
    queueSelectFromOnly([{ count: 7 }])
    queueSelectFromOnly([{ count: 42 }])
    const result = await getGlobalConfigWithImpact()
    expect(result.affectedMatches).toBe(7)
    expect(result.affectedPredictions).toBe(42)
  })

  // ─── updateGlobalConfig ───────────────────────────────────────────────────

  it('updateGlobalConfig() → updates and returns the config', async () => {
    queueSelectLimit([CONFIG_ROW])
    queueLeaguesNotFrozen()
    setupUpdateChain([{ ...CONFIG_ROW, exactBonusPoints: 3 }])
    const result = await updateGlobalConfig(SCORING_INPUT)
    expect(result.exactBonusPoints).toBe(3)
  })

  it('updateGlobalConfig() → 423 Locked when at least one league has started', async () => {
    queueSelectLimit([CONFIG_ROW])
    queueLeaguesFrozen()
    await expect(updateGlobalConfig(SCORING_INPUT)).rejects.toMatchObject({ status: 423, message: 'Scoring config is frozen' })
  })

  it('updateGlobalConfig() → 404 if no global default exists', async () => {
    queueSelectLimit([])
    await expect(updateGlobalConfig(SCORING_INPUT)).rejects.toMatchObject({ status: 404 })
  })

  // ─── overrideGlobalConfig ─────────────────────────────────────────────────

  it('overrideGlobalConfig() → bypasses frozen check and writes 3 fields only', async () => {
    queueSelectLimit([CONFIG_ROW])
    setupUpdateChain([{ ...CONFIG_ROW, exactBonusPoints: 3 }])
    const result = await overrideGlobalConfig(SCORING_INPUT)
    expect(result.frozenAt).toBeNull()
    expect(result.exactBonusPoints).toBe(3)
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        correctOutcomePoints: SCORING_INPUT.correctOutcomePoints,
        exactBonusPoints: SCORING_INPUT.exactBonusPoints,
        extraTimeBonusPoints: SCORING_INPUT.extraTimeBonusPoints,
      }),
    )
    const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg).not.toHaveProperty('frozenAt')
  })

  // ─── getGroupConfig ───────────────────────────────────────────────────────

  it('getGroupConfig() → returns the group-specific config', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    queueSelectLimit([GROUP_CONFIG_ROW])
    queueGroupNotFrozen()
    const result = await getGroupConfig('group-uuid-1')
    expect(result).not.toBeNull()
    expect(result?.exactBonusPoints).toBe(3)
  })

  it('getGroupConfig() → returns null if group has no override', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: null }])
    const result = await getGroupConfig('group-uuid-1')
    expect(result).toBeNull()
  })

  it('getGroupConfig() → 404 if group not found', async () => {
    queueSelectLimit([])
    await expect(getGroupConfig('nonexistent')).rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  // ─── getGroupConfigWithImpact ─────────────────────────────────────────────

  it('getGroupConfigWithImpact() → adds counts for group members', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    queueSelectLimit([GROUP_CONFIG_ROW])
    queueGroupNotFrozen()
    queueSelectFromOnly([{ count: 3 }])
    queueSelectJoinWhere([{ count: 11 }])
    const result = await getGroupConfigWithImpact('group-uuid-1')
    expect(result?.affectedMatches).toBe(3)
    expect(result?.affectedPredictions).toBe(11)
  })

  it('getGroupConfigWithImpact() → null when no override', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: null }])
    const result = await getGroupConfigWithImpact('group-uuid-1')
    expect(result).toBeNull()
  })

  // ─── setGroupConfig ───────────────────────────────────────────────────────

  it('setGroupConfig() → creates new config when group has none', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: null }])
    queueGroupNotFrozen()
    setupInsertChain([{ ...GROUP_CONFIG_ROW, id: 'config-uuid-new' }])

    const mockUpdateSet2 = vi.fn().mockReturnValue({ where: vi.fn() })
    mockUpdate.mockReturnValueOnce({ set: mockUpdateSet2 })

    const result = await setGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactBonusPoints).toBe(3)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('setGroupConfig() → updates existing config when group already has one', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    queueGroupNotFrozen()
    setupUpdateChain([{ ...GROUP_CONFIG_ROW, exactBonusPoints: 3 }])

    const result = await setGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactBonusPoints).toBe(3)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('setGroupConfig() → 423 Locked when group leagues have started', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    queueGroupFrozen()
    await expect(setGroupConfig('group-uuid-1', SCORING_INPUT)).rejects.toMatchObject({ status: 423, message: 'Scoring config is frozen' })
  })

  it('setGroupConfig() → 404 if group not found', async () => {
    queueSelectLimit([])
    await expect(setGroupConfig('nonexistent', SCORING_INPUT)).rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  // ─── overrideGroupConfig ──────────────────────────────────────────────────

  it('overrideGroupConfig() → bypasses frozen check and writes 3 fields only', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    setupUpdateChain([{ ...GROUP_CONFIG_ROW, exactBonusPoints: 3 }])
    const result = await overrideGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.frozenAt).toBeNull()
    const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>
    expect(setArg).not.toHaveProperty('frozenAt')
    expect(setArg).toMatchObject({
      correctOutcomePoints: SCORING_INPUT.correctOutcomePoints,
      exactBonusPoints: SCORING_INPUT.exactBonusPoints,
      extraTimeBonusPoints: SCORING_INPUT.extraTimeBonusPoints,
    })
  })

  it('overrideGroupConfig() → creates new config when group has none', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: null }])
    setupInsertChain([{ ...GROUP_CONFIG_ROW, id: 'config-new' }])
    const mockUpdateSet2 = vi.fn().mockReturnValue({ where: vi.fn() })
    mockUpdate.mockReturnValueOnce({ set: mockUpdateSet2 })
    const result = await overrideGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactBonusPoints).toBe(3)
  })
})
