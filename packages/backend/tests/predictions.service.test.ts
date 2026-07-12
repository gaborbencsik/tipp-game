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

import { upsertPrediction, getPredictionsForUser, getMatchPredictions } from '../src/services/predictions.service.js'
import * as schema from '../src/db/schema/index.js'

// ─── Fixture data ─────────────────────────────────────────────────────────────

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
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
  status: 'scheduled' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

const PAST_MATCH_ROW = {
  ...FUTURE_MATCH_ROW,
  scheduledAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
}

const PREDICTION_ROW = {
  id: 'pred-uuid-001',
  userId: DB_USER_ID,
  matchId: MATCH_ID,
  homeGoals: 2,
  awayGoals: 1,
  outcomeAfterDraw: null,
  pointsGlobal: null,
  scorerPickPlayerId: null,
  scorerPlayerNameSnapshot: null,
  scorerBonusPoints: null,
  createdAt: new Date('2026-06-10T10:00:00Z'),
  updatedAt: new Date('2026-06-10T10:00:00Z'),
}

const HOME_PLAYER_ID = 'player-home-uuid'
const HOME_PLAYER_ROW = {
  id: HOME_PLAYER_ID,
  name: 'Szoboszlai Dominik',
  teamId: 'ht-uuid',
}
const AWAY_PLAYER_ID = 'player-away-uuid'
const AWAY_PLAYER_ROW = {
  id: AWAY_PLAYER_ID,
  name: 'Lionel Messi',
  teamId: 'at-uuid',
}
const FOREIGN_PLAYER_ROW = {
  id: 'player-foreign-uuid',
  name: 'Foreign Player',
  teamId: 'other-team-uuid',
}

const VALID_INPUT = { matchId: MATCH_ID, homeGoals: 2, awayGoals: 1 }

// ─── Helper: sequential select mock ──────────────────────────────────────────

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

  it('unknown supabaseId → AppError 404', async () => {
    mockLimit.mockResolvedValue([]) // user not found
    await expect(upsertPrediction(SUPABASE_ID, VALID_INPUT)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('unknown matchId → AppError 404', async () => {
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

  it('scheduledAt in the past → AppError 409', async () => {
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

  it('valid input → db.insert called, Prediction returned', async () => {
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

  it('conflict (existing prediction) → onConflictDoUpdate called', async () => {
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

  // ─── Scorer pick (SCORER-002) ─────────────────────────────────────────────

  it('scorerPickPlayerId without home/away goals → 400 scorer_requires_full_prediction', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      if (call === 2) return Promise.resolve([FUTURE_MATCH_ROW])
      return Promise.resolve([])
    })

    await expect(
      upsertPrediction(SUPABASE_ID, {
        matchId: MATCH_ID,
        homeGoals: null as unknown as number,
        awayGoals: null as unknown as number,
        scorerPickPlayerId: HOME_PLAYER_ID,
      })
    ).rejects.toMatchObject({ status: 400, message: 'scorer_requires_full_prediction' })
  })

  it('scorerPickPlayerId for player not in match → 400 scorer_player_not_in_match', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      if (call === 2) return Promise.resolve([FUTURE_MATCH_ROW])
      if (call === 3) return Promise.resolve([FOREIGN_PLAYER_ROW])
      return Promise.resolve([])
    })

    await expect(
      upsertPrediction(SUPABASE_ID, {
        ...VALID_INPUT,
        scorerPickPlayerId: 'player-foreign-uuid',
      })
    ).rejects.toMatchObject({ status: 400, message: 'scorer_player_not_in_match' })
  })

  it('scorerPickPlayerId for unknown player → 400 scorer_player_not_in_match', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      if (call === 2) return Promise.resolve([FUTURE_MATCH_ROW])
      if (call === 3) return Promise.resolve([]) // player not found
      return Promise.resolve([])
    })

    await expect(
      upsertPrediction(SUPABASE_ID, {
        ...VALID_INPUT,
        scorerPickPlayerId: 'unknown-player-uuid',
      })
    ).rejects.toMatchObject({ status: 400, message: 'scorer_player_not_in_match' })
  })

  it('valid scorer pick → snapshot filled, db.insert called with scorer fields', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      if (call === 2) return Promise.resolve([FUTURE_MATCH_ROW])
      if (call === 3) return Promise.resolve([HOME_PLAYER_ROW])
      return Promise.resolve([])
    })
    mockReturning.mockResolvedValue([{
      ...PREDICTION_ROW,
      scorerPickPlayerId: HOME_PLAYER_ID,
      scorerPlayerNameSnapshot: 'Szoboszlai Dominik',
    }])

    const result = await upsertPrediction(SUPABASE_ID, {
      ...VALID_INPUT,
      scorerPickPlayerId: HOME_PLAYER_ID,
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerPickPlayerId: HOME_PLAYER_ID,
        scorerPlayerNameSnapshot: 'Szoboszlai Dominik',
      })
    )
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          scorerPickPlayerId: HOME_PLAYER_ID,
          scorerPlayerNameSnapshot: 'Szoboszlai Dominik',
        }),
      })
    )
    expect(result.scorerPickPlayerId).toBe(HOME_PLAYER_ID)
    expect(result.scorerPlayerNameSnapshot).toBe('Szoboszlai Dominik')
  })

  it('away team player as scorer pick → accepted', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      if (call === 2) return Promise.resolve([FUTURE_MATCH_ROW])
      if (call === 3) return Promise.resolve([AWAY_PLAYER_ROW])
      return Promise.resolve([])
    })
    mockReturning.mockResolvedValue([{
      ...PREDICTION_ROW,
      scorerPickPlayerId: AWAY_PLAYER_ID,
      scorerPlayerNameSnapshot: 'Lionel Messi',
    }])

    const result = await upsertPrediction(SUPABASE_ID, {
      ...VALID_INPUT,
      scorerPickPlayerId: AWAY_PLAYER_ID,
    })

    expect(result.scorerPickPlayerId).toBe(AWAY_PLAYER_ID)
  })

  it('scorerPickPlayerId = null → snapshot also nulled (clear)', async () => {
    let call = 0
    mockLimit.mockImplementation(() => {
      call++
      if (call === 1) return Promise.resolve([DB_USER_ROW])
      if (call === 2) return Promise.resolve([FUTURE_MATCH_ROW])
      return Promise.resolve([])
    })

    await upsertPrediction(SUPABASE_ID, {
      ...VALID_INPUT,
      scorerPickPlayerId: null,
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        scorerPickPlayerId: null,
        scorerPlayerNameSnapshot: null,
      })
    )
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({
          scorerPickPlayerId: null,
          scorerPlayerNameSnapshot: null,
        }),
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

  it('unknown requestingSupabaseId → AppError 404', async () => {
    mockLimit.mockResolvedValue([]) // requesting user not found
    await expect(getPredictionsForUser('unknown-id', DB_USER_ID)).rejects.toMatchObject({
      status: 404,
    })
  })

  it('unknown targetUserId → AppError 404', async () => {
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

  it('requesting another user\'s predictions, not admin → AppError 403', async () => {
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

  it('fetching own predictions → Prediction[] returned', async () => {
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

  it('admin fetching another user\'s predictions → Prediction[] returned', async () => {
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

  it('no predictions → returns []', async () => {
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

// ─── getMatchPredictions ──────────────────────────────────────────────────────

describe('getMatchPredictions', () => {
  // The service invokes 5 separate select chains in sequence. We mock them via
  // a simple sequential thenable stack: each chain pops the next value from
  // the top of the stack when awaited (.then).
  function setupQueryStack(stack: unknown[][]): void {
    const queue = [...stack]
    const makeChain = (): {
      from: () => ReturnType<typeof makeChain>
      where: () => ReturnType<typeof makeChain>
      innerJoin: () => ReturnType<typeof makeChain>
      orderBy: () => ReturnType<typeof makeChain>
      limit: () => ReturnType<typeof makeChain>
      then: (resolve: (v: unknown[]) => unknown) => Promise<unknown>
    } => {
      const chain = {
        from: () => chain,
        where: () => chain,
        innerJoin: () => chain,
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(queue.shift() ?? []).then(resolve),
      }
      return chain
    }
    mockSelect.mockImplementation(() => makeChain())
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  const REQUESTER_ID = 'requester-uuid'
  const PEER_A_ID = 'peer-a-uuid'
  const PEER_B_ID = 'peer-b-uuid'
  const STRANGER_ID = 'stranger-uuid'
  const GROUP_1_ID = 'group-1-uuid'
  const GROUP_2_ID = 'group-2-uuid'

  function predictionRow(userId: string, displayName: string, overrides: Partial<{
    homeGoals: number
    awayGoals: number
    outcomeAfterDraw: string | null
    pointsGlobal: number | null
    scorerPickPlayerId: string | null
    scorerPlayerNameSnapshot: string | null
    scorerBonusPoints: number | null
    supporterAt: Date | null
  }> = {}): Record<string, unknown> {
    return {
      userId,
      displayName,
      supporterAt: overrides.supporterAt ?? null,
      homeGoals: overrides.homeGoals ?? 1,
      awayGoals: overrides.awayGoals ?? 0,
      outcomeAfterDraw: overrides.outcomeAfterDraw ?? null,
      pointsGlobal: overrides.pointsGlobal ?? null,
      scorerPickPlayerId: overrides.scorerPickPlayerId ?? null,
      scorerPlayerNameSnapshot: overrides.scorerPlayerNameSnapshot ?? null,
      scorerBonusPoints: overrides.scorerBonusPoints ?? null,
    }
  }

  it('match does not exist → AppError 404', async () => {
    setupQueryStack([[]])
    await expect(getMatchPredictions(MATCH_ID, REQUESTER_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('before kickoff (status=scheduled, scheduledAt in future) → AppError 403', async () => {
    setupQueryStack([[FUTURE_MATCH_ROW]])
    await expect(getMatchPredictions(MATCH_ID, REQUESTER_ID)).rejects.toMatchObject({ status: 403 })
  })

  it('after kickoff (status=scheduled, scheduledAt in past) → predictions returned with scorer fields', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      [
        predictionRow(REQUESTER_ID, 'Me', { homeGoals: 2, awayGoals: 1 }),
        predictionRow(PEER_A_ID, 'Peer A', {
          homeGoals: 0,
          awayGoals: 0,
          scorerPickPlayerId: HOME_PLAYER_ID,
          scorerPlayerNameSnapshot: 'Szoboszlai Dominik',
          scorerBonusPoints: 2,
        }),
      ],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ userId: REQUESTER_ID, scorerPlayerNameSnapshot: null })
    expect(result[1]).toMatchObject({
      userId: PEER_A_ID,
      scorerPlayerNameSnapshot: 'Szoboszlai Dominik',
      scorerBonusPoints: 2,
    })
  })

  it('status=live → predictions returned', async () => {
    const LIVE_MATCH = { ...PAST_MATCH_ROW, status: 'live' as const }
    setupQueryStack([
      [LIVE_MATCH],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      [predictionRow(PEER_A_ID, 'Peer A')],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.userId).toBe(PEER_A_ID)
  })

  it('status=finished → predictions returned', async () => {
    const FINISHED_MATCH = { ...PAST_MATCH_ROW, status: 'finished' as const }
    setupQueryStack([
      [FINISHED_MATCH],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      [predictionRow(PEER_A_ID, 'Peer A')],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result).toHaveLength(1)
  })

  it('requester is in no group, only own prediction exists → 1 prediction (own)', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [],            // requester groups: empty
      // peerRows query is skipped (the service short-circuits if no groups)
      [predictionRow(REQUESTER_ID, 'Me')],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result).toHaveLength(1)
    expect(result[0]?.userId).toBe(REQUESTER_ID)
  })

  it('stranger\'s prediction (no shared group) → filtered out, not visible', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      // The predictions select filters via the service's Set, so STRANGER
      // never ends up in the result list. Here the "DB" doesn't return any
      // stranger rows either because inArray filters — we only simulate peer rows.
      [predictionRow(REQUESTER_ID, 'Me'), predictionRow(PEER_A_ID, 'Peer A')],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result.map(r => r.userId)).not.toContain(STRANGER_ID)
    expect(result).toHaveLength(2)
  })

  it('two shared groups, peer in both → DISTINCT user, appears only once', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [{ groupId: GROUP_1_ID }, { groupId: GROUP_2_ID }],
      // peerRows: PEER_B is in both groups → appears twice in raw rows,
      // but we deduplicate with a Set
      [
        { userId: REQUESTER_ID }, { userId: PEER_A_ID }, { userId: PEER_B_ID },
        { userId: REQUESTER_ID }, { userId: PEER_B_ID },
      ],
      [
        predictionRow(REQUESTER_ID, 'Me'),
        predictionRow(PEER_A_ID, 'Peer A'),
        predictionRow(PEER_B_ID, 'Peer B'),
      ],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result).toHaveLength(3)
    const peerBOccurrences = result.filter(r => r.userId === PEER_B_ID)
    expect(peerBOccurrences).toHaveLength(1)
  })

  it('returns outcomeAfterDraw on every row (knockout prediction visibility — UX-043)', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      [
        predictionRow(REQUESTER_ID, 'Me', { outcomeAfterDraw: 'penalties_home' }),
        predictionRow(PEER_A_ID, 'Peer A', { outcomeAfterDraw: 'extra_time_away' }),
      ],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result.find(r => r.userId === REQUESTER_ID)?.outcomeAfterDraw).toBe('penalties_home')
    expect(result.find(r => r.userId === PEER_A_ID)?.outcomeAfterDraw).toBe('extra_time_away')
  })

  it('outcomeAfterDraw stays null if the user did not predict it', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      [predictionRow(PEER_A_ID, 'Peer A', { outcomeAfterDraw: null })],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID)
    expect(result[0]?.outcomeAfterDraw).toBeNull()
  })

  it('groupId provided → isPaid flag enriched from the membership query', async () => {
    setupQueryStack([
      [PAST_MATCH_ROW],
      [{ groupId: GROUP_1_ID }],
      [{ userId: REQUESTER_ID }, { userId: PEER_A_ID }],
      [predictionRow(REQUESTER_ID, 'Me'), predictionRow(PEER_A_ID, 'Peer A')],
      // groupId-specific membership query
      [{ userId: REQUESTER_ID, paidAt: new Date() }, { userId: PEER_A_ID, paidAt: null }],
    ])
    const result = await getMatchPredictions(MATCH_ID, REQUESTER_ID, GROUP_1_ID)
    expect(result.find(r => r.userId === REQUESTER_ID)?.isPaid).toBe(true)
    expect(result.find(r => r.userId === PEER_A_ID)?.isPaid).toBe(false)
  })
})
