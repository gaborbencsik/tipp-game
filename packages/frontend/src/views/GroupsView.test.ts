import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Group } from '@/types/index'
import GroupsView from '@/views/GroupsView.vue'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
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

const { mockFetchMyGroups, mockCreateGroup, mockJoinGroup, mockStoreState } = vi.hoisted(() => ({
  mockFetchMyGroups: vi.fn().mockResolvedValue(undefined),
  mockCreateGroup: vi.fn(),
  mockJoinGroup: vi.fn(),
  mockStoreState: { groups: [] as import('@/types/index').Group[], isLoading: false, error: null as string | null },
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
  })

  it('üres állapotban empty-state jelenik meg', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="groups-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(false)
  })

  it('üres állapotban \"Csoport létrehozása\" CTA gomb látható', () => {
    const wrapper = mountView()
    const btn = wrapper.find('[data-testid="create-group-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Csoport létrehozása')
  })

  it('üres állapotban Csatlakozás gomb is látható', () => {
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="empty-join-btn"]').exists()).toBe(true)
  })

  it('csoportok esetén groups-list jelenik meg és nem empty-state', () => {
    mockStoreState.groups = [SAMPLE_GROUP]
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="groups-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('az oldalon az \"Csoportok\" fejléc látható', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Csoportok')
  })

  it('create-group-btn kattintásra megjelenik a create-form', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="create-form"]').exists()).toBe(true)
  })

  it('empty-join-btn kattintásra megjelenik a join-form', async () => {
    const wrapper = mountView()
    await wrapper.find('[data-testid="empty-join-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="join-form"]').exists()).toBe(true)
  })

  it('create form submit → store.createGroup hívva', async () => {
    mockCreateGroup.mockResolvedValue(SAMPLE_GROUP)
    const wrapper = mountView()
    await wrapper.find('[data-testid="create-group-btn"]').trigger('click')
    await nextTick()
    const vm = wrapper.vm as unknown as { createName: string; onCreateSubmit: () => Promise<void> }
    vm.createName = 'Barátok'
    await vm.onCreateSubmit()
    expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'Barátok', description: null })
  })

  it('join form submit → store.joinGroup hívva', async () => {
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

  it('rank badge megjelenik ha userRank nem null', () => {
    mockStoreState.groups = [{ ...SAMPLE_GROUP, userRank: 3 }]
    const wrapper = mountView()
    const badge = wrapper.find('[data-testid="rank-badge"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('#3')
  })

  it('rank badge nem jelenik meg ha userRank null', () => {
    mockStoreState.groups = [{ ...SAMPLE_GROUP, userRank: null }]
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="rank-badge"]').exists()).toBe(false)
  })
})
