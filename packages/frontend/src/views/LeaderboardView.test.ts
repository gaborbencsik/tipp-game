/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const { mockLeaderboardList, mockGroupLeaderboard, mockGroupsList, mockGroupsState } = vi.hoisted(() => ({
  mockLeaderboardList: vi.fn().mockResolvedValue([]),
  mockGroupLeaderboard: vi.fn().mockResolvedValue([]),
  mockGroupsList: vi.fn().mockResolvedValue([]),
  mockGroupsState: { groups: [] as import('@/types/index').Group[] },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    leaderboard: { get: mockLeaderboardList, list: mockLeaderboardList },
    groups: { mine: mockGroupsList, leaderboard: mockGroupLeaderboard },
  },
}))

vi.mock('@/stores/groups.store', () => ({
  useGroupsStore: () => ({
    get groups() { return mockGroupsState.groups },
    fetchMyGroups: vi.fn(async () => {
      mockGroupsState.groups = await mockGroupsList()
    }),
  }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'u1' } }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

vi.mock('@/components/AppLayout.vue', () => ({
  default: { template: '<div><slot /></div>' },
}))

import LeaderboardView from './LeaderboardView.vue'

const SCOPE_KEY = 'leaderboard_scope'

const G1 = { id: 'g1', name: 'Group One' } as unknown as import('@/types/index').Group
const G2 = { id: 'g2', name: 'Group Two' } as unknown as import('@/types/index').Group

describe('LeaderboardView LS scope persistence', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mockGroupsState.groups = []
    mockGroupsList.mockResolvedValue([G1, G2])
    mockLeaderboardList.mockResolvedValue([])
    mockGroupLeaderboard.mockResolvedValue([])
  })

  it('restores selectedScope from LS when stored value matches a known group', async () => {
    localStorage.setItem(SCOPE_KEY, 'g2')
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    expect((select.element as HTMLSelectElement).value).toBe('g2')
    expect(mockGroupLeaderboard).toHaveBeenCalledWith('t', 'g2')
  })

  it('keeps global when LS has "global"', async () => {
    localStorage.setItem(SCOPE_KEY, 'global')
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const select = wrapper.find('select')
    expect((select.element as HTMLSelectElement).value).toBe('global')
  })

  it('clears LS and stays global when stored group no longer exists', async () => {
    localStorage.setItem(SCOPE_KEY, 'gone')
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    expect(localStorage.getItem(SCOPE_KEY)).toBeNull()
    const select = wrapper.find('select')
    expect((select.element as HTMLSelectElement).value).toBe('global')
  })

  it('writes LS when user changes scope', async () => {
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const select = wrapper.find('select')
    await select.setValue('g1')
    await flushPromises()

    expect(localStorage.getItem(SCOPE_KEY)).toBe('g1')
  })

  it('table thead visible on mobile, all data columns visible (UX-025)', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 4, correctCount: 1, totalPoints: 1, matchPoints: 1, scorerBonusPoints: 0, successRate: 25, matchSuccessRate: 25, scorerSuccessRate: 0, specialPredictionPoints: 0 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const thead = wrapper.find('table thead')
    expect(thead.exists()).toBe(true)
    expect(thead.classes()).not.toContain('hidden')

    // UX-034: 8 columns on desktop when no tournament points
    // (rank, player, P/M, %, match, match%, scorer, scorer%, points = 9 actually).
    const headerCells = wrapper.findAll('table thead th')
    expect(headerCells.length).toBe(9)

    const dataCells = wrapper.findAll('table tbody tr:first-child td')
    expect(dataCells.length).toBe(9)
  })

  // ─── UX-034: new column structure ──────────────────────────────────────────

  it('renders successRate / matchPoints / scorerBonusPoints columns; no tips/correct', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 9, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 0 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const headerText = wrapper.findAll('table thead th').map(th => th.text())
    expect(headerText).toContain('Sikeres tippek')
    expect(headerText).toContain('%')
    expect(headerText.some(t => t.includes('Meccs pont'))).toBe(true)
    expect(headerText.some(t => t.includes('Gólszerző pont'))).toBe(true)
    expect(headerText).not.toContain('Tipp')
    expect(headerText).not.toContain('Pontot ért')

    const rowText = wrapper.find('table tbody tr:first-child').text()
    expect(rowText).toContain('2/3')
    expect(rowText).toContain('67%')
  })

  it('renders em-dash when predictionCount is 0', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 0, correctCount: 0, totalPoints: 0, matchPoints: 0, scorerBonusPoints: 0, successRate: null, matchSuccessRate: null, scorerSuccessRate: null, specialPredictionPoints: 0 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    expect(wrapper.find('table tbody tr:first-child').text()).toContain('—')
  })

  it('hides tournament column when all entries have specialPredictionPoints = 0', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 9, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 0 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const headerText = wrapper.findAll('table thead th').map(th => th.text())
    expect(headerText.some(t => t.includes('Torna'))).toBe(false)
  })

  it('shows tournament column when any entry has specialPredictionPoints > 0', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 14, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 5 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const headerText = wrapper.findAll('table thead th').map(th => th.text())
    expect(headerText.some(t => t.includes('Torna'))).toBe(true)
  })

  // ─── UX-046: tournament success rate percentage ───────────────────────────

  it('renders the tournament % in its own column when tournamentSuccessRate is set', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 14, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 3, tournamentMaxPoints: 5, tournamentSuccessRate: 60 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const cells = wrapper.findAll('table tbody tr:first-child td').map(td => td.text())
    expect(cells).toContain('3')
    expect(cells).toContain('60%')
    // Percentage is no longer wrapped in parentheses.
    expect(wrapper.find('table tbody tr:first-child').text()).not.toContain('(60%)')
  })

  it('renders "—" in the tournament % column when tournamentSuccessRate is null (nothing resolved yet)', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 12, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 3, tournamentMaxPoints: 0, tournamentSuccessRate: null },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const cells = wrapper.findAll('table tbody tr:first-child td').map(td => td.text())
    // Tournament % column (last-before-total) shows the em-dash placeholder, and no percentage was rendered there.
    expect(cells.at(-2)).toBe('—')
  })

  it('renders "—" in the tournament % column when tournamentSuccessRate is 0', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 9, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 0, tournamentMaxPoints: 100, tournamentSuccessRate: 0 },
      // Second entry keeps the column visible (showTournamentColumn is based on entries having specialPredictionPoints > 0).
      { userId: 'u2', displayName: 'Peer', avatarUrl: null, rank: 2, predictionCount: 3, correctCount: 2, totalPoints: 12, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 3, tournamentMaxPoints: 100, tournamentSuccessRate: 3 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const cells = wrapper.findAll('table tbody tr:first-child td').map(td => td.text())
    expect(cells.at(-2)).toBe('—')
  })

  it('tournament percentage carries a tooltip via title attribute', async () => {
    mockLeaderboardList.mockResolvedValue([
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 3, correctCount: 2, totalPoints: 14, matchPoints: 7, scorerBonusPoints: 2, successRate: 67, matchSuccessRate: 33, scorerSuccessRate: 67, specialPredictionPoints: 3, tournamentMaxPoints: 5, tournamentSuccessRate: 60 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const pctSpan = wrapper.find('table tbody tr:first-child span[title]')
    expect(pctSpan.exists()).toBe(true)
    expect(pctSpan.attributes('title')).toContain('kiértékelt')
  })
})
