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
} = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([])
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockSelectWhere = vi.fn()
  const mockUpdateWhere = vi.fn()
  const mockFrom = vi.fn()
  const mockSelect = vi.fn()
  const mockSet = vi.fn()
  const mockUpdate = vi.fn()

  return {
    mockSelect,
    mockFrom,
    mockSelectWhere,
    mockLimit,
    mockUpdate,
    mockSet,
    mockUpdateWhere,
    mockReturning,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}))

import {
  getGlobalConfig,
  updateGlobalConfig,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupSelectChain(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows)
  mockSelectWhere.mockReturnValue({ limit: mockLimit })
  mockFrom.mockReturnValue({ where: mockSelectWhere })
  mockSelect.mockReturnValue({ from: mockFrom })
}

function setupUpdateChain(rows: unknown[]) {
  mockReturning.mockResolvedValue(rows)
  mockUpdateWhere.mockReturnValue({ returning: mockReturning })
  mockSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
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
})
