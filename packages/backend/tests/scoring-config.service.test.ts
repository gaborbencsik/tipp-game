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
  mockLeftJoin,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn().mockResolvedValue([])
  const mockInsertValues = vi.fn()
  const mockInsert = vi.fn()
  const mockReturning = vi.fn().mockResolvedValue([])
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockSelectWhere = vi.fn()
  const mockUpdateWhere = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  const mockSet = vi.fn()
  const mockUpdate = vi.fn()
  const mockLeftJoin = vi.fn()

  return {
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
    mockLeftJoin,
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
  getGlobalConfig,
  updateGlobalConfig,
  getGroupConfig,
  setGroupConfig,
} from '../src/services/scoring-config.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')

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
  createdAt: NOW,
  updatedAt: NOW,
  groupScoringConfigId: 'config-uuid-2',
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

function setupSelectChain(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows)
  mockSelectWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockSelectWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupSelectWithLeftJoinChain(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows)
  mockSelectWhere.mockReturnValue({ limit: mockLimit })
  mockLeftJoin.mockReturnValue({ where: mockSelectWhere })
  mockFrom.mockReturnValue({ leftJoin: mockLeftJoin })
  mockSelect.mockReturnValue({ from: mockFrom })
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

  it('getGlobalConfig() → returns the global config', async () => {
    setupSelectChain([CONFIG_ROW])
    const result = await getGlobalConfig()
    expect(result).toEqual(CONFIG_API)
  })

  it('getGlobalConfig() → 404 if no global default exists', async () => {
    setupSelectChain([])
    await expect(getGlobalConfig()).rejects.toMatchObject({ status: 404, message: 'Global scoring config not found' })
  })

  // ─── updateGlobalConfig ───────────────────────────────────────────────────

  it('updateGlobalConfig() → updates and returns the config', async () => {
    const updatedRow = { ...CONFIG_ROW, exactScore: 5 }
    setupSelectChain([CONFIG_ROW])
    setupUpdateChain([updatedRow])
    const result = await updateGlobalConfig({
      exactScore: 5,
      correctWinnerAndDiff: 2,
      correctWinner: 1,
      correctDraw: 2,
      correctOutcome: 1,
      incorrect: 0,
    })
    expect(result.exactScore).toBe(5)
  })

  it('updateGlobalConfig() → 404 if no global default exists', async () => {
    setupSelectChain([])
    await expect(updateGlobalConfig({
      exactScore: 5,
      correctWinnerAndDiff: 2,
      correctWinner: 1,
      correctDraw: 2,
      correctOutcome: 1,
      incorrect: 0,
    })).rejects.toMatchObject({ status: 404 })
  })

  // ─── getGroupConfig ───────────────────────────────────────────────────────

  it('getGroupConfig() → returns the group-specific config', async () => {
    setupSelectWithLeftJoinChain([GROUP_CONFIG_ROW])
    const result = await getGroupConfig('group-uuid-1')
    expect(result).not.toBeNull()
    expect(result?.exactScore).toBe(5)
  })

  it('getGroupConfig() → returns null if group has no override', async () => {
    const noOverrideRow = { ...GROUP_CONFIG_ROW, groupScoringConfigId: null }
    setupSelectWithLeftJoinChain([noOverrideRow])
    const result = await getGroupConfig('group-uuid-1')
    expect(result).toBeNull()
  })

  it('getGroupConfig() → 404 if group not found', async () => {
    setupSelectWithLeftJoinChain([])
    await expect(getGroupConfig('nonexistent')).rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })

  // ─── setGroupConfig ───────────────────────────────────────────────────────

  it('setGroupConfig() → creates new config when group has none', async () => {
    const groupRow = { id: 'group-uuid-1', scoringConfigId: null }
    const newConfigRow = { ...GROUP_CONFIG_ROW, id: 'config-uuid-new' }

    // First select: get group (limit chain)
    mockLimit.mockResolvedValueOnce([groupRow])
    mockSelectWhere.mockReturnValueOnce({ limit: mockLimit })
    mockFrom.mockReturnValueOnce({ where: mockSelectWhere })
    mockSelect.mockReturnValueOnce({ from: mockFrom })

    // Insert new config
    setupInsertChain([newConfigRow])

    // Update groups.scoring_config_id
    const mockUpdateReturning = vi.fn().mockResolvedValue([])
    const mockUpdateSet2 = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: mockUpdateReturning }) })
    mockUpdate.mockReturnValueOnce({ set: mockUpdateSet2 })

    const result = await setGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactScore).toBe(5)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('setGroupConfig() → updates existing config when group already has one', async () => {
    const groupRow = { id: 'group-uuid-1', scoringConfigId: 'config-uuid-2' }
    const updatedConfigRow = { ...GROUP_CONFIG_ROW, exactScore: 5 }

    // First select: get group
    mockLimit.mockResolvedValueOnce([groupRow])
    mockSelectWhere.mockReturnValueOnce({ limit: mockLimit })
    mockFrom.mockReturnValueOnce({ where: mockSelectWhere })
    mockSelect.mockReturnValueOnce({ from: mockFrom })

    // Update existing config
    setupUpdateChain([updatedConfigRow])

    const result = await setGroupConfig('group-uuid-1', SCORING_INPUT)
    expect(result.exactScore).toBe(5)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('setGroupConfig() → 404 if group not found', async () => {
    mockLimit.mockResolvedValueOnce([])
    mockSelectWhere.mockReturnValueOnce({ limit: mockLimit })
    mockFrom.mockReturnValueOnce({ where: mockSelectWhere })
    mockSelect.mockReturnValueOnce({ from: mockFrom })

    await expect(setGroupConfig('nonexistent', SCORING_INPUT)).rejects.toMatchObject({ status: 404, message: 'Group not found' })
  })
})
