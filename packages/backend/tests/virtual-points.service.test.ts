import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))

const scoringConfigMocks = vi.hoisted(() => ({
  getGroupConfig: vi.fn(),
  getGlobalConfig: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))
vi.mock('../src/services/scoring-config.service.js', () => scoringConfigMocks)

import { getVirtualPointsForUserInGroup } from '../src/services/virtual-points.service.js'

const GLOBAL_CFG = {
  id: 'g',
  name: 'global',
  correctOutcomePoints: 1,
  exactBonusPoints: 1,
  extraTimeBonusPoints: 1,
}

function chain(result: unknown) {
  const c: Record<string, unknown> = {}
  const t = Promise.resolve(result)
  c['then'] = t.then.bind(t)
  c['catch'] = t.catch.bind(t)
  c['finally'] = t.finally.bind(t)
  c['from'] = vi.fn().mockReturnValue(c)
  c['where'] = vi.fn().mockReturnValue(c)
  c['innerJoin'] = vi.fn().mockReturnValue(c)
  c['leftJoin'] = vi.fn().mockReturnValue(c)
  c['limit'] = vi.fn().mockReturnValue(t)
  return c
}

function setupSelectSequence(results: unknown[]): void {
  let i = 0
  mockDb.select.mockImplementation(() => {
    const r = results[i] ?? []
    i++
    return chain(r)
  })
}

const NOW = new Date('2026-06-15T18:00:00Z')

function liveRow(matchId: string, home: number, away: number, minute: number) {
  return {
    matchId, homeScore: home, awayScore: away, minute,
    scheduledAt: NOW,
    homeTeamShortCode: 'ARG', homeTeamName: 'Argentina', homeTeamFlagUrl: null,
    awayTeamShortCode: 'BRA', awayTeamName: 'Brazil', awayTeamFlagUrl: null,
  }
}

describe('getVirtualPointsForUserInGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scoringConfigMocks.getGroupConfig.mockResolvedValue(null)
    scoringConfigMocks.getGlobalConfig.mockResolvedValue(GLOBAL_CFG)
  })

  it('throws 404 when group not found', async () => {
    setupSelectSequence([[]])
    await expect(getVirtualPointsForUserInGroup('g1', 'u1')).rejects.toMatchObject({ status: 404 })
  })

  it('throws 403 when user not member of group', async () => {
    setupSelectSequence([
      [{ id: 'g1' }],
      [],
    ])
    await expect(getVirtualPointsForUserInGroup('g1', 'u1')).rejects.toMatchObject({ status: 403 })
  })

  it('returns empty array when user has no predictions', async () => {
    setupSelectSequence([
      [{ id: 'g1' }],
      [{ id: 'gm1' }],
      [],
    ])
    const result = await getVirtualPointsForUserInGroup('g1', 'u1')
    expect(result).toEqual([])
  })

  it('returns empty array when no live matches match predictions', async () => {
    setupSelectSequence([
      [{ id: 'g1' }],
      [{ id: 'gm1' }],
      [{ matchId: 'm1', homeGoals: 1, awayGoals: 0, outcomeAfterDraw: null }],
      [],
    ])
    const result = await getVirtualPointsForUserInGroup('g1', 'u1')
    expect(result).toEqual([])
  })

  it('computes virtual points for live predictions (exact score)', async () => {
    setupSelectSequence([
      [{ id: 'g1' }],
      [{ id: 'gm1' }],
      [{ matchId: 'm1', homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null }],
      [liveRow('m1', 2, 1, 67)],
    ])
    const result = await getVirtualPointsForUserInGroup('g1', 'u1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      matchId: 'm1',
      liveHomeScore: 2,
      liveAwayScore: 1,
      minute: 67,
      predHomeGoals: 2,
      predAwayGoals: 1,
      virtualPoints: 2,
    })
    expect(result[0]?.homeTeam.shortCode).toBe('ARG')
  })

  it('uses group config when available', async () => {
    scoringConfigMocks.getGroupConfig.mockResolvedValue({
      ...GLOBAL_CFG, exactBonusPoints: 9,
    })
    setupSelectSequence([
      [{ id: 'g1' }],
      [{ id: 'gm1' }],
      [{ matchId: 'm1', homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null }],
      [liveRow('m1', 2, 1, 67)],
    ])
    const result = await getVirtualPointsForUserInGroup('g1', 'u1')
    expect(result[0]?.virtualPoints).toBe(10)
  })

  it('skips matches without a matching prediction', async () => {
    setupSelectSequence([
      [{ id: 'g1' }],
      [{ id: 'gm1' }],
      [{ matchId: 'm1', homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null }],
      [
        liveRow('m1', 2, 1, 67),
        liveRow('m-other', 0, 0, 12),
      ],
    ])
    const result = await getVirtualPointsForUserInGroup('g1', 'u1')
    expect(result).toHaveLength(1)
    expect(result[0]?.matchId).toBe('m1')
  })
})
