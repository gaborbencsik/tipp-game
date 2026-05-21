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
const FROZEN_AT = new Date('2026-05-01T10:00:00.000Z')

const CONFIG_ROW = {
  id: 'config-uuid-1',
  name: 'Default',
  isGlobalDefault: true,
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
  frozenAt: null,
  createdAt: NOW,
  updatedAt: NOW,
}

const CONFIG_API: ScoringConfigFull = {
  id: 'config-uuid-1',
  name: 'Default',
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
  frozenAt: null,
}

const GROUP_CONFIG_ROW = {
  id: 'config-uuid-2',
  name: 'Group Override',
  isGlobalDefault: false,
  exactScore: 5,
  correctWinnerAndDiff: 3,
  correctWinner: 2,
  correctDraw: 3,
  correctOutcome: 1,
  incorrect: 0,
  frozenAt: null,
  createdAt: NOW,
  updatedAt: NOW,
}

const SCORING_INPUT = {
  exactScore: 5,
  correctWinnerAndDiff: 3,
  correctWinner: 2,
  correctDraw: 3,
  correctOutcome: 1,
  incorrect: 0,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Push a single select(...).from(...).where(...).limit() result onto the queue */
function queueSelectLimit(rows: unknown[]) {
  mockLimit.mockResolvedValueOnce(rows)
  mockSelectWhere.mockReturnValueOnce({ limit: mockLimit })
  mockFrom.mockReturnValueOnce({ where: mockSelectWhere })
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

/** Push a select().from() that ends in `.from(...)` (no where) — used for count(*) */
function queueSelectCount(value: number) {
  // select(...).from(table)
  const fromResult = Promise.resolve([{ count: value }])
  mockFrom.mockReturnValueOnce(fromResult)
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

/** Push a select().from().innerJoin().where() chain (group impact predictions count) */
function queueSelectJoinCount(value: number) {
  const wherePromise = Promise.resolve([{ count: value }])
  mockSelectWhere.mockReturnValueOnce(wherePromise)
  mockInnerJoin.mockReturnValueOnce({ where: mockSelectWhere })
  mockFrom.mockReturnValueOnce({ innerJoin: mockInnerJoin })
  mockSelect.mockReturnValueOnce({ from: mockFrom })
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

  it('getGlobalConfig() → returns the global config (frozenAt null)', async () => {
    queueSelectLimit([CONFIG_ROW])
    const result = await getGlobalConfig()
    expect(result).toEqual(CONFIG_API)
  })

  it('getGlobalConfig() → frozenAt is ISO string when frozen', async () => {
    queueSelectLimit([{ ...CONFIG_ROW, frozenAt: FROZEN_AT }])
    const result = await getGlobalConfig()
    expect(result.frozenAt).toBe(FROZEN_AT.toISOString())
  })

  it('getGlobalConfig() → 404 if no global default exists', async () => {
    queueSelectLimit([])
    await expect(getGlobalConfig()).rejects.toMatchObject({ status: 404, message: 'Global scoring config not found' })
  })

  // ─── getGlobalConfigWithImpact ────────────────────────────────────────────

  it('getGlobalConfigWithImpact() → adds affected counts', async () => {
    queueSelectLimit([CONFIG_ROW])
    queueSelectCount(7)
    queueSelectCount(42)
    const result = await getGlobalConfigWithImpact()
    expect(result.affectedMatches).toBe(7)
    expect(result.affectedPredictions).toBe(42)
  })

  // ─── updateGlobalConfig ───────────────────────────────────────────────────

  it('updateGlobalConfig() → updates and returns the config', async () => {
    queueSelectLimit([CONFIG_ROW])
    const updatedRow = { ...CONFIG_ROW, exactScore: 5 }
    setupUpdateChain([updatedRow])
    const result = await updateGlobalConfig(SCORING_INPUT)
    expect(result.exactScore).toBe(5)
  })

  it('updateGlobalConfig() → 409 if config is frozen', async () => {
    queueSelectLimit([{ ...CONFIG_ROW, frozenAt: FROZEN_AT }])
    await expect(updateGlobalConfig(SCORING_INPUT)).rejects.toMatchObject({ status: 409, message: 'Scoring config is frozen' })
  })

  it('updateGlobalConfig() → 404 if no global default exists', async () => {
    queueSelectLimit([])
    await expect(updateGlobalConfig(SCORING_INPUT)).rejects.toMatchObject({ status: 404 })
  })

  // ─── overrideGlobalConfig ─────────────────────────────────────────────────

  it('overrideGlobalConfig() → ignores frozenAt and clears it', async () => {
    queueSelectLimit([{ ...CONFIG_ROW, frozenAt: FROZEN_AT }])
    setupUpdateChain([{ ...CONFIG_ROW, exactScore: 5, frozenAt: null }])
    const result = await overrideGlobalConfig(SCORING_INPUT)
    expect(result.frozenAt).toBeNull()
    expect(result.exactScore).toBe(5)
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ frozenAt: null }))
  })

  // ─── getGroupConfig ───────────────────────────────────────────────────────

  it('getGroupConfig() → returns the group-specific config', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    queueSelectLimit([GROUP_CONFIG_ROW])
    const result = await getGroupConfig('group-uuid-1')
    expect(result).not.toBeNull()
    expect(result?.exactScore).toBe(5)
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
    queueSelectCount(3)
    queueSelectJoinCount(11)
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
    const groupRow = { id: 'group-uuid-1', scoringConfigId: null }
    const newConfigRow = { ...GROUP_CONFIG_ROW, id: 'config-uuid-new' }

    queueSelectLimit([groupRow])
    setupInsertChain([newConfigRow])

    const mockUpdateSet2 = vi.fn().mockReturnValue({ where: vi.fn() })
    mockUpdate.mockReturnValueOnce({ set: mockUpdateSet2 })

    const result = await setGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactScore).toBe(5)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('setGroupConfig() → updates existing config when group already has one', async () => {
    const groupRow = { id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }
    const updatedConfigRow = { ...GROUP_CONFIG_ROW, exactScore: 5 }

    queueSelectLimit([groupRow])
    queueSelectLimit([GROUP_CONFIG_ROW])
    setupUpdateChain([updatedConfigRow])

    const result = await setGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactScore).toBe(5)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('setGroupConfig() → 409 if existing config is frozen', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    queueSelectLimit([{ ...GROUP_CONFIG_ROW, frozenAt: FROZEN_AT }])
    await expect(setGroupConfig('group-uuid-1', SCORING_INPUT)).rejects.toMatchObject({ status: 409, message: 'Scoring config is frozen' })
  })

  it('setGroupConfig() → 404 if group not found', async () => {
    queueSelectLimit([])
    await expect(setGroupConfig('nonexistent', SCORING_INPUT)).rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  // ─── overrideGroupConfig ──────────────────────────────────────────────────

  it('overrideGroupConfig() → ignores frozenAt and clears it on existing config', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }])
    setupUpdateChain([{ ...GROUP_CONFIG_ROW, exactScore: 5, frozenAt: null }])
    const result = await overrideGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.frozenAt).toBeNull()
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ frozenAt: null }))
  })

  it('overrideGroupConfig() → creates new config when group has none', async () => {
    queueSelectLimit([{ id: 'group-uuid-1', scoringConfigId: null }])
    setupInsertChain([{ ...GROUP_CONFIG_ROW, id: 'config-new' }])
    const mockUpdateSet2 = vi.fn().mockReturnValue({ where: vi.fn() })
    mockUpdate.mockReturnValueOnce({ set: mockUpdateSet2 })
    const result = await overrideGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactScore).toBe(5)
  })
})
