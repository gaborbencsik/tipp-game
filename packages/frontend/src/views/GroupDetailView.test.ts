import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import GroupDetailView from '@/views/GroupDetailView.vue'
import { useGroupsStore } from '@/stores/groups.store'
import type { Group, GroupMember, LeaderboardEntry } from '@/types/index'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'group-uuid-1' } }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

const {
  mockGroupsLeaderboard,
  mockGroupsMembers,
  mockGroupsRemoveMember,
  mockGroupsUpdateMemberRole,
  mockGroupsMine,
  mockGroupsRegenerateInvite,
  mockGroupsSetInviteActive,
} = vi.hoisted(() => ({
  mockGroupsLeaderboard: vi.fn().mockResolvedValue([]),
  mockGroupsMembers: vi.fn().mockResolvedValue([]),
  mockGroupsRemoveMember: vi.fn().mockResolvedValue({ success: true }),
  mockGroupsUpdateMemberRole: vi.fn().mockResolvedValue(undefined),
  mockGroupsMine: vi.fn().mockResolvedValue([]),
  mockGroupsRegenerateInvite: vi.fn().mockResolvedValue(undefined),
  mockGroupsSetInviteActive: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
    groups: {
      mine: mockGroupsMine,
      leaderboard: mockGroupsLeaderboard,
      members: mockGroupsMembers,
      removeMember: mockGroupsRemoveMember,
      updateMemberRole: mockGroupsUpdateMemberRole,
      regenerateInvite: mockGroupsRegenerateInvite,
      setInviteActive: mockGroupsSetInviteActive,
    },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    matches: { list: vi.fn() },
  },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: 'user-uuid-1', role: 'user' },
      isAuthenticated: () => true,
      logout: vi.fn(),
    }),
  }
})

const GROUP: Group = {
  id: 'group-uuid-1',
  name: 'Barátok',
  description: null,
  inviteCode: 'ABCD1234',
  inviteActive: true,
  createdBy: 'user-uuid-1',
  memberCount: 2,
  isAdmin: true,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const MEMBER_SELF: GroupMember = {
  id: 'gm-uuid-1',
  userId: 'user-uuid-1',
  displayName: 'Alice',
  avatarUrl: null,
  isAdmin: true,
  joinedAt: '2026-01-01T00:00:00.000Z',
}

const MEMBER_OTHER: GroupMember = {
  id: 'gm-uuid-2',
  userId: 'user-uuid-2',
  displayName: 'Bob',
  avatarUrl: null,
  isAdmin: false,
  joinedAt: '2026-01-02T00:00:00.000Z',
}

const LEADERBOARD_ENTRY: LeaderboardEntry = {
  rank: 1,
  userId: 'user-uuid-1',
  displayName: 'Alice',
  avatarUrl: null,
  totalPoints: 10,
  predictionCount: 5,
  correctCount: 3,
}

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups', component: { template: '<div />' } },
      { path: '/groups/:id', component: GroupDetailView },
    ],
  })
}

async function mountView(
  members: GroupMember[] = [],
  leaderboard: LeaderboardEntry[] = [],
  groups: Group[] = [GROUP],
) {
  mockGroupsMembers.mockResolvedValue(members)
  mockGroupsLeaderboard.mockResolvedValue(leaderboard)
  mockGroupsMine.mockResolvedValue(groups)
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGroupsStore()
  store.groups = groups
  const wrapper = mount(GroupDetailView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store }
}

describe('GroupDetailView', () => {
  beforeEach(() => {
    mockGroupsLeaderboard.mockReset().mockResolvedValue([])
    mockGroupsMembers.mockReset().mockResolvedValue([])
    mockGroupsRemoveMember.mockReset().mockResolvedValue({ success: true })
    mockGroupsUpdateMemberRole.mockReset()
    mockGroupsRegenerateInvite.mockReset().mockResolvedValue(undefined)
    mockGroupsSetInviteActive.mockReset().mockResolvedValue(undefined)
    mockGroupsMine.mockReset().mockResolvedValue([GROUP])
    setActivePinia(createPinia())
  })

  // ─── Tab switching ────────────────────────────────────────────────────────────

  it('tab-bar visible, leaderboard tab active by default', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    expect(wrapper.find('[data-testid="tab-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-leaderboard"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tab-members"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(false)
  })

  it('clicking Tagok tab → members-tab visible', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(true)
  })

  it('clicking Ranglista tab after switching → members-tab hidden', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="tab-leaderboard"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(false)
  })

  it('non-admin user → Tagok tab not visible', async () => {
    const { wrapper } = await mountView([{ ...MEMBER_SELF, isAdmin: false }])
    expect(wrapper.find('[data-testid="tab-members"]').exists()).toBe(false)
  })

  // ─── Members list ─────────────────────────────────────────────────────────────

  it('admin user → action buttons visible for other members', async () => {
    const { wrapper } = await mountView([MEMBER_SELF, MEMBER_OTHER])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Eltávolít')
  })

  it('own member row buttons are disabled', async () => {
    const { wrapper } = await mountView([MEMBER_SELF, MEMBER_OTHER])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-testid="member-row"]')
    const selfRow = rows[0]
    const buttons = selfRow.findAll('button')
    buttons.forEach((btn) => {
      expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    })
  })

  // ─── Confirm dialog ───────────────────────────────────────────────────────────

  it('clicking Eltávolít → confirm dialog appears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF, MEMBER_OTHER])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
    const rows = wrapper.findAll('[data-testid="member-row"]')
    const otherRow = rows[1]
    const removeBtn = otherRow.findAll('button').find(b => b.text().includes('Eltávolít'))
    await removeBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(true)
  })

  it('clicking Mégse → confirm dialog disappears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF, MEMBER_OTHER])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-testid="member-row"]')
    const otherRow = rows[1]
    const removeBtn = otherRow.findAll('button').find(b => b.text().includes('Eltávolít'))
    await removeBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="confirm-dialog"]').exists()).toBe(false)
  })

  it('clicking Eltávolítás → store.removeMember called', async () => {
    const { wrapper, store } = await mountView([MEMBER_SELF, MEMBER_OTHER])
    const removeSpy = vi.spyOn(store, 'removeMember').mockResolvedValue()
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-testid="member-row"]')
    const otherRow = rows[1]
    const removeBtn = otherRow.findAll('button').find(b => b.text().includes('Eltávolít'))
    await removeBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="confirm-ok"]').trigger('click')
    await flushPromises()
    expect(removeSpy).toHaveBeenCalledWith('group-uuid-1', 'user-uuid-2')
  })

  it('clicking Admin/Admin visszavon → store.toggleMemberAdmin called', async () => {
    const { wrapper, store } = await mountView([MEMBER_SELF, MEMBER_OTHER])
    const toggleSpy = vi.spyOn(store, 'toggleMemberAdmin').mockResolvedValue()
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('[data-testid="member-row"]')
    const otherRow = rows[1]
    const adminBtn = otherRow.findAll('button').find(b => b.text().includes('Admin'))
    await adminBtn!.trigger('click')
    await flushPromises()
    expect(toggleSpy).toHaveBeenCalledWith('group-uuid-1', 'user-uuid-2', true)
  })

  // ─── Leaderboard ──────────────────────────────────────────────────────────────

  it('leaderboard entries rendered on leaderboard tab', async () => {
    const { wrapper } = await mountView([], [LEADERBOARD_ENTRY])
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('10')
  })

  // ─── Invite section ───────────────────────────────────────────────────────────

  it('invite section visible for admin on members tab', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-section"]').exists()).toBe(true)
  })

  it('invite section shows invite code', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-code-display"]').text()).toBe('ABCD1234')
  })

  it('invite section not visible on leaderboard tab', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    expect(wrapper.find('[data-testid="invite-section"]').exists()).toBe(false)
  })

  it('clicking Újragenerálás → confirm dialog appears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-confirm-dialog"]').exists()).toBe(false)
    await wrapper.find('[data-testid="invite-regenerate-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-confirm-dialog"]').exists()).toBe(true)
  })

  it('invite confirm cancel → dialog disappears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="invite-regenerate-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="invite-confirm-cancel"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-confirm-dialog"]').exists()).toBe(false)
  })

  it('invite confirm OK → store.regenerateInvite called', async () => {
    const { wrapper, store } = await mountView([MEMBER_SELF])
    const regenerateSpy = vi.spyOn(store, 'regenerateInvite').mockResolvedValue()
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="invite-regenerate-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="invite-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(regenerateSpy).toHaveBeenCalledWith('group-uuid-1')
  })

  it('clicking toggle button → store.setInviteActive called', async () => {
    const { wrapper, store } = await mountView([MEMBER_SELF])
    const toggleSpy = vi.spyOn(store, 'setInviteActive').mockResolvedValue()
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="invite-toggle-btn"]').trigger('click')
    await flushPromises()
    expect(toggleSpy).toHaveBeenCalledWith('group-uuid-1', false)
  })
})
