import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getScoringExplainer } from '../src/services/scoring-explainer.service.js'

describe('scoring-explainer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1-csoport user → 1 elemű groups, helyes config + frozenAt + favoriteTeamDoublePoints', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    const groupRow = { id: 'g1', name: 'Pulykák', scoringConfigId: 'cfg-g1', favoriteTeamDoublePoints: true }
    const groupConfig = { ...defaultConfig, id: 'cfg-g1', isGlobalDefault: false, exactScore: 4 }

    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([groupConfig]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.default.exactScore).toBe(3)
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]).toMatchObject({
      id: 'g1', name: 'Pulykák', favoriteTeamDoublePoints: true,
    })
    expect(result.groups[0]?.config.exactScore).toBe(4)
    expect(result.groups[0]?.specialTypes).toEqual([])
  })

  it('csoport without scoringConfigId → öröklődő default config', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    const groupRow = { id: 'g1', name: 'Default-örökös', scoringConfigId: null, favoriteTeamDoublePoints: false }

    // Call order: loadDefaultConfig, loadUserGroups, loadGroupOwnedSpecialTypes, loadSubscribedGlobalSpecialTypes
    // loadConfigsByIds is skipped because configIdsToLoad is empty
    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.groups[0]?.config.exactScore).toBe(3)
  })

  it('special tippek: csoport-saját + feliratkozott globális, helyes source címkével', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    const groupRow = { id: 'g1', name: 'Pulykák', scoringConfigId: null, favoriteTeamDoublePoints: false }
    const owned = { id: 'sp-owned', name: 'Csoport saját', description: 'd1', points: 5, groupId: 'g1' }
    const subscribed = { id: 'sp-global', name: 'Globális', description: 'd2', points: 7, groupId: null }

    // Call order: loadDefaultConfig, loadUserGroups, loadGroupOwnedSpecialTypes, loadSubscribedGlobalSpecialTypes
    // loadConfigsByIds is skipped because scoringConfigId is null
    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([owned]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([{ groupId: 'g1', type: subscribed }]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.groups[0]?.specialTypes).toEqual([
      { id: 'sp-owned', name: 'Csoport saját', description: 'd1', points: 5, source: 'group-owned' },
      { id: 'sp-global', name: 'Globális', description: 'd2', points: 7, source: 'subscribed-global' },
    ])
  })

  it('frozenAt érték helyesen propagálódik (default + group szinten)', async () => {
    const frozen = new Date('2026-06-01T00:00:00Z')
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: frozen,
    }
    const groupRow = { id: 'g1', name: 'X', scoringConfigId: 'cfg-g1', favoriteTeamDoublePoints: false }
    const groupConfig = { ...defaultConfig, id: 'cfg-g1', isGlobalDefault: false, frozenAt: frozen }

    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([groupRow]) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([groupConfig]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')

    expect(result.defaultFrozenAt).toBe(frozen.toISOString())
    expect(result.groups[0]?.configFrozenAt).toBe(frozen.toISOString())
  })

  it('0-csoport user → üres groups array', async () => {
    const defaultConfig = {
      id: 'cfg-default', name: 'Default', isGlobalDefault: true,
      exactScore: 3, correctWinnerAndDiff: 2, correctWinner: 1, correctDraw: 2,
      correctOutcome: 1, incorrect: 0, frozenAt: null,
    }
    mockSelect
      .mockReturnValueOnce({ from: () => ({ where: () => ({ limit: () => Promise.resolve([defaultConfig]) }) }) })
      .mockReturnValueOnce({ from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }) })

    const result = await getScoringExplainer('user-1')
    expect(result.groups).toEqual([])
  })
})
