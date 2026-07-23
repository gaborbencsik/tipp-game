import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Group } from '@/types/index'
import GroupsView from '@/views/GroupsView.vue'
import { buildTestRouter } from '@/test-utils/router'

const mockReplace = vi.fn().mockResolvedValue(undefined)
const mockRouteQuery: { value: Record<string, unknown> } = { value: {} }
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
    useRoute: () => ({ get query() { return mockRouteQuery.value } }),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: { health: vi.fn(), auth: { me: vi.fn() } },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: 'u1', role: 'user', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: () => true,
      isAdmin: () => false,
      ready: true,
      restoreSession: vi.fn().mockResolvedValue(undefined),
    }),
  }
})

const { mockFetchMyGroups, mockCreateGroup, mockJoinGroup, mockStoreState, mockLeaguesState } = vi.hoisted(() => ({
  mockFetchMyGroups: vi.fn().mockResolvedValue(undefined),
  mockCreateGroup: vi.fn(),
  mockJoinGroup: vi.fn(),
  mockStoreState: { groups: [] as import('@/types/index').Group[], isLoading: false, error: null as string | null },
  mockLeaguesState: { leagues: [{ id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active' }] as Array<{ id: string; name: string; shortName: string; status: string }> },
}))

vi.mock('@/stores/groups.store', () => ({
  useGroupsStore: () => ({
    get groups() { return mockStoreState.groups },
    get isLoading() { return mockStoreState.isLoading },
    get error() { return mockStoreState.error },
    fetchMyGroups: mockFetchMyGroups,
    createGroup: mockCreateGroup,
    joinGroup: mockJoinGroup,
  }),
}))

vi.mock('@/stores/league-favorites.store', () => ({
  useLeagueFavoritesStore: () => ({
    get leagues() { return mockLeaguesState.leagues },
    fetchLeagues: vi.fn().mockResolvedValue(undefined),
  }),
}))

function buildRouter() {
  return buildTestRouter({ '/app/groups': GroupsView })
}

function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(GroupsView, { global: { plugins: [pinia, buildRouter()] } })
}

const SAMPLE_GROUP: Group = {
  id: 'group-uuid-1',
  name: 'Barátok',
  description: 'Barátok csoportja',
  inviteCode: 'ABCD1234',
  inviteActive: true,
  createdBy: 'user-uuid-1',
  memberCount: 3,
  isAdmin: true,
  userRank: null,
  favoriteTeamDoublePoints: false,
  leagues: [{ id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active', type: 'league' }],
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('GroupsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockStoreState.groups = []
    mockStoreState.isLoading = false
    mockStoreState.error = null
    mockFetchMyGroups.mockReset()
    mockFetchMyGroups.mockResolvedValue(undefined)
    mockCreateGroup.mockReset()
    mockJoinGroup.mockReset()
    mockReplace.mockClear()
    mockRouteQuery.value = {}
    mockLeaguesState.leagues = [{ id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active' }]
  })

  it('empty state shows the empty-state placeholder', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="groups-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(false)
  })

  it('empty state shows a "Csoport létrehozása" CTA button', () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="create-group-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Csoport létrehozása')
  })

  it('empty state also shows the Join button', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="empty-join-btn"]').exists()).toBe(true)
  })

  it('with groups the groups-list is shown and empty-state is not', () => {
    mockStoreState.groups = [SAMPLE_GROUP]
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="groups-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('group card shows league name when group has a league', () => {
    mockStoreState.groups = [SAMPLE_GROUP]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('VB 2026')
  })

  it('group card shows nothing extra when group has no league', () => {
    mockStoreState.groups = [{ ...SAMPLE_GROUP, leagues: [] }]
    const wrapper = mountView()
    expect(wrapper.text()).not.toContain('VB 2026')
  })

  it('the "Csoportok" heading is visible on the page', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Csoportok')
  })

  it('clicking create-group-btn shows the create-form', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="create-form"]').exists()).toBe(true)
  })

  it('clicking empty-join-btn shows the join-form', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="empty-join-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="join-form"]').exists()).toBe(true)
  })

  it('create form submit → store.createGroup called', async () => {
    mockCreateGroup.mockResolvedValue(SAMPLE_GROUP)
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    const vm = wrapper.vm as unknown as { createName: string; onCreateSubmit: () => Promise<void> }
    vm.createName = 'Barátok'
    await vm.onCreateSubmit()
    expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Barátok', description: null, leagueIds: ['l-1'] })
  })

  it('join form submit → store.joinGroup called', async () => {
    mockStoreState.groups = [SAMPLE_GROUP]
    mockJoinGroup.mockResolvedValue(SAMPLE_GROUP)
    const wrapper = mountView()
    await wrapper.find('[data-testid="join-group-btn"]').trigger('click')
    await nextTick()
    const vm = wrapper.vm as unknown as { joinCode: string; onJoinSubmit: () => Promise<void> }
    vm.joinCode = 'ABCD1234'
    await vm.onJoinSubmit()
    expect(mockJoinGroup).toHaveBeenCalledWith({ inviteCode: 'ABCD1234' })
  })

  it('rank badge is shown when userRank is not null', () => {
    mockStoreState.groups = [{ ...SAMPLE_GROUP, userRank: 3 }]
    const wrapper = mountView()
    const badge = wrapper.find('[data-testid="rank-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('#3')
  })

  it('rank badge is not shown when userRank is null', () => {
    mockStoreState.groups = [{ ...SAMPLE_GROUP, userRank: null }]
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="rank-badge"]').exists()).toBe(false)
  })

  it('inviteError=notFound query → banner appears with the translated text', () => {
    mockRouteQuery.value = { inviteError: 'notFound' }
    const wrapper = mountView()
    const banner = wrapper.find('[data-testid="invite-error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('A meghívó link már nem érvényes.')
  })

  it('inviteError=alreadyMember → banner shows the "Already a member" message', () => {
    mockRouteQuery.value = { inviteError: 'alreadyMember' }
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="invite-error-banner"]').text()).toContain('Már tagja vagy a csoportnak.')
  })

  it('no banner for an invalid inviteError value', () => {
    mockRouteQuery.value = { inviteError: 'notARealKey' }
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="invite-error-banner"]').exists()).toBe(false)
  })

  it('no banner without an inviteError query', () => {
    mockRouteQuery.value = {}
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="invite-error-banner"]').exists()).toBe(false)
  })

  it('dismiss button clears the inviteError query via router.replace', async () => {
    mockRouteQuery.value = { inviteError: 'generic', other: 'keep' }
    const wrapper = mountView()
    await wrapper.find('[data-testid="invite-error-dismiss"]').trigger('click')
    expect(mockReplace).toHaveBeenCalledWith({ query: { other: 'keep' } })
  })

  // ─── league picker (US-959) ────────────────────────────────────────────────

  it('single active league → league multiselect is rendered', async () => {
    mockLeaguesState.leagues = [{ id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active' }]
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="group-leagues-multiselect"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="group-league-checkbox"]')).toHaveLength(1)
  })

  it('single active league → group is created with that league preselected', async () => {
    mockLeaguesState.leagues = [{ id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active' }]
    mockCreateGroup.mockResolvedValue(SAMPLE_GROUP)
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    const vm = wrapper.vm as unknown as { createName: string; onCreateSubmit: () => Promise<void> }
    vm.createName = 'Barátok'
    await vm.onCreateSubmit()
    expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Barátok', description: null, leagueIds: ['l-1'] })
  })

  it('zero active leagues → empty-state shown and submit disabled', async () => {
    mockLeaguesState.leagues = []
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-testid="group-no-active-leagues"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-leagues-multiselect"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="create-submit-btn"]').attributes('disabled')).toBeDefined()
  })

  it('archived league is not offered in the picker', async () => {
    mockLeaguesState.leagues = [
      { id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active' },
      { id: 'l-2', name: 'NB I 2025/26', shortName: 'NB1', status: 'archived' },
    ]
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="group-league-checkbox"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('NB I 2025/26')
  })

  it('multiple active leagues → all preselected, minOne error when all unchecked', async () => {
    mockLeaguesState.leagues = [
      { id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active' },
      { id: 'l-2', name: 'Euro 2028', shortName: 'EU', status: 'active' },
    ]
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('[data-testid="group-league-checkbox"]')).toHaveLength(2)
    const vm = wrapper.vm as unknown as { createName: string; selectedLeagueIds: string[]; onCreateSubmit: () => Promise<void> }
    vm.createName = 'Barátok'
    vm.selectedLeagueIds = []
    await vm.onCreateSubmit()
    expect(mockCreateGroup).not.toHaveBeenCalled()
    await nextTick()
    expect(wrapper.find('[data-testid="create-error"]').exists()).toBe(true)
  })
})
