import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MatchesView from '@/views/MatchesView.vue'
import { useMatchesStore } from '@/stores/matches.store'
import { usePredictionsStore } from '@/stores/predictions.store'
import type { Match, Prediction } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockMatchesList, mockPredictionsMine, mockPredictionsUpsert, mockLeaguesList, mockGetLeagueFavorites, mockFavoritesSummary, mockGroupsGroups } = vi.hoisted(() => ({
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockPredictionsMine: vi.fn().mockResolvedValue([]),
  mockPredictionsUpsert: vi.fn().mockResolvedValue(undefined),
  mockLeaguesList: vi.fn().mockResolvedValue([]),
  mockGetLeagueFavorites: vi.fn().mockResolvedValue([]),
  mockFavoritesSummary: vi.fn().mockResolvedValue({ members: [] }),
  mockGroupsGroups: [] as import('@/types/index').Group[],
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
    matches: { list: mockMatchesList },
    predictions: { mine: mockPredictionsMine, upsert: mockPredictionsUpsert },
    leagues: { list: mockLeaguesList, favoritesSummary: mockFavoritesSummary },
    leagueTeams: { forLeague: vi.fn().mockResolvedValue([]) },
    users: { getLeagueFavorites: mockGetLeagueFavorites, setLeagueFavorite: vi.fn().mockResolvedValue(undefined) },
    players: { list: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: 'db-user-uuid-001', role: 'user', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: () => true,
      logout: vi.fn(),
    }),
  }
})

vi.mock('@/stores/groups.store', () => ({
  useGroupsStore: () => ({
    get groups() { return mockGroupsGroups },
    specialPredictionsMap: {},
    fetchMyGroups: vi.fn().mockResolvedValue(undefined),
    fetchSpecialPredictions: vi.fn().mockResolvedValue(undefined),
  }),
}))

const DEFAULT_LEAGUE = { id: 'l-default', name: 'Default League', shortName: 'DEF' }

// scheduled match with future kickoff (tomorrow = within 7 days)
const MATCH_SCHEDULED: Match = {
  id: 'match-sched',
  homeTeam: { id: 'ht3', name: 'Brazil', shortCode: 'BRA', flagUrl: null, teamType: 'national' as const, countryCode: 'br', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at3', name: 'Argentina', shortCode: 'ARG', flagUrl: null, teamType: 'national' as const, countryCode: 'ar', marketValueEur: null, transfermarktId: null },
  venue: { name: 'Stadium', city: 'Sao Paulo', imageUrl: null },
  league: DEFAULT_LEAGUE,
  stage: 'final',
  groupName: null,
  matchNumber: 64,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // tomorrow
  status: 'scheduled',
  result: null,
}

// scheduled match far in the future (> 7 days)
const MATCH_FAR_FUTURE: Match = {
  id: 'match-far',
  homeTeam: { id: 'ht5', name: 'Portugal', shortCode: 'POR', flagUrl: null, teamType: 'national' as const, countryCode: 'pt', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at5', name: 'Belgium', shortCode: 'BEL', flagUrl: null, teamType: 'national' as const, countryCode: 'be', marketValueEur: null, transfermarktId: null },
  venue: null,
  league: DEFAULT_LEAGUE,
  stage: 'group',
  groupName: 'C',
  matchNumber: 10,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days from now
  status: 'scheduled',
  result: null,
}

const MATCH_LIVE: Match = {
  id: 'match-live',
  homeTeam: { id: 'ht1', name: 'Germany', shortCode: 'GER', flagUrl: null, teamType: 'national' as const, countryCode: 'de', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at1', name: 'France', shortCode: 'FRA', flagUrl: null, teamType: 'national' as const, countryCode: 'fr', marketValueEur: null, transfermarktId: null },
  venue: { name: 'Arena', city: 'Munich', imageUrl: null },
  league: DEFAULT_LEAGUE,
  stage: 'group',
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: '2026-06-11T15:00:00.000Z',
  status: 'live',
  result: null,
}

const MATCH_FINISHED: Match = {
  id: 'match-finished',
  homeTeam: { id: 'ht2', name: 'Spain', shortCode: 'ESP', flagUrl: null, teamType: 'national' as const, countryCode: 'es', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at2', name: 'Italy', shortCode: 'ITA', flagUrl: null, teamType: 'national' as const, countryCode: 'it', marketValueEur: null, transfermarktId: null },
  venue: null,
  league: DEFAULT_LEAGUE,
  stage: 'group',
  groupName: 'B',
  matchNumber: 2,
  scheduledAt: '2026-06-11T18:00:00.000Z',
  status: 'finished',
  result: { homeGoals: 2, awayGoals: 1 },
}

const EXISTING_PREDICTION: Prediction = {
  id: 'pred-1',
  userId: 'db-user-uuid-001',
  matchId: 'match-sched',
  homeGoals: 1,
  awayGoals: 0,
  outcomeAfterDraw: null,
  pointsGlobal: null,
  scorerPickPlayerId: null,
  scorerPlayerNameSnapshot: null,
  scorerBonusPoints: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

function buildRouter() {
  return buildTestRouter({ '/app/matches': MatchesView })
}

const DEFAULT_GROUP_WITH_LEAGUE = {
  id: 'g-default', name: 'Default', description: null, inviteCode: 'X', inviteActive: true,
  createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false,
  league: { id: 'l-default', name: 'Default League', shortName: 'DEF' },
  createdAt: '2026-01-01T00:00:00.000Z',
} as unknown as import('@/types/index').Group

async function mountView(apiMatches: Match[] = [], apiPredictions: Prediction[] = []) {
  mockMatchesList.mockResolvedValue(apiMatches)
  mockPredictionsMine.mockResolvedValue(apiPredictions)
  if (mockGroupsGroups.length === 0) mockGroupsGroups.push(DEFAULT_GROUP_WITH_LEAGUE)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return {
    wrapper,
    matchesStore: useMatchesStore(),
    predictionsStore: usePredictionsStore(),
  }
}

describe('MatchesView', () => {
  beforeEach(() => {
    mockMatchesList.mockReset()
    mockMatchesList.mockResolvedValue([])
    mockPredictionsMine.mockReset()
    mockPredictionsMine.mockResolvedValue([])
    mockPredictionsUpsert.mockReset()
    mockGroupsGroups.length = 0
    mockFavoritesSummary.mockReset()
    mockFavoritesSummary.mockResolvedValue({ members: [] })
    setActivePinia(createPinia())
    localStorage.clear()
  })

  // ─── Loading and rendering ────────────────────────────────────────────────────

  it('spinner visible during loading', async () => {
    let resolveList!: (v: Match[]) => void
    mockMatchesList.mockReturnValue(new Promise<Match[]>(res => { resolveList = res }))
    mockGroupsGroups.push(DEFAULT_GROUP_WITH_LEAGUE)
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolveList([])
  })

  it('does not flicker the no-group CTA before initial data is loaded', async () => {
    // Hold the favorites fetch open so initial data never finishes loading during this assertion
    let resolveFavs!: (v: unknown[]) => void
    mockGetLeagueFavorites.mockReturnValue(new Promise<unknown[]>(res => { resolveFavs = res }))
    // Empty groups: would normally trigger the no-group CTA
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="no-group-league-cta"]').exists()).toBe(false)
    resolveFavs([])
  })

  it('does not flicker the "missed tip" state before predictions are loaded', async () => {
    // Hold predictions fetch open: matches resolve immediately, predictions are pending
    let resolvePreds!: (v: Prediction[]) => void
    mockMatchesList.mockResolvedValue([MATCH_FINISHED])
    mockPredictionsMine.mockReturnValue(new Promise<Prediction[]>(res => { resolvePreds = res }))
    mockGroupsGroups.push(DEFAULT_GROUP_WITH_LEAGUE)
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    // Spinner still up while predictions are pending; the "missed tip" copy must not leak through
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nem tippeltél erre a meccsre')
    expect(wrapper.text()).not.toContain('Még nem tippeltél')
    resolvePreds([])
  })

  it('matches loaded → live and scheduled groups rendered, finished shows last day only', async () => {
    // MATCH_FINISHED is on a different day from MATCH_LIVE so it forms its own all-finished group
    const finishedOnOwnDay: Match = {
      ...MATCH_FINISHED,
      scheduledAt: '2026-06-10T18:00:00.000Z',
    }
    // Put scheduled match on same day as live match so both appear in the first upcoming day
    const scheduledSameDay: Match = {
      ...MATCH_SCHEDULED,
      scheduledAt: '2026-06-11T20:00:00.000Z',
    }
    const { wrapper } = await mountView([MATCH_LIVE, finishedOnOwnDay, scheduledSameDay])
    // upcoming section shows the first day (which has both live and scheduled)
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('France')
    expect(wrapper.text()).toContain('Brazil')
    // finished section is open by default showing last finished day
    expect(wrapper.text()).toContain('Spain')
  })

  it('live match → ÉLŐBEN text visible', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('ÉLŐBEN')
  })

  it('finished match → result scores and teams visible (section open by default)', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    // section is open by default showing the last finished day
    expect(wrapper.text()).toContain('Spain')
    expect(wrapper.text()).toContain('Italy')
    expect(wrapper.text()).toContain('Befejezett')
    expect(wrapper.text()).toContain('2')
  })

  it('clicking Csoportkör filter button sets stageFilter=group', async () => {
    const { wrapper, matchesStore } = await mountView()
    const buttons = wrapper.findAll('button')
    const groupBtn = buttons.find(b => b.text() === 'Csoportkör')
    expect(groupBtn).toBeDefined()
    await groupBtn?.trigger('click')
    expect(matchesStore.stageFilter).toBe('group')
  })

  it('clicking Összes button sets stageFilter to null', async () => {
    const { wrapper, matchesStore } = await mountView()
    matchesStore.stageFilter = 'group'
    const buttons = wrapper.findAll('button')
    const allBtn = buttons.find(b => b.text() === 'Összes')
    await allBtn?.trigger('click')
    expect(matchesStore.stageFilter).toBeNull()
  })

  it('error → error message displayed', async () => {
    mockMatchesList.mockRejectedValue(new Error('Hálózati hiba'))
    mockGroupsGroups.push(DEFAULT_GROUP_WITH_LEAGUE)
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Hálózati hiba')
  })

  it('empty list → informational text displayed', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.text()).toContain('Nincs megjeleníthető mérkőzés')
  })

  // ─── Prediction form ─────────────────────────────────────────────────────────

  it('scheduled match → prediction form visible (inputs, no save button)', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="input-away"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(false)
  })

  it('finished match → section open by default, teams visible', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.text()).toContain('Spain')
  })

  it('finished match → clicking finished-section-toggle collapses and hides teams', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    // section is open by default
    expect(wrapper.text()).toContain('Spain')
    await wrapper.find('[data-testid="finished-section-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).not.toContain('Spain')
  })

  it('finished match → finished-section-toggle button is visible', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.find('[data-testid="finished-section-toggle"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Lejátszott meccsek')
  })

  it('finished match → toggle shows day count in header', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    const toggleText = wrapper.find('[data-testid="finished-section-toggle"]').text()
    expect(toggleText).toContain('1 nap')
  })

  it('finished section header stacks on mobile, single row on desktop (UX-025)', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    const toggle = wrapper.find('[data-testid="finished-section-toggle"]')
    const headerRow = toggle.element.parentElement!
    expect(headerRow.className).toContain('flex-col')
    expect(headerRow.className).toContain('md:flex-row')
  })

  it('live match → date group not collapsed', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('Germany')
  })

  it('scheduled match → date group not collapsed', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(true)
  })

  it('existing prediction → inputs pre-filled', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED], [EXISTING_PREDICTION])
    const homeInput = wrapper.find('[data-testid="input-home"]')
    const awayInput = wrapper.find('[data-testid="input-away"]')
    expect((homeInput.element as HTMLInputElement).value).toBe('1')
    expect((awayInput.element as HTMLInputElement).value).toBe('0')
  })

  it('autosave triggers upsertPrediction after input', async () => {
    vi.useFakeTimers()
    const saved: Prediction = { ...EXISTING_PREDICTION, homeGoals: 2, awayGoals: 1 }
    mockPredictionsUpsert.mockResolvedValue(saved)
    const { wrapper, predictionsStore } = await mountView([MATCH_SCHEDULED])

    await wrapper.find('[data-testid="input-home"]').setValue('2')
    await wrapper.find('[data-testid="input-away"]').setValue('1')
    const upsertSpy = vi.spyOn(predictionsStore, 'upsertPrediction').mockResolvedValue()
    vi.advanceTimersByTime(2000)
    await flushPromises()

    expect(upsertSpy).toHaveBeenCalledWith({
      matchId: 'match-sched',
      homeGoals: 2,
      awayGoals: 1,
      outcomeAfterDraw: null,
      scorerPickPlayerId: null,
    })
    vi.useRealTimers()
  })

  it('saveStatus=saved → Tipp elmentve feedback visible', async () => {
    const { wrapper, predictionsStore } = await mountView([MATCH_SCHEDULED])
    predictionsStore.saveStatus = { 'match-sched': 'saved' }
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="save-success"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Tipp elmentve!')
  })

  it('saveStatus=saving → inputs disabled', async () => {
    const { wrapper, predictionsStore } = await mountView([MATCH_SCHEDULED])
    predictionsStore.saveStatus = { 'match-sched': 'saving' }
    await wrapper.vm.$nextTick()
    const homeInput = wrapper.find('[data-testid="input-home"]')
    expect((homeInput.element as HTMLInputElement).disabled).toBe(true)
  })

  // ─── UX-014: Day navigation ──────────────────────────────────────────────────

  it('far future match → visible via day navigation (first upcoming day shown)', async () => {
    const { wrapper } = await mountView([MATCH_FAR_FUTURE])
    expect(wrapper.text()).toContain('Portugal')
  })

  it('within-7-days match → visible by default', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(true)
  })

  it('day navigator buttons render for upcoming section', async () => {
    const { wrapper } = await mountView([MATCH_FAR_FUTURE])
    expect(wrapper.find('[data-testid="day-nav-prev"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="day-nav-next"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="day-nav-all"]').exists()).toBe(true)
  })

  it('live match is always visible regardless of date', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('Germany')
  })

  // ─── League filter ───────────────────────────────────────────────────────────

  it('league select visible when >1 user-group league', async () => {
    mockGroupsGroups.push(
      { id: 'g1', name: 'A', description: null, inviteCode: 'X', inviteActive: true, createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l1', name: 'World Cup 2026', shortName: 'WC26' }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as import('@/types/index').Group,
      { id: 'g2', name: 'B', description: null, inviteCode: 'Y', inviteActive: true, createdBy: 'u1', memberCount: 3, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l2', name: 'Euro 2026', shortName: 'EU26' }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as import('@/types/index').Group,
    )
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="league-filter"]').exists()).toBe(true)
  })

  it('league select hidden when ≤1 user-group league', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="league-filter"]').exists()).toBe(false)
  })

  it('selecting a league sets matchesStore.leagueFilter', async () => {
    mockGroupsGroups.push(
      { id: 'g1', name: 'A', description: null, inviteCode: 'X', inviteActive: true, createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l1', name: 'World Cup 2026', shortName: 'WC26' }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as import('@/types/index').Group,
      { id: 'g2', name: 'B', description: null, inviteCode: 'Y', inviteActive: true, createdBy: 'u1', memberCount: 3, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l2', name: 'Euro 2026', shortName: 'EU26' }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as import('@/types/index').Group,
    )
    const { wrapper, matchesStore } = await mountView([MATCH_SCHEDULED])
    const select = wrapper.find('[data-testid="league-filter"]')
    await select.setValue('l2')
    expect(matchesStore.leagueFilter).toBe('l2')
  })

  it('selecting "Összes liga" resets leagueFilter to null', async () => {
    mockGroupsGroups.push(
      { id: 'g1', name: 'A', description: null, inviteCode: 'X', inviteActive: true, createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l1', name: 'World Cup 2026', shortName: 'WC26' }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as import('@/types/index').Group,
      { id: 'g2', name: 'B', description: null, inviteCode: 'Y', inviteActive: true, createdBy: 'u1', memberCount: 3, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l2', name: 'Euro 2026', shortName: 'EU26' }, createdAt: '2026-01-01T00:00:00.000Z' } as unknown as import('@/types/index').Group,
    )
    const { wrapper, matchesStore } = await mountView([MATCH_SCHEDULED])
    matchesStore.leagueFilter = 'l1'
    const select = wrapper.find('[data-testid="league-filter"]')
    await select.setValue('')
    expect(matchesStore.leagueFilter).toBeNull()
  })

  // ─── Default league filter (US-611) ──────────────────────────────────────────

  it('no groups → empty state CTA visible', async () => {
    // Override mountView default by clearing groups in a custom mount
    mockMatchesList.mockResolvedValue([])
    mockPredictionsMine.mockResolvedValue([])
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="no-group-league-cta"]').exists()).toBe(true)
  })

  it('1 group with 1 league → leagueFilter auto-set to that league', async () => {
    mockGroupsGroups.push({
      id: 'g1', name: 'Test', description: null, inviteCode: 'X', inviteActive: true,
      createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false,
      league: { id: 'l1', name: 'World Cup 2026', shortName: 'WC26' },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const { matchesStore } = await mountView([MATCH_SCHEDULED])
    expect(matchesStore.leagueFilter).toBe('l1')
  })

  it('2 groups with same league → leagueFilter auto-set to that league', async () => {
    mockGroupsGroups.push(
      { id: 'g1', name: 'A', description: null, inviteCode: 'X', inviteActive: true, createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l1', name: 'WC', shortName: 'WC' }, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'g2', name: 'B', description: null, inviteCode: 'Y', inviteActive: true, createdBy: 'u1', memberCount: 3, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l1', name: 'WC', shortName: 'WC' }, createdAt: '2026-01-01T00:00:00.000Z' },
    )
    const { matchesStore } = await mountView([MATCH_SCHEDULED])
    expect(matchesStore.leagueFilter).toBe('l1')
  })

  it('2 groups with different leagues → leagueFilter stays null', async () => {
    mockGroupsGroups.push(
      { id: 'g1', name: 'A', description: null, inviteCode: 'X', inviteActive: true, createdBy: 'u1', memberCount: 2, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l1', name: 'WC', shortName: 'WC' }, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'g2', name: 'B', description: null, inviteCode: 'Y', inviteActive: true, createdBy: 'u1', memberCount: 3, isAdmin: false, userRank: null, favoriteTeamDoublePoints: false, league: { id: 'l2', name: 'Euro', shortName: 'EU' }, createdAt: '2026-01-01T00:00:00.000Z' },
    )
    const { matchesStore } = await mountView([MATCH_SCHEDULED])
    expect(matchesStore.leagueFilter).toBeNull()
  })

  // ─── UX-023: favorite banner respects group memberships ───────────────────────

  it('favorite banner hidden when user is not in any group', async () => {
    mockGroupsGroups.length = 0
    mockLeaguesList.mockResolvedValue([
      { id: 'l-default', name: 'Default League', shortName: 'DEF', createdAt: '', updatedAt: '' },
      { id: 'l-extra', name: 'Other League', shortName: 'OTH', createdAt: '', updatedAt: '' },
    ])
    mockGetLeagueFavorites.mockResolvedValue([])
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Állítsd be kedvenc csapatodat')
  })

  it('favorite banner shown when user has a group league without a favorite', async () => {
    mockGroupsGroups.push(DEFAULT_GROUP_WITH_LEAGUE)
    mockLeaguesList.mockResolvedValue([
      { id: 'l-default', name: 'Default League', shortName: 'DEF', createdAt: '', updatedAt: '' },
    ])
    mockGetLeagueFavorites.mockResolvedValue([])
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.text()).toContain('Állítsd be kedvenc csapatodat')
  })

  it('favorite banner hidden when only non-group leagues lack a favorite', async () => {
    mockGroupsGroups.push(DEFAULT_GROUP_WITH_LEAGUE)
    mockLeaguesList.mockResolvedValue([
      { id: 'l-default', name: 'Default League', shortName: 'DEF', createdAt: '', updatedAt: '' },
      { id: 'l-other', name: 'Other League', shortName: 'OTH', createdAt: '', updatedAt: '' },
    ])
    mockGetLeagueFavorites.mockResolvedValue([
      { id: 'fav-1', userId: 'u1', leagueId: 'l-default', teamId: 't1', setAt: '', isLocked: false },
    ])
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.text()).not.toContain('Állítsd be kedvenc csapatodat')
  })

  // ─── SCORER-002: scorer pick row ─────────────────────────────────────────

  it('scorer pick row renders for tippable match', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="scorer-pick-row"]').exists()).toBe(true)
  })

  it('scorer-only change without goals does NOT trigger upsert (autosave guard)', async () => {
    vi.useFakeTimers()
    const { wrapper, predictionsStore } = await mountView([MATCH_SCHEDULED])
    const upsertSpy = vi.spyOn(predictionsStore, 'upsertPrediction').mockResolvedValue()

    // emulate scorer-pick selection without goals filled in
    const view = wrapper.vm as unknown as { onScorerPickChange: (id: string, p: string) => void }
    view.onScorerPickChange('match-sched', 'player-x')
    vi.advanceTimersByTime(2000)
    await flushPromises()

    expect(upsertSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('scorer pick + goals filled → upsert with scorerPickPlayerId', async () => {
    vi.useFakeTimers()
    const saved: Prediction = { ...EXISTING_PREDICTION, homeGoals: 2, awayGoals: 1, scorerPickPlayerId: 'player-x' }
    mockPredictionsUpsert.mockResolvedValue(saved)
    const { wrapper, predictionsStore } = await mountView([MATCH_SCHEDULED])
    const upsertSpy = vi.spyOn(predictionsStore, 'upsertPrediction').mockResolvedValue()

    await wrapper.find('[data-testid="input-home"]').setValue('2')
    await wrapper.find('[data-testid="input-away"]').setValue('1')
    const view = wrapper.vm as unknown as { onScorerPickChange: (id: string, p: string) => void }
    view.onScorerPickChange('match-sched', 'player-x')
    vi.advanceTimersByTime(2000)
    await flushPromises()

    expect(upsertSpy).toHaveBeenCalledWith({
      matchId: 'match-sched',
      homeGoals: 2,
      awayGoals: 1,
      outcomeAfterDraw: null,
      scorerPickPlayerId: 'player-x',
    })
    vi.useRealTimers()
  })

  // ─── UX-016: favorite team indicator on match cards ───────────────────────────

  describe('UX-016 favorite indicator', () => {
    it('does not render the indicator when no group-mate favors either team', async () => {
      mockFavoritesSummary.mockResolvedValue({ members: [] })
      const { wrapper } = await mountView([MATCH_SCHEDULED])
      expect(wrapper.find('[data-testid="favorite-indicator"]').exists()).toBe(false)
    })

    it('renders other group-mates names when 1-3 favor a participating team (no own favorite)', async () => {
      mockFavoritesSummary.mockResolvedValue({
        members: [
          { userId: 'alice', displayName: 'Alice', teamId: MATCH_SCHEDULED.homeTeam.id },
          { userId: 'bob', displayName: 'Bob', teamId: MATCH_SCHEDULED.awayTeam.id },
        ],
      })
      const { wrapper } = await mountView([MATCH_SCHEDULED])
      const indicator = wrapper.find('[data-testid="favorite-indicator"]')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('Alice')
      expect(indicator.text()).toContain('Bob')
      // no own favorite → no yellow ring on the card
      const card = indicator.element.closest('.bg-white')
      expect(card?.className ?? '').not.toContain('ring-yellow-300')
    })

    it('shows "{count} tag" summary text when 4+ group-mates favor', async () => {
      mockFavoritesSummary.mockResolvedValue({
        members: [
          { userId: 'a', displayName: 'A', teamId: MATCH_SCHEDULED.homeTeam.id },
          { userId: 'b', displayName: 'B', teamId: MATCH_SCHEDULED.homeTeam.id },
          { userId: 'c', displayName: 'C', teamId: MATCH_SCHEDULED.awayTeam.id },
          { userId: 'd', displayName: 'D', teamId: MATCH_SCHEDULED.awayTeam.id },
        ],
      })
      const { wrapper } = await mountView([MATCH_SCHEDULED])
      const indicator = wrapper.find('[data-testid="favorite-indicator"]')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('4 tag')
    })

    it('highlights own favorite (yellow ring + bold name) when current user favors a participating team', async () => {
      mockFavoritesSummary.mockResolvedValue({
        members: [
          { userId: 'db-user-uuid-001', displayName: 'Self', teamId: MATCH_SCHEDULED.homeTeam.id },
          { userId: 'alice', displayName: 'Alice', teamId: MATCH_SCHEDULED.awayTeam.id },
        ],
      })
      const { wrapper } = await mountView([MATCH_SCHEDULED])
      const indicator = wrapper.find('[data-testid="favorite-indicator"]')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('Self')
      expect(indicator.text()).toContain('Alice')

      const card = indicator.element.closest('.bg-white') as HTMLElement | null
      expect(card?.className ?? '').toContain('ring-yellow-300')

      // own name uses font-semibold
      const selfSpan = indicator.findAll('span').find(s => s.text() === 'Self')
      expect(selfSpan?.classes()).toContain('font-semibold')
    })
  })

})
