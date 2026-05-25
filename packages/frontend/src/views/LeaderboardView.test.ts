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
      { userId: 'u1', displayName: 'Me', avatarUrl: null, rank: 1, predictionCount: 4, correctCount: 1, totalPoints: 1 },
    ])
    const wrapper = mount(LeaderboardView)
    await flushPromises()

    const thead = wrapper.find('table thead')
    expect(thead.exists()).toBe(true)
    expect(thead.classes()).not.toContain('hidden')

    const headerCells = wrapper.findAll('table thead th')
    expect(headerCells.length).toBe(5)

    const dataCells = wrapper.findAll('table tbody tr:first-child td')
    expect(dataCells.length).toBe(5)
    for (const td of dataCells) {
      expect(td.classes()).not.toContain('hidden')
    }
  })
})
