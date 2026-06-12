import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MatchDetailView from '@/views/MatchDetailView.vue'
import { useMatchesStore } from '@/stores/matches.store'
import { usePredictionsStore } from '@/stores/predictions.store'
import type { Match, Prediction } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockMatchesList, mockPredictionsMine, mockPredictionsUpsert, mockPredictionsForMatch, mockFavoritesSummary } = vi.hoisted(() => ({
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockPredictionsMine: vi.fn().mockResolvedValue([]),
  mockPredictionsUpsert: vi.fn().mockResolvedValue(undefined),
  mockPredictionsForMatch: vi.fn().mockResolvedValue([]),
  mockFavoritesSummary: vi.fn().mockResolvedValue({ members: [] }),
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
    predictions: { mine: mockPredictionsMine, upsert: mockPredictionsUpsert, forMatch: mockPredictionsForMatch },
    players: { list: vi.fn().mockResolvedValue([]) },
    leagues: { favoritesSummary: mockFavoritesSummary },
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

const MATCH_FINISHED: Match = {
  id: 'match-finished',
  homeTeam: { id: 'ht1', name: 'Spain', shortCode: 'ESP', flagUrl: null, teamType: 'national' as const, countryCode: 'es', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at1', name: 'Italy', shortCode: 'ITA', flagUrl: null, teamType: 'national' as const, countryCode: 'it', marketValueEur: null, transfermarktId: null },
  venue: { name: 'Estadio Nacional', city: 'Madrid', country: null, imageUrl: null },
  league: null,
  stage: 'group',
  groupName: 'B',
  matchNumber: 2,
  scheduledAt: '2026-06-11T18:00:00.000Z',
  status: 'finished',
  result: { homeGoals: 2, awayGoals: 1 },
}

const MATCH_SCHEDULED: Match = {
  id: 'match-sched',
  homeTeam: { id: 'ht2', name: 'Brazil', shortCode: 'BRA', flagUrl: null, teamType: 'national' as const, countryCode: 'br', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at2', name: 'Argentina', shortCode: 'ARG', flagUrl: null, teamType: 'national' as const, countryCode: 'ar', marketValueEur: null, transfermarktId: null },
  venue: { name: 'Maracanã', city: 'Rio de Janeiro', country: 'Brazil', imageUrl: null },
  league: null,
  stage: 'final',
  groupName: null,
  matchNumber: 64,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  status: 'scheduled',
  result: null,
}

const MATCH_LIVE: Match = {
  id: 'match-live',
  homeTeam: { id: 'ht3', name: 'France', shortCode: 'FRA', flagUrl: null, teamType: 'national' as const, countryCode: 'fr', marketValueEur: null, transfermarktId: null },
  awayTeam: { id: 'at3', name: 'Germany', shortCode: 'GER', flagUrl: null, teamType: 'national' as const, countryCode: 'de', marketValueEur: null, transfermarktId: null },
  venue: { name: 'Stade de France', city: 'Paris', country: null, imageUrl: null },
  league: null,
  stage: 'group',
  groupName: 'A',
  matchNumber: 5,
  scheduledAt: '2026-06-11T18:00:00.000Z',
  status: 'live',
  result: null,
}

const PREDICTION_FOR_FINISHED: Prediction = {
  id: 'pred-1',
  userId: 'db-user-uuid-001',
  matchId: 'match-finished',
  homeGoals: 1,
  awayGoals: 1,
  outcomeAfterDraw: null,
  pointsGlobal: 3,
  pointsResult: 3,
  scorerPickPlayerId: null,
  scorerPlayerNameSnapshot: null,
  scorerBonusPoints: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

function buildRouter(_matchId?: string) {
  return buildTestRouter({ '/app/matches/:id': MatchDetailView })
}

async function mountView(
  matchId: string,
  preloadedMatches: Match[] = [],
  apiMatches: Match[] = [],
  apiPredictions: Prediction[] = [],
) {
  mockMatchesList.mockResolvedValue(apiMatches)
  mockPredictionsMine.mockResolvedValue(apiPredictions)

  const pinia = createPinia()
  setActivePinia(pinia)

  // pre-populate store if desired (simulate already-loaded matches)
  if (preloadedMatches.length > 0) {
    const matchesStore = useMatchesStore()
    matchesStore.matches = [...preloadedMatches]
  }

  const router = buildRouter(matchId)
  await router.push(`/app/matches/${matchId}`)
  await router.isReady()

  const wrapper = mount(MatchDetailView, {
    global: { plugins: [pinia, router] },
  })
  await flushPromises()
  return { wrapper, matchesStore: useMatchesStore(), predictionsStore: usePredictionsStore() }
}

describe('MatchDetailView', () => {
  beforeEach(() => {
    mockMatchesList.mockReset()
    mockMatchesList.mockResolvedValue([])
    mockPredictionsMine.mockReset()
    mockPredictionsMine.mockResolvedValue([])
    mockPredictionsUpsert.mockReset()
    mockPredictionsForMatch.mockReset()
    mockPredictionsForMatch.mockResolvedValue([])
    mockFavoritesSummary.mockReset()
    mockFavoritesSummary.mockResolvedValue({ members: [] })
    setActivePinia(createPinia())
  })

  it('spinner visible during loading', async () => {
    let resolveList!: (v: Match[]) => void
    mockMatchesList.mockReturnValue(new Promise<Match[]>(res => { resolveList = res }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter('match-finished')
    await router.push('/app/matches/match-finished')
    await router.isReady()
    const wrapper = mount(MatchDetailView, { global: { plugins: [pinia, router] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolveList([])
  })

  it('match data displayed (teams, venue, stage)', async () => {
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
    expect(wrapper.text()).toContain('Spain')
    expect(wrapper.text()).toContain('Italy')
    expect(wrapper.text()).toContain('Estadio Nacional')
    expect(wrapper.text()).toContain('Madrid')
    expect(wrapper.text()).toContain('Csoportkör')
  })

  it('UX-031: venue with country → name, city, country displayed', async () => {
    const { wrapper } = await mountView('match-sched', [MATCH_SCHEDULED])
    const loc = wrapper.find('[data-testid="venue-location"]')
    expect(loc.exists()).toBe(true)
    expect(loc.text()).toBe('Maracanã, Rio de Janeiro, Brazil')
  })

  it('UX-031: venue with country=null → only name + city displayed', async () => {
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
    const loc = wrapper.find('[data-testid="venue-location"]')
    expect(loc.exists()).toBe(true)
    expect(loc.text()).toBe('Estadio Nacional, Madrid')
  })

  it('finished match → result score visible', async () => {
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('Befejezett')
  })

  it('finished match + prediction → tip and points displayed', async () => {
    const { wrapper } = await mountView(
      'match-finished',
      [MATCH_FINISHED],
      [],
      [PREDICTION_FOR_FINISHED],
    )
    expect(wrapper.text()).toContain('Az én tippem')
    expect(wrapper.text()).toContain('3')
  })

  it('finished match + no prediction → "Nem adtál tippet" message', async () => {
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED], [], [])
    expect(wrapper.text()).toContain('Nem adtál tippet')
  })

  it('scheduled match → tip form visible, no save button', async () => {
    const { wrapper } = await mountView('match-sched', [MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="input-away"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(false)
  })

  it('SCORER-002: scheduled match → scorer pick row visible', async () => {
    const { wrapper } = await mountView('match-sched', [MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="scorer-pick-row"]').exists()).toBe(true)
  })

  it('SCORER-002: knockout stage → info icon (tooltip) renders', async () => {
    const { wrapper } = await mountView('match-sched', [MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="scorer-knockout-info"]').exists()).toBe(true)
  })

  it('SCORER-002: group stage → no info icon', async () => {
    const GROUP_MATCH: Match = { ...MATCH_SCHEDULED, stage: 'group' as const, groupName: 'A' }
    const { wrapper } = await mountView('match-sched', [GROUP_MATCH])
    expect(wrapper.find('[data-testid="scorer-knockout-info"]').exists()).toBe(false)
  })

  it('"Vissza" link points to /matches', async () => {
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
    const backLink = wrapper.find('[data-testid="back-link"]')
    expect(backLink.exists()).toBe(true)
    expect(backLink.attributes('href')).toBe('/app/matches')
  })

  // ─── Others' predictions ─────────────────────────────────────────────────

  it('finished match → others predictions list rendered', async () => {
    mockPredictionsForMatch.mockResolvedValue([
      { userId: 'u1', displayName: 'Alice', homeGoals: 2, awayGoals: 1, pointsGlobal: 3 },
      { userId: 'u2', displayName: 'Bob', homeGoals: 0, awayGoals: 0, pointsGlobal: 0 },
    ])
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED], [], [])
    expect(wrapper.find('[data-testid="match-predictions-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('finished match + empty predictions → list not rendered', async () => {
    mockPredictionsForMatch.mockResolvedValue([])
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED], [], [])
    expect(wrapper.find('[data-testid="match-predictions-list"]').exists()).toBe(false)
  })

  it('scheduled match → forMatch not called', async () => {
    await mountView('match-sched', [MATCH_SCHEDULED])
    expect(mockPredictionsForMatch).not.toHaveBeenCalled()
  })

  it('live match → others predictions list rendered', async () => {
    mockPredictionsForMatch.mockResolvedValue([
      { userId: 'u1', displayName: 'Alice', homeGoals: 1, awayGoals: 0, pointsGlobal: null },
    ])
    const { wrapper } = await mountView('match-live', [MATCH_LIVE], [], [])
    expect(wrapper.find('[data-testid="match-predictions-list"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Alice')
  })

  // ─── UX-016: favorite indicator ─────────────────────────────────────────────
  describe('UX-016 favorite indicator', () => {
    const MATCH_WITH_LEAGUE: Match = {
      ...MATCH_SCHEDULED,
      league: { id: 'league-wc', name: 'World Cup', shortName: 'WC' },
    }

    it('does not render the indicator when nobody favors either team', async () => {
      mockFavoritesSummary.mockResolvedValue({ members: [] })
      const { wrapper } = await mountView('match-sched', [MATCH_WITH_LEAGUE])
      expect(wrapper.find('[data-testid="favorite-indicator"]').exists()).toBe(false)
    })

    it('renders names of group-mates and adds yellow ring when own favorite plays', async () => {
      mockFavoritesSummary.mockResolvedValue({
        members: [
          { userId: 'db-user-uuid-001', displayName: 'Self', teamId: MATCH_WITH_LEAGUE.homeTeam.id },
          { userId: 'alice', displayName: 'Alice', teamId: MATCH_WITH_LEAGUE.awayTeam.id },
        ],
      })
      const { wrapper } = await mountView('match-sched', [MATCH_WITH_LEAGUE])
      const indicator = wrapper.find('[data-testid="favorite-indicator"]')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('Self')
      expect(indicator.text()).toContain('Alice')

      // scoreboard card has the yellow ring class
      const card = wrapper.find('.bg-white.rounded-lg.shadow-sm.border.border-gray-100.p-6')
      expect(card.classes().join(' ')).toContain('ring-yellow-300')
    })

    it('renders "{count} tag" summary when 4+ group-mates favor', async () => {
      mockFavoritesSummary.mockResolvedValue({
        members: [
          { userId: 'a', displayName: 'A', teamId: MATCH_WITH_LEAGUE.homeTeam.id },
          { userId: 'b', displayName: 'B', teamId: MATCH_WITH_LEAGUE.homeTeam.id },
          { userId: 'c', displayName: 'C', teamId: MATCH_WITH_LEAGUE.awayTeam.id },
          { userId: 'd', displayName: 'D', teamId: MATCH_WITH_LEAGUE.awayTeam.id },
        ],
      })
      const { wrapper } = await mountView('match-sched', [MATCH_WITH_LEAGUE])
      const indicator = wrapper.find('[data-testid="favorite-indicator"]')
      expect(indicator.exists()).toBe(true)
      expect(indicator.text()).toContain('4 tag')
    })
  })

  // ─── UX-030: Transfermarkt market values ─────────────────────────────────
  describe('UX-030 market values block', () => {
    const MATCH_WITH_VALUES: Match = {
      ...MATCH_SCHEDULED,
      homeTeam: { ...MATCH_SCHEDULED.homeTeam, marketValueEur: 300_000_000, transfermarktId: 100 },
      awayTeam: { ...MATCH_SCHEDULED.awayTeam, marketValueEur: 700_000_000, transfermarktId: 200 },
    }

    it('renders market values block when market values present (insights section + market-values-section)', async () => {
      const { wrapper } = await mountView('match-sched', [MATCH_WITH_VALUES])
      expect(wrapper.find('[data-testid="insights-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="market-values-section"]').exists()).toBe(true)
    })

    it('omits market values block entirely when both values are null', async () => {
      const { wrapper } = await mountView('match-sched', [MATCH_SCHEDULED])
      expect(wrapper.find('[data-testid="market-values-section"]').exists()).toBe(false)
    })

    it('reveal-gate covers both odds + market values blocks (single button)', async () => {
      const { wrapper } = await mountView('match-sched', [MATCH_WITH_VALUES])
      // Only one reveal button — covers everything
      const buttons = wrapper.findAll('[data-testid="insights-reveal-btn"]')
      expect(buttons).toHaveLength(1)
      // market values inside the (blurred) wrapper
      expect(wrapper.find('[data-testid="market-values-section"]').exists()).toBe(true)
    })
  })
})
