import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getScoringExplainer, isConfigEffectivelyFrozen } from '../src/services/scoring-explainer.service.js'

const PAST = new Date('2026-06-01T00:00:00Z')
const FUTURE = new Date('2027-01-01T00:00:00Z')

const DEFAULT_CFG = {
  id: 'cfg-default', name: 'Default', isGlobalDefault: true,
  correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
}

function configResp(rows: unknown[]) {
  return { from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) }
}
function userGroupsResp(rows: unknown[]) {
  return { from: () => ({ innerJoin: () => ({ where: () => Promise.resolve(rows) }) }) }
}
function configsByIdsResp(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) }
}
function ownedResp(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) }
}
function subscribedResp(rows: unknown[]) {
  return { from: () => ({ innerJoin: () => ({ where: () => Promise.resolve(rows) }) }) }
}
function allLeaguesResp(rows: unknown[]) {
  return { from: () => Promise.resolve(rows) }
}
function groupLeaguesResp(rows: unknown[]) {
  return { from: () => ({ where: () => Promise.resolve(rows) }) }
}

describe('isConfigEffectivelyFrozen', () => {
  it('returns true when at least one league has started', () => {
    expect(isConfigEffectivelyFrozen([{ startsAt: PAST }, { startsAt: FUTURE }], new Date('2026-06-15T00:00:00Z'))).toBe(true)
  })
  it('returns false when all leagues are future or null', () => {
    expect(isConfigEffectivelyFrozen([{ startsAt: FUTURE }, { startsAt: null }], new Date('2026-06-15T00:00:00Z'))).toBe(false)
  })
  it('returns false on empty input', () => {
    expect(isConfigEffectivelyFrozen([], new Date('2026-06-15T00:00:00Z'))).toBe(false)
  })
})

describe('scoring-explainer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('single-group user → groups with 1 element, correct config + favoriteTeamDoublePoints', async () => {
    const groupRow = { id: 'g1', name: 'Pulykák', scoringConfigId: 'cfg-g1', favoriteTeamDoublePoints: true }
    const groupCfg = { ...DEFAULT_CFG, id: 'cfg-g1', isGlobalDefault: false, exactBonusPoints: 4 }

    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([groupRow]))
      .mockReturnValueOnce(configsByIdsResp([groupCfg]))
      .mockReturnValueOnce(ownedResp([]))
      .mockReturnValueOnce(subscribedResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: FUTURE }]))
      .mockReturnValueOnce(groupLeaguesResp([]))

    const result = await getScoringExplainer('user-1')

    expect(result.default.correctOutcomePoints).toBe(1)
    expect(result.default.exactBonusPoints).toBe(1)
    expect(result.default.extraTimeBonusPoints).toBe(1)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]).toMatchObject({ id: 'g1', name: 'Pulykák', favoriteTeamDoublePoints: true })
    expect(result.groups[0]?.config.exactBonusPoints).toBe(4)
    expect(result.groups[0]?.specialTypes).toEqual([])
  })

  it('group without scoringConfigId → inherited default config', async () => {
    const groupRow = { id: 'g1', name: 'Default-örökös', scoringConfigId: null, favoriteTeamDoublePoints: false }

    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([groupRow]))
      .mockReturnValueOnce(ownedResp([]))
      .mockReturnValueOnce(subscribedResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: FUTURE }]))
      .mockReturnValueOnce(groupLeaguesResp([]))

    const result = await getScoringExplainer('user-1')
    expect(result.groups[0]?.config.correctOutcomePoints).toBe(1)
  })

  it('special predictions: group-owned + subscribed global, with correct source label', async () => {
    const groupRow = { id: 'g1', name: 'Pulykák', scoringConfigId: null, favoriteTeamDoublePoints: false }
    const owned = { id: 'sp-owned', name: 'Csoport saját', description: 'd1', points: 5, groupId: 'g1' }
    const subscribed = { id: 'sp-global', name: 'Globális', description: 'd2', points: 7, groupId: null }

    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([groupRow]))
      .mockReturnValueOnce(ownedResp([owned]))
      .mockReturnValueOnce(subscribedResp([{ groupId: 'g1', type: subscribed }]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: FUTURE }]))
      .mockReturnValueOnce(groupLeaguesResp([]))

    const result = await getScoringExplainer('user-1')

    expect(result.groups[0]?.specialTypes).toEqual([
      { id: 'sp-owned', name: 'Csoport saját', description: 'd1', points: 5, source: 'group-owned' },
      { id: 'sp-global', name: 'Globális', description: 'd2', points: 7, source: 'subscribed-global' },
    ])
  })

  it('zero-group user → empty groups array', async () => {
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: FUTURE }]))

    const result = await getScoringExplainer('user-1')
    expect(result.groups).toEqual([])
  })
})

describe('isConfigEffectivelyFrozen integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('global default is frozen if ANY league starts_at <= now', async () => {
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: PAST }, { id: 'l2', startsAt: FUTURE }]))

    const result = await getScoringExplainer('user-1')
    expect(result.defaultFrozenAt).toBe(PAST.toISOString())
    expect(result.default.frozenAt).toBe(PAST.toISOString())
  })

  it('global default is NOT frozen if every league starts_at > now or null', async () => {
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: FUTURE }, { id: 'l2', startsAt: null }]))

    const result = await getScoringExplainer('user-1')
    expect(result.defaultFrozenAt).toBeNull()
    expect(result.default.frozenAt).toBeNull()
  })

  it('per-group config is frozen based only on that group\'s leagues', async () => {
    const groupRow = { id: 'g1', name: 'Csoport', scoringConfigId: null, favoriteTeamDoublePoints: false }
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([groupRow]))
      .mockReturnValueOnce(ownedResp([]))
      .mockReturnValueOnce(subscribedResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: PAST }, { id: 'l2', startsAt: FUTURE }]))
      .mockReturnValueOnce(groupLeaguesResp([{ groupId: 'g1', leagueId: 'l1' }]))

    const result = await getScoringExplainer('user-1')
    expect(result.groups[0]?.configFrozenAt).toBe(PAST.toISOString())
    expect(result.groups[0]?.config.frozenAt).toBe(PAST.toISOString())
  })

  it('group is NOT frozen if it only has future leagues', async () => {
    const groupRow = { id: 'g1', name: 'Csoport', scoringConfigId: null, favoriteTeamDoublePoints: false }
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([groupRow]))
      .mockReturnValueOnce(ownedResp([]))
      .mockReturnValueOnce(subscribedResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: PAST }, { id: 'l2', startsAt: FUTURE }]))
      .mockReturnValueOnce(groupLeaguesResp([{ groupId: 'g1', leagueId: 'l2' }]))

    const result = await getScoringExplainer('user-1')
    expect(result.groups[0]?.configFrozenAt).toBeNull()
  })

  it('empty group_leagues → fallback to all leagues', async () => {
    const groupRow = { id: 'g1', name: 'Csoport', scoringConfigId: null, favoriteTeamDoublePoints: false }
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([groupRow]))
      .mockReturnValueOnce(ownedResp([]))
      .mockReturnValueOnce(subscribedResp([]))
      .mockReturnValueOnce(allLeaguesResp([{ id: 'l1', startsAt: PAST }]))
      .mockReturnValueOnce(groupLeaguesResp([]))

    const result = await getScoringExplainer('user-1')
    expect(result.groups[0]?.configFrozenAt).toBe(PAST.toISOString())
  })

  it('API response returns a 3-field config, old fields are not present', async () => {
    mockSelect
      .mockReturnValueOnce(configResp([DEFAULT_CFG]))
      .mockReturnValueOnce(userGroupsResp([]))
      .mockReturnValueOnce(allLeaguesResp([]))

    const result = await getScoringExplainer('user-1')
    expect(result.default).toEqual(expect.objectContaining({
      correctOutcomePoints: expect.any(Number),
      exactBonusPoints: expect.any(Number),
      extraTimeBonusPoints: expect.any(Number),
    }))
    expect(result.default).not.toHaveProperty('exactScore')
    expect(result.default).not.toHaveProperty('correctWinner')
  })
})
