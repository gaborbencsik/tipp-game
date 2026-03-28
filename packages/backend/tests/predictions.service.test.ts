import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Prediction } from '../src/types/index.js'

// ─── DB mock (vi.hoisted) ─────────────────────────────────────────────────────

const {
  mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit,
  mockInsert, mockValues, mockOnConflictDoUpdate, mockReturning,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([])
  const mockLimit = vi.fn().mockResolvedValue([])
  const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy, limit: mockLimit }))
  const mockLeftJoin = vi.fn(function () {
    return { leftJoin: mockLeftJoin, where: mockWhere }
  })
  const mockFrom = vi.fn(() => ({ where: mockWhere, leftJoin: mockLeftJoin }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))

  const mockReturning = vi.fn().mockResolvedValue([])
  const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }))
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))

  return {
    mockSelect, mockFrom, mockWhere, mockOrderBy, mockLimit,
    mockInsert, mockValues, mockOnConflictDoUpdate, mockReturning,
  }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

import { upsertPrediction, getPredictionsForUser } from '../src/services/predictions.service.js'
import * as schema from '../src/db/schema/index.js'

// ─── Fixture adatok ───────────────────────────────────────────────────────────

const SUPABASE_ID = 'supabase-uuid-abc'
const DB_USER_ID = 'db-user-uuid-001'
const MATCH_ID = 'match-uuid-001'

const DB_USER_ROW = {
  id: DB_USER_ID,
  supabaseId: SUPABASE_ID,
  email: 'user@example.com',
  displayName: 'Test User',
  avatarUrl: null,
  role: 'user' as const,
  bannedAt: null,
  banReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

const FUTURE_MATCH_ROW = {
  id: MATCH_ID,
  homeTeamId: 'ht-uuid',
  awayTeamId: 'at-uuid',
  venueId: null,
  stage: 'group' as const,
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // holnap
  status: 'scheduled' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

const PAST_MATCH_ROW = {
  ...FUTURE_MATCH_ROW,
  scheduledAt: new Date(Date.now() - 1000 * 60 * 60), // 1 órája volt
}

const PREDICTION_ROW = {
  id: 'pred-uuid-001',
  userId: DB_USER_ID,
  matchId: MATCH_ID,
  homeGoals: 2,
  awayGoals: 1,
  pointsGlobal: null,
  createdAt: new Date('2026-06-10T10:00:00Z'),
  updatedAt: new Date('2026-06-10T10:00:00Z'),
}

const VALID_INPUT = { matchId: MATCH_ID, homeGoals: 2, awayGoals: 1 }

// ─── Segédfüggvény: szekvenciális select mock ─────────────────────────────────

function setupSelectSequence(...results: unknown[][]) {
  let call = 0
  mockLimit.mockImplementation(() => Promise.resolve(results[call++] ?? []))
  mockOrderBy.mockImplementation(() => Promise.resolve(results[call++] ?? []))
}

// ─── upsertPrediction ─────────────────────────────────────────────────────────

describe('upsertPrediction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })
    mockReturning.mockResolvedValue([PREDICTION_ROW])
    mockOnConflictDoUpdate.mockReturnValue({ returning: mockReturning })
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate })
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('ismeretlen supabaseId → AppError 404', async () => {
    mockLimit.mockResolvedValue([]) // user not found
    await expect(upsertPrediction(SUPABASE_ID, VALID_INPUT)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('ismeretlen matchId → AppError 404', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW]) // user found
      return Promise.resolve([]) // match not found
    })
    await expect(upsertPrediction(SUPABASE_ID, VALID_INPUT)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('scheduledAt múltban → AppError 409', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([PAST_MATCH_ROW])
    })
    await expect(upsertPrediction(SUPABASE_ID, VALID_INPUT)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('status !== scheduled → AppError 409', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([{ ...FUTURE_MATCH_ROW, status: 'finished' }])
    })
    await expect(upsertPrediction(SUPABASE_ID, VALID_INPUT)).rejects.toMatchObject({
      status: 409,
    })
  })

  it('érvényes input → db.insert meghívva, Prediction visszaadva', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([FUTURE_MATCH_ROW])
    })

    const result = await upsertPrediction(SUPABASE_ID, VALID_INPUT)

    expect(mockInsert).toHaveBeenCalledWith(schema.predictions)
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: DB_USER_ID,
        matchId: MATCH_ID,
        homeGoals: 2,
        awayGoals: 1,
      })
    )
    expect(result.id).toBe('pred-uuid-001')
    expect(result.homeGoals).toBe(2)
    expect(result.awayGoals).toBe(1)
    expect(typeof result.createdAt).toBe('string')
    expect(typeof result.updatedAt).toBe('string')
  })

  it('conflict (meglévő tipp) → onConflictDoUpdate meghívva', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([FUTURE_MATCH_ROW])
    })

    await upsertPrediction(SUPABASE_ID, VALID_INPUT)

    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ homeGoals: 2, awayGoals: 1 }),
      })
    )
  })
})

// ─── getPredictionsForUser ────────────────────────────────────────────────────

describe('getPredictionsForUser', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit })
    mockFrom.mockReturnValue({ where: mockWhere })
    mockSelect.mockReturnValue({ from: mockFrom })
  })

  it('ismeretlen requestingSupabaseId → AppError 404', async () => {
    mockLimit.mockResolvedValue([]) // requesting user not found
    await expect(getPredictionsForUser('unknown-id', DB_USER_ID)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('ismeretlen targetUserId → AppError 404', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([]) // target user not found
    })
    await expect(getPredictionsForUser(SUPABASE_ID, 'unknown-target')).rejects.toMatchObject({
      status: 404,
    })
  })

  it('más user tippjeit kéri, nem admin → AppError 403', async () => {
    const OTHER_USER = { ...DB_USER_ROW, id: 'other-user-uuid' }
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW]) // requesting user (role: user)
      return Promise.resolve([OTHER_USER]) // target user (different id)
    })
    await expect(getPredictionsForUser(SUPABASE_ID, 'other-user-uuid')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('saját tippek lekérése → Prediction[] visszaadva', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([DB_USER_ROW]) // target = self
    })
    mockOrderBy.mockResolvedValue([PREDICTION_ROW])

    const result = await getPredictionsForUser(SUPABASE_ID, DB_USER_ID)

    expect(result).toHaveLength(1)
    const pred = result[0] as Prediction
    expect(pred.id).toBe('pred-uuid-001')
    expect(pred.userId).toBe(DB_USER_ID)
    expect(typeof pred.createdAt).toBe('string')
  })

  it('admin más user tippjeit kéri → Prediction[] visszaadva', async () => {
    const ADMIN_USER = { ...DB_USER_ROW, id: 'admin-uuid', supabaseId: 'admin-supabase-id', role: 'admin' as const }
    const TARGET_USER = { ...DB_USER_ROW, id: 'target-uuid' }
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([ADMIN_USER])
      return Promise.resolve([TARGET_USER])
    })
    mockOrderBy.mockResolvedValue([{ ...PREDICTION_ROW, userId: 'target-uuid' }])

    const result = await getPredictionsForUser('admin-supabase-id', 'target-uuid')
    expect(result).toHaveLength(1)
  })

  it('nincs tipp → [] visszaadva', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      return Promise.resolve([DB_USER_ROW])
    })
    mockOrderBy.mockResolvedValue([])

    const result = await getPredictionsForUser(SUPABASE_ID, DB_USER_ID)
    expect(result).toEqual([])
  })
})
