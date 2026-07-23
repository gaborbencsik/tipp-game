import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB + scoring mock ──────────────────────────────────────────────────────

const { mockSelect, mockInsert, mockDelete, mockCalculateAndSaveGroupPoints, mockGetMatches } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockDelete: vi.fn(),
  mockCalculateAndSaveGroupPoints: vi.fn(),
  mockGetMatches: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert, delete: mockDelete },
}))

vi.mock('../src/services/scoring.service.js', () => ({
  calculateAndSaveGroupPoints: mockCalculateAndSaveGroupPoints,
}))

vi.mock('../src/services/matches.service.js', () => ({
  getMatches: mockGetMatches,
}))

import { addGroupMatch, removeGroupMatch, getGroupEffectiveMatchIds, getGroupEffectiveMatches } from '../src/services/group-matches.service.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-01-01T00:00:00.000Z')
const GROUP_ID = 'group-uuid-1'
const MATCH_ID = 'match-uuid-1'
const ACTOR_ID = 'user-uuid-1'

const GROUP_ROW = { id: GROUP_ID, deletedAt: null }
const ADMIN_MEMBER = { id: 'member-1', groupId: GROUP_ID, userId: ACTOR_ID, isAdmin: true }
const NON_ADMIN_MEMBER = { id: 'member-2', groupId: GROUP_ID, userId: ACTOR_ID, isAdmin: false }

// ─── Chain helpers ──────────────────────────────────────────────────────────

function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(result)
  chain['then'] = terminal.then.bind(terminal)
  chain['catch'] = terminal.catch.bind(terminal)
  chain['finally'] = terminal.finally.bind(terminal)
  chain['from'] = vi.fn().mockReturnValue(chain)
  chain['innerJoin'] = vi.fn().mockReturnValue(chain)
  chain['where'] = vi.fn().mockReturnValue(chain)
  chain['orderBy'] = vi.fn().mockReturnValue(terminal)
  chain['limit'] = vi.fn().mockReturnValue(terminal)
  return chain
}

function makeInsertChain() {
  const valuesFn = vi.fn().mockResolvedValue(undefined)
  return { insertFn: vi.fn().mockReturnValue({ values: valuesFn }), valuesFn }
}

function makeDeleteChain() {
  const chain: Record<string, unknown> = {}
  const terminal = Promise.resolve(undefined)
  chain['then'] = terminal.then.bind(terminal)
  chain['catch'] = terminal.catch.bind(terminal)
  chain['finally'] = terminal.finally.bind(terminal)
  chain['where'] = vi.fn().mockReturnValue(terminal)
  return chain
}

beforeEach(() => {
  mockSelect.mockReset()
  mockInsert.mockReset()
  mockDelete.mockReset()
  mockCalculateAndSaveGroupPoints.mockReset().mockResolvedValue(undefined)
  mockGetMatches.mockReset().mockResolvedValue([])
})

// ─── getGroupEffectiveMatchIds ────────────────────────────────────────────────

describe('getGroupEffectiveMatches', () => {
  it('orders hand-picked matches most-recently-added first (addedAt DESC)', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))  // group leagues (none)
      .mockReturnValueOnce(makeSelectChain([
        { matchId: 'm-old', addedAt: new Date('2026-01-01T00:00:00.000Z') },
        { matchId: 'm-new', addedAt: new Date('2026-02-01T00:00:00.000Z') },
      ]))
    mockGetMatches.mockResolvedValueOnce([
      { id: 'm-old', scheduledAt: '2026-06-10T18:00:00.000Z' },
      { id: 'm-new', scheduledAt: '2026-06-20T18:00:00.000Z' },
    ])

    const result = await getGroupEffectiveMatches(GROUP_ID)

    expect(result.map((m) => m.id)).toEqual(['m-new', 'm-old'])
    expect(result.every((m) => m.handPicked)).toBe(true)
  })
})

describe('getGroupEffectiveMatchIds', () => {
  it('returns union of league-based and hand-picked match ids without duplicates', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([{ leagueId: 'l-1' }]))           // group leagues
      .mockReturnValueOnce(makeSelectChain([{ matchId: 'm-2' }, { matchId: 'm-3' }])) // hand-picked
      .mockReturnValueOnce(makeSelectChain([{ id: 'm-1' }, { id: 'm-2' }]))  // league matches (m-2 overlaps)

    const ids = await getGroupEffectiveMatchIds(GROUP_ID)

    expect([...ids].sort()).toEqual(['m-1', 'm-2', 'm-3'])
  })

  it('returns only hand-picked ids when group has no leagues', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([]))                    // no group leagues
      .mockReturnValueOnce(makeSelectChain([{ matchId: 'm-9' }]))  // hand-picked

    const ids = await getGroupEffectiveMatchIds(GROUP_ID)

    expect(ids).toEqual(['m-9'])
  })
})

// ─── addGroupMatch ─────────────────────────────────────────────────────────

describe('addGroupMatch', () => {
  it('inserts a group_matches row and writes an audit log (non-finished match)', async () => {
    const insertChain = makeInsertChain()
    mockInsert.mockReturnValue({ values: insertChain.valuesFn })
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))          // assertGroupAdmin: group
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))       // assertGroupAdmin: member
      .mockReturnValueOnce(makeSelectChain([{ id: MATCH_ID, status: 'scheduled' }])) // match exists
      .mockReturnValueOnce(makeSelectChain([]))                   // no existing group_matches

    await addGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)

    expect(insertChain.valuesFn).toHaveBeenCalledTimes(2) // group_matches + audit
    expect(insertChain.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ groupId: GROUP_ID, matchId: MATCH_ID, addedBy: ACTOR_ID }))
    expect(insertChain.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ action: 'group_match_add', entityType: 'group_match', entityId: MATCH_ID }))
    expect(mockCalculateAndSaveGroupPoints).not.toHaveBeenCalled()
  })

  it('is idempotent — a second call with an existing row inserts nothing', async () => {
    const insertChain = makeInsertChain()
    mockInsert.mockReturnValue({ values: insertChain.valuesFn })
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))
      .mockReturnValueOnce(makeSelectChain([{ id: MATCH_ID, status: 'scheduled' }]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'gm-1' }])) // existing row

    await addGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)

    expect(insertChain.valuesFn).not.toHaveBeenCalled()
  })

  it('triggers a group-points recalc when the match is finished and has a result', async () => {
    const insertChain = makeInsertChain()
    mockInsert.mockReturnValue({ values: insertChain.valuesFn })
    const RESULT = { homeGoals: 2, awayGoals: 1, extraTimeHomeGoals: null, extraTimeAwayGoals: null }
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))
      .mockReturnValueOnce(makeSelectChain([{ id: MATCH_ID, status: 'finished' }]))
      .mockReturnValueOnce(makeSelectChain([]))                  // no existing group_matches
      .mockReturnValueOnce(makeSelectChain([RESULT]))            // match result exists

    await addGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)

    expect(mockCalculateAndSaveGroupPoints).toHaveBeenCalledWith(MATCH_ID, expect.objectContaining({ homeGoals: 2, awayGoals: 1 }))
  })

  it('throws 404 when the match does not exist', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))
      .mockReturnValueOnce(makeSelectChain([]))                  // match not found

    await expect(addGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)).rejects.toMatchObject({ status: 404 })
  })

  it('throws 403 when the actor is not a group admin', async () => {
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([NON_ADMIN_MEMBER]))

    await expect(addGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)).rejects.toMatchObject({ status: 403 })
  })

  it('throws 404 when the group does not exist', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))          // no group

    await expect(addGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ─── removeGroupMatch ─────────────────────────────────────────────────────────

describe('removeGroupMatch', () => {
  it('deletes the group_matches row and, when the match is outside the group leagues, removes its group points', async () => {
    const insertChain = makeInsertChain()
    mockInsert.mockReturnValue({ values: insertChain.valuesFn })
    const deleteChain1 = makeDeleteChain()
    const deleteChain2 = makeDeleteChain()
    mockDelete.mockReturnValueOnce(deleteChain1).mockReturnValueOnce(deleteChain2)
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))                       // assertGroupAdmin: group
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))                    // assertGroupAdmin: member
      .mockReturnValueOnce(makeSelectChain([{ id: 'gm-1' }]))                  // existing group_matches row
      .mockReturnValueOnce(makeSelectChain([{ leagueId: 'l-other' }]))         // match leagueId
      .mockReturnValueOnce(makeSelectChain([{ leagueId: 'l-1' }]))             // group leagues (match not covered)
      .mockReturnValueOnce(makeSelectChain([{ id: 'pred-1' }]))               // predictions for match

    await removeGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)

    expect(mockDelete).toHaveBeenCalledTimes(2) // group_matches + group_prediction_points
    expect(insertChain.valuesFn).toHaveBeenCalledWith(expect.objectContaining({ action: 'group_match_remove', entityType: 'group_match', entityId: MATCH_ID }))
  })

  it('keeps group points when the match is still covered by a group league', async () => {
    const insertChain = makeInsertChain()
    mockInsert.mockReturnValue({ values: insertChain.valuesFn })
    const deleteChain1 = makeDeleteChain()
    mockDelete.mockReturnValueOnce(deleteChain1)
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))
      .mockReturnValueOnce(makeSelectChain([{ id: 'gm-1' }]))
      .mockReturnValueOnce(makeSelectChain([{ leagueId: 'l-1' }]))   // match leagueId
      .mockReturnValueOnce(makeSelectChain([{ leagueId: 'l-1' }]))   // group leagues (match IS covered)

    await removeGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)

    expect(mockDelete).toHaveBeenCalledTimes(1) // only group_matches, points preserved
  })

  it('is idempotent — no existing row means no delete and no audit', async () => {
    const insertChain = makeInsertChain()
    mockInsert.mockReturnValue({ values: insertChain.valuesFn })
    mockSelect
      .mockReturnValueOnce(makeSelectChain([GROUP_ROW]))
      .mockReturnValueOnce(makeSelectChain([ADMIN_MEMBER]))
      .mockReturnValueOnce(makeSelectChain([]))  // no existing group_matches row

    await removeGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)

    expect(mockDelete).not.toHaveBeenCalled()
    expect(insertChain.valuesFn).not.toHaveBeenCalled()
  })

  it('throws 404 when the group does not exist', async () => {
    mockSelect.mockReturnValueOnce(makeSelectChain([]))

    await expect(removeGroupMatch(GROUP_ID, MATCH_ID, ACTOR_ID)).rejects.toMatchObject({ status: 404 })
  })
})
