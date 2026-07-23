import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GroupDetailView from '@/views/GroupDetailView.vue'
import { useGroupsStore } from '@/stores/groups.store'
import type { Group, GroupMember, LeaderboardEntry, Match } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ params: { id: 'group-uuid-1' }, path: '/groups/group-uuid-1', query: {} }),
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
  mockGroupsDelete,
  mockGroupsMatches,
  mockGroupsAddMatch,
  mockGroupsRemoveMatch,
  mockMatchesList,
} = vi.hoisted(() => ({
  mockGroupsLeaderboard: vi.fn().mockResolvedValue([]),
  mockGroupsMembers: vi.fn().mockResolvedValue([]),
  mockGroupsRemoveMember: vi.fn().mockResolvedValue({ success: true }),
  mockGroupsUpdateMemberRole: vi.fn().mockResolvedValue(undefined),
  mockGroupsMine: vi.fn().mockResolvedValue([]),
  mockGroupsRegenerateInvite: vi.fn().mockResolvedValue(undefined),
  mockGroupsSetInviteActive: vi.fn().mockResolvedValue(undefined),
  mockGroupsDelete: vi.fn().mockResolvedValue(undefined),
  mockGroupsMatches: vi.fn().mockResolvedValue([]),
  mockGroupsAddMatch: vi.fn().mockResolvedValue({ ok: true }),
  mockGroupsRemoveMatch: vi.fn().mockResolvedValue({ ok: true }),
  mockMatchesList: vi.fn().mockResolvedValue([]),
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
      delete: mockGroupsDelete,
      matches: mockGroupsMatches,
      addMatch: mockGroupsAddMatch,
      removeMatch: mockGroupsRemoveMatch,
    },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    matches: { list: mockMatchesList },
  },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: 'user-uuid-1', role: 'user', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
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
  userRank: null,
  favoriteTeamDoublePoints: false,
  leagues: [{ id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active', type: 'league' }],
  createdAt: '2026-01-01T00:00:00.000Z',
}

const MEMBER_SELF: GroupMember = {
  id: 'gm-uuid-1',
  userId: 'user-uuid-1',
  displayName: 'Alice',
  avatarUrl: null,
  isAdmin: true,
  isPaid: false,
  isSupporter: false,
  joinedAt: '2026-01-01T00:00:00.000Z',
}

const MEMBER_OTHER: GroupMember = {
  id: 'gm-uuid-2',
  userId: 'user-uuid-2',
  displayName: 'Bob',
  avatarUrl: null,
  isAdmin: false,
  isPaid: false,
  isSupporter: false,
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
  matchPoints: 10,
  scorerBonusPoints: 0,
  successRate: 60,
  matchSuccessRate: 60,
  scorerSuccessRate: 0,
  specialPredictionPoints: 0,
  tournamentMaxPoints: 0,
  tournamentSuccessRate: null,
  isSupporter: false,
}

// Build the test router once per file — 25 routes × 40 tests was measurable overhead.
const sharedRouter = buildTestRouter({ '/app/groups/:id': GroupDetailView })
function buildRouter() {
  return sharedRouter
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
    mockGroupsDelete.mockReset().mockResolvedValue(undefined)
    mockGroupsMine.mockReset().mockResolvedValue([GROUP])
    mockGroupsMatches.mockReset().mockResolvedValue([])
    mockGroupsAddMatch.mockReset().mockResolvedValue({ ok: true })
    mockGroupsRemoveMatch.mockReset().mockResolvedValue({ ok: true })
    mockMatchesList.mockReset().mockResolvedValue([])
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

  it('clicking Members tab → members-tab visible', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(true)
  })

  it('clicking Leaderboard tab after switching → members-tab hidden', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-members"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="tab-leaderboard"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(false)
  })

  it('non-admin user → Members tab not visible', async () => {
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

  it('clicking Remove → confirm dialog appears', async () => {
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

  it('clicking Cancel → confirm dialog disappears', async () => {
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

  it('clicking Remove confirm → store.removeMember called', async () => {
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

  it('clicking Admin/Revoke admin → store.toggleMemberAdmin called', async () => {
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

  it('leaderboard shows favorite team flag when entry has favoriteTeam', async () => {
    const entryWithFav: LeaderboardEntry = {
      ...LEADERBOARD_ENTRY,
      favoriteTeam: { countryCode: 'br', name: 'Brazil' },
    }
    const { wrapper } = await mountView([], [entryWithFav])
    const flag = wrapper.find('.fi.fi-br')
    expect(flag.exists()).toBe(true)
    expect(flag.attributes('title')).toBe('Brazil')
  })

  it('leaderboard does not show flag when favoriteTeam is null', async () => {
    const entryNoFav: LeaderboardEntry = {
      ...LEADERBOARD_ENTRY,
      favoriteTeam: null,
    }
    const { wrapper } = await mountView([], [entryNoFav])
    const flags = wrapper.findAll('[class*="fi fi-"]')
    expect(flags.length).toBe(0)
  })

  it('header does not show league name (moved to Settings tab — UX-024)', async () => {
    const { wrapper } = await mountView()
    const h1 = wrapper.find('h1')
    expect(h1.text()).not.toContain('VB 2026')
    const headerWrapper = h1.element.closest('div')?.parentElement
    expect(headerWrapper?.textContent).not.toContain('VB 2026')
  })

  it('header back-to-groups link is always visible as arrow icon (UX-024)', async () => {
    const { wrapper } = await mountView()
    const backLinks = wrapper.findAll('a[href="/app/groups"]')
    const headerBackLink = backLinks.find(a => a.classes().includes('text-blue-600'))
    expect(headerBackLink).toBeDefined()
    expect(headerBackLink!.classes()).not.toContain('hidden')
    expect(headerBackLink!.find('svg').exists()).toBe(true)
    expect(headerBackLink!.attributes('aria-label')).toBeTruthy()
  })

  it('leaderboard table hides only thead on mobile, all data columns visible (UX-024)', async () => {
    const { wrapper } = await mountView([], [LEADERBOARD_ENTRY])
    const thead = wrapper.find('table thead')
    expect(thead.classes()).toContain('hidden')
    expect(thead.classes()).toContain('md:table-header-group')
    const dataCells = wrapper.findAll('table tbody tr:first-child td')
    expect(dataCells.length).toBe(5)
    for (const td of dataCells) {
      expect(td.classes()).not.toContain('hidden')
    }
  })

  it('header shows nothing when group has no league', async () => {
    const noLeagueGroup: Group = { ...GROUP, leagues: [] }
    const { wrapper } = await mountView([], [], [noLeagueGroup])
    expect(wrapper.text()).not.toContain('VB 2026')
  })

  // ─── Invite section ───────────────────────────────────────────────────────────

  it('invite section visible for admin on settings tab', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-section"]').exists()).toBe(true)
  })

  it('invite section shows invite code', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-code-display"]').text()).toBe('ABCD1234')
  })

  it('invite section not visible on leaderboard tab', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    expect(wrapper.find('[data-testid="invite-section"]').exists()).toBe(false)
  })

  it('clicking Regenerate → confirm dialog appears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-confirm-dialog"]').exists()).toBe(false)
    await wrapper.find('[data-testid="invite-regenerate-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-confirm-dialog"]').exists()).toBe(true)
  })

  it('invite confirm cancel → dialog disappears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
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
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
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
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="invite-toggle-btn"]').trigger('click')
    await flushPromises()
    expect(toggleSpy).toHaveBeenCalledWith('group-uuid-1', false)
  })

  // ─── League lock ───────────────────────────────────────────────────────────

  // ─── League management (US-952) ────────────────────────────────────────────

  it('league section shows league chips', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('VB 2026')
    expect(wrapper.find('[data-testid="group-league-chip"]').exists()).toBe(true)
  })

  it('admin sees a remove button when the group has multiple leagues', async () => {
    const multiLeagueGroup: Group = { ...GROUP, leagues: [
      { id: 'l-1', name: 'VB 2026', shortName: 'VB', status: 'active', type: 'league' },
      { id: 'l-2', name: 'NB I', shortName: 'NB I', status: 'active', type: 'league' },
    ] }
    const { wrapper } = await mountView([MEMBER_SELF], [], [multiLeagueGroup])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="group-league-remove-btn"]').exists()).toBe(true)
  })

  // ─── Delete group ─────────────────────────────────────────────────────────────

  it('delete group button visible for admin on settings tab', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="delete-group-btn"]').exists()).toBe(true)
  })

  it('clicking delete group button → confirm dialog appears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="delete-confirm-dialog"]').exists()).toBe(false)
    await wrapper.find('[data-testid="delete-group-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="delete-confirm-dialog"]').exists()).toBe(true)
  })

  it('delete confirm cancel → dialog disappears', async () => {
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="delete-group-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="delete-confirm-cancel"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="delete-confirm-dialog"]').exists()).toBe(false)
  })

  it('delete confirm OK → store.deleteGroup called', async () => {
    const { wrapper, store } = await mountView([MEMBER_SELF])
    const deleteSpy = vi.spyOn(store, 'deleteGroup').mockResolvedValue()
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="delete-group-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="delete-confirm-ok"]').trigger('click')
    await flushPromises()
    expect(deleteSpy).toHaveBeenCalledWith('group-uuid-1')
  })

  // ─── My predictions tab – scorer columns (UX-036) ─────────────────────────────

  async function mountWithMyPredictions(rows: Array<Partial<{
    predictionId: string
    matchId: string
    points: number
    matchPoints: number
    scorerBonusPoints: number
    scorerPickPlayerName: string | null
    doubledByFavorite: boolean
  }>>) {
    const fullRows = rows.map((r, i) => ({
      predictionId: r.predictionId ?? `p${i + 1}`,
      matchId: r.matchId ?? `m${i + 1}`,
      scheduledAt: '2026-06-14T18:00:00Z',
      homeTeam: { id: 'th', name: 'Hungary', shortCode: 'HUN', flagUrl: null },
      awayTeam: { id: 'ta', name: 'France', shortCode: 'FRA', flagUrl: null },
      homeGoals: 2,
      awayGoals: 1,
      resultHomeGoals: 2,
      resultAwayGoals: 1,
      points: r.points ?? 0,
      matchPoints: r.matchPoints ?? 0,
      scorerBonusPoints: r.scorerBonusPoints ?? 0,
      scorerPickPlayerName: r.scorerPickPlayerName ?? null,
      doubledByFavorite: r.doubledByFavorite ?? false,
    }))
    const total = fullRows.reduce((s, r) => s + r.points, 0)
    const { wrapper, store } = await mountView([MEMBER_SELF])
    store.myGroupPredictionsMap = { 'group-uuid-1': { predictions: fullRows, totalPoints: total } }
    await wrapper.find('[data-testid="tab-my-predictions"]').trigger('click')
    await flushPromises()
    return { wrapper, store }
  }

  it('My predictions table renders new column headers (Match pts, Scorer pick, Scorer pts, Total pts)', async () => {
    const { wrapper } = await mountWithMyPredictions([{ points: 4, matchPoints: 3, scorerBonusPoints: 1, scorerPickPlayerName: 'Salah' }])
    const table = wrapper.find('[data-testid="my-predictions-tab"] table')
    const headers = table.findAll('thead th').map(th => th.text())
    expect(headers).toContain('⚽ Meccs pont')
    expect(headers).toContain('Gólszerző tipp')
    expect(headers).toContain('👟 Gólszerző pont')
    expect(headers).toContain('Összes pont')
  })

  it('My predictions row shows match points, scorer pick name, scorer points, total points', async () => {
    const { wrapper } = await mountWithMyPredictions([{ points: 4, matchPoints: 3, scorerBonusPoints: 1, scorerPickPlayerName: 'Salah' }])
    const row = wrapper.find('[data-testid="my-prediction-row"]')
    expect(row.find('[data-testid="my-pred-match-points"]').text()).toBe('3')
    expect(row.find('[data-testid="my-pred-scorer-name"]').text()).toBe('Salah')
    expect(row.find('[data-testid="my-pred-scorer-points"]').text()).toBe('1')
    expect(row.find('[data-testid="my-pred-total-points"]').text()).toContain('4')
  })

  it('My predictions row shows em-dash when scorer pick name is null', async () => {
    const { wrapper } = await mountWithMyPredictions([{ points: 3, matchPoints: 3, scorerBonusPoints: 0, scorerPickPlayerName: null }])
    const cell = wrapper.find('[data-testid="my-prediction-row"] [data-testid="my-pred-scorer-name"]')
    expect(cell.text()).toBe('—')
  })

  it('My predictions row shows the ×2 badges in match-points and scorer-points columns when doubledByFavorite', async () => {
    const { wrapper } = await mountWithMyPredictions([{ points: 8, matchPoints: 3, scorerBonusPoints: 1, scorerPickPlayerName: 'Mbappé', doubledByFavorite: true }])
    const row = wrapper.find('[data-testid="my-prediction-row"]')
    expect(row.find('[data-testid="match-double-badge"]').exists()).toBe(true)
    expect(row.find('[data-testid="scorer-double-badge"]').exists()).toBe(true)
    // Total cell no longer carries the badge
    expect(row.find('[data-testid="my-pred-total-points"] [data-testid="double-badge"]').exists()).toBe(false)
  })

  it('My predictions new columns are hidden on mobile (hidden md:table-cell)', async () => {
    const { wrapper } = await mountWithMyPredictions([{ points: 4, matchPoints: 3, scorerBonusPoints: 1, scorerPickPlayerName: 'Salah' }])
    const matchPtsHeader = wrapper.find('[data-testid="my-pred-match-points-header"]')
    const scorerHeader = wrapper.find('[data-testid="my-pred-scorer-name-header"]')
    const scorerPtsHeader = wrapper.find('[data-testid="my-pred-scorer-points-header"]')
    expect(matchPtsHeader.classes()).toContain('hidden')
    expect(matchPtsHeader.classes()).toContain('md:table-cell')
    expect(scorerHeader.classes()).toContain('hidden')
    expect(scorerHeader.classes()).toContain('md:table-cell')
    expect(scorerPtsHeader.classes()).toContain('hidden')
    expect(scorerPtsHeader.classes()).toContain('md:table-cell')
  })

  // ─── Color coding (UX-036 follow-up) ────────────────────────────────────────

  async function mountWithRichPrediction(p: {
    homeGoals: number; awayGoals: number
    resultHomeGoals: number; resultAwayGoals: number
    points: number; matchPoints: number
    scorerBonusPoints: number; scorerPickPlayerName: string | null
  }) {
    const fullRow = {
      predictionId: 'p1',
      matchId: 'm1',
      scheduledAt: '2026-06-14T18:00:00Z',
      homeTeam: { id: 'th', name: 'Hungary', shortCode: 'HUN', flagUrl: null },
      awayTeam: { id: 'ta', name: 'France', shortCode: 'FRA', flagUrl: null },
      homeGoals: p.homeGoals,
      awayGoals: p.awayGoals,
      resultHomeGoals: p.resultHomeGoals,
      resultAwayGoals: p.resultAwayGoals,
      points: p.points,
      matchPoints: p.matchPoints,
      scorerBonusPoints: p.scorerBonusPoints,
      scorerPickPlayerName: p.scorerPickPlayerName,
      doubledByFavorite: false,
    }
    const { wrapper, store } = await mountView([MEMBER_SELF])
    store.myGroupPredictionsMap = { 'group-uuid-1': { predictions: [fullRow], totalPoints: p.points } }
    await wrapper.find('[data-testid="tab-my-predictions"]').trigger('click')
    await flushPromises()
    return { wrapper, store }
  }

  it('exact match → row gets green tint + tip cell green/bold', async () => {
    const { wrapper } = await mountWithRichPrediction({ homeGoals: 2, awayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1, points: 3, matchPoints: 3, scorerBonusPoints: 0, scorerPickPlayerName: null })
    const row = wrapper.find('[data-testid="my-prediction-row"]')
    expect(row.classes()).toContain('bg-green-50')
    const tip = wrapper.find('[data-testid="my-pred-tip"]')
    expect(tip.classes()).toContain('text-green-700')
    expect(tip.classes()).toContain('font-bold')
  })

  it('outcome match (not exact) → row gets yellow tint + tip cell yellow', async () => {
    // 2-0 tip vs 3-1 result: same outcome (home win), not exact
    const { wrapper } = await mountWithRichPrediction({ homeGoals: 2, awayGoals: 0, resultHomeGoals: 3, resultAwayGoals: 1, points: 1, matchPoints: 1, scorerBonusPoints: 0, scorerPickPlayerName: null })
    const row = wrapper.find('[data-testid="my-prediction-row"]')
    expect(row.classes()).toContain('bg-yellow-50')
    const tip = wrapper.find('[data-testid="my-pred-tip"]')
    expect(tip.classes()).toContain('text-yellow-700')
  })

  it('miss → row stays neutral, tip cell muted', async () => {
    const { wrapper } = await mountWithRichPrediction({ homeGoals: 0, awayGoals: 2, resultHomeGoals: 3, resultAwayGoals: 0, points: 0, matchPoints: 0, scorerBonusPoints: 0, scorerPickPlayerName: null })
    const row = wrapper.find('[data-testid="my-prediction-row"]')
    expect(row.classes()).not.toContain('bg-green-50')
    expect(row.classes()).not.toContain('bg-yellow-50')
    const tip = wrapper.find('[data-testid="my-pred-tip"]')
    expect(tip.classes()).toContain('text-gray-500')
  })

  it('scorer hit → scorer cell green', async () => {
    const { wrapper } = await mountWithRichPrediction({ homeGoals: 2, awayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1, points: 4, matchPoints: 3, scorerBonusPoints: 1, scorerPickPlayerName: 'Salah' })
    const cell = wrapper.find('[data-testid="my-pred-scorer-name"]')
    expect(cell.classes()).toContain('text-green-700')
    expect(cell.classes()).toContain('font-bold')
  })

  it('scorer miss → scorer cell muted with line-through', async () => {
    const { wrapper } = await mountWithRichPrediction({ homeGoals: 2, awayGoals: 1, resultHomeGoals: 2, resultAwayGoals: 1, points: 3, matchPoints: 3, scorerBonusPoints: 0, scorerPickPlayerName: 'Salah' })
    const cell = wrapper.find('[data-testid="my-pred-scorer-name"]')
    expect(cell.classes()).toContain('text-gray-500')
    expect(cell.classes()).toContain('line-through')
  })

  // ─── US-953: hand-picked matches (admin, settings tab) ────────────────────────

  function makeMatch(id: string, home: string, away: string, handPicked = false): Match {
    return {
      id,
      homeTeam: { id: `${id}-h`, name: home, shortCode: home.slice(0, 3), flagUrl: null, teamType: 'national', countryCode: null, marketValueEur: null, transfermarktId: null },
      awayTeam: { id: `${id}-a`, name: away, shortCode: away.slice(0, 3), flagUrl: null, teamType: 'national', countryCode: null, marketValueEur: null, transfermarktId: null },
      venue: null,
      league: { id: 'l-9', name: 'Other', shortName: 'OTH', type: 'league' },
      stage: 'group',
      groupName: null,
      matchNumber: null,
      scheduledAt: '2026-06-14T18:00:00.000Z',
      status: 'scheduled',
      result: null,
      handPicked,
    }
  }

  it('hand-picked match shows in the list with the badge', async () => {
    mockGroupsMatches.mockResolvedValue([makeMatch('m-1', 'Brazil', 'Argentina', true)])
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="group-match-handpicked-badge"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="group-match-handpicked-row"]').text()).toContain('Brazil')
  })

  it('search + add → store.addGroupMatch called with the match id', async () => {
    mockMatchesList.mockResolvedValue([makeMatch('m-2', 'Spain', 'Italy')])
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await flushPromises()

    const search = wrapper.find('[data-testid="group-match-search"]')
    await search.setValue('spain')
    await new Promise(r => setTimeout(r, 350))
    await flushPromises()

    const addBtn = wrapper.find('[data-testid="group-match-add-btn"]')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()
    expect(mockGroupsAddMatch).toHaveBeenCalledWith('tok', 'group-uuid-1', 'm-2')
  })

  it('remove button → store.removeGroupMatch called', async () => {
    mockGroupsMatches.mockResolvedValue([makeMatch('m-3', 'Germany', 'France', true)])
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="group-match-remove-btn"]').trigger('click')
    await flushPromises()
    expect(mockGroupsRemoveMatch).toHaveBeenCalledWith('tok', 'group-uuid-1', 'm-3')
  })

  it('non-admin does not see the hand-picked match section', async () => {
    const { wrapper } = await mountView([{ ...MEMBER_SELF, isAdmin: false }], [], [{ ...GROUP, isAdmin: false }])
    expect(wrapper.find('[data-testid="group-match-search"]').exists()).toBe(false)
  })

  it('renders hand-picked matches in the order returned by the store (most recent first)', async () => {
    mockGroupsMatches.mockResolvedValue([
      makeMatch('m-new', 'Newest', 'Team', true),
      makeMatch('m-old', 'Oldest', 'Team', true),
    ])
    const { wrapper } = await mountView([MEMBER_SELF])
    await wrapper.find('[data-testid="tab-settings"]').trigger('click')
    await flushPromises()
    const rows = wrapper.findAll('[data-testid="group-match-handpicked-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Newest')
    expect(rows[1]!.text()).toContain('Oldest')
  })
})
