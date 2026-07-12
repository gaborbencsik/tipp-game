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

const { mockMatchesList, mockMatchesOdds, mockPredictionsMine, mockPredictionsUpsert, mockPredictionsForMatch, mockFavoritesSummary, mockScoringConfigDefault } = vi.hoisted(() => ({
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockMatchesOdds: vi.fn().mockResolvedValue({ odds: null, revealed: false }),
  mockPredictionsMine: vi.fn().mockResolvedValue([]),
  mockPredictionsUpsert: vi.fn().mockResolvedValue(undefined),
  mockPredictionsForMatch: vi.fn().mockResolvedValue([]),
  mockFavoritesSummary: vi.fn().mockResolvedValue({ members: [] }),
  mockScoringConfigDefault: vi.fn().mockResolvedValue({
    id: 'cfg', name: 'default',
    correctOutcomePoints: 1, exactBonusPoints: 1, extraTimeBonusPoints: 1,
    isGlobalDefault: true, createdAt: '', updatedAt: '',
  }),
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
    matches: { list: mockMatchesList, odds: mockMatchesOdds },
    predictions: { mine: mockPredictionsMine, upsert: mockPredictionsUpsert, forMatch: mockPredictionsForMatch },
    players: { list: vi.fn().mockResolvedValue([]) },
    leagues: { favoritesSummary: mockFavoritesSummary },
    scoringConfig: { default: mockScoringConfigDefault },
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
    mockMatchesOdds.mockReset()
    mockMatchesOdds.mockResolvedValue({ odds: null, revealed: false })
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

  // ─── UX-031: Polymarket odds hidden after match finished ──────────────────
  describe('UX-031 odds hidden when match finished', () => {
    const SAMPLE_ODDS = {
      odds: {
        homeTeam: { name: 'Spain', odds: 0.55 },
        draw: 0.25,
        awayTeam: { name: 'Italy', odds: 0.20 },
        oneDayChange: { home: 0, draw: 0, away: 0 },
        volume: 12000,
        avgVolume: 240,
        competitive: 0.8,
        contextDescription: null,
        source: 'polymarket',
        sourceUrl: null,
        updatedAt: '2026-06-15T10:00:00Z',
      },
      revealed: true,
    }

    it('finished match → MatchOddsBar NOT rendered even if odds present', async () => {
      mockMatchesOdds.mockResolvedValue(SAMPLE_ODDS)
      const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
      expect(wrapper.find('[data-testid="match-odds-bar"]').exists()).toBe(false)
    })

    it('scheduled match → MatchOddsBar rendered when odds present', async () => {
      mockMatchesOdds.mockResolvedValue(SAMPLE_ODDS)
      const { wrapper } = await mountView('match-sched', [MATCH_SCHEDULED])
      expect(wrapper.find('[data-testid="match-odds-bar"]').exists()).toBe(true)
    })

    it('live match → MatchOddsBar rendered when odds present', async () => {
      mockMatchesOdds.mockResolvedValue(SAMPLE_ODDS)
      const { wrapper } = await mountView('match-live', [MATCH_LIVE])
      expect(wrapper.find('[data-testid="match-odds-bar"]').exists()).toBe(true)
    })

    it('finished match with odds + no market values → insights section hidden entirely', async () => {
      mockMatchesOdds.mockResolvedValue(SAMPLE_ODDS)
      const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
      expect(wrapper.find('[data-testid="insights-section"]').exists()).toBe(false)
    })
  })

  // ─── UX-043: outcomeAfterDraw badge in the locked-tip block ───────────────
  describe('UX-043 outcomeAfterDraw badge (own tip)', () => {
    const KNOCKOUT_DRAW_MATCH: Match = {
      id: 'match-ko-draw',
      homeTeam: { id: 'ht-hu', name: 'Magyarország', shortCode: 'HUN', flagUrl: null, teamType: 'national', countryCode: 'hu', marketValueEur: null, transfermarktId: null },
      awayTeam: { id: 'at-rs', name: 'Szerbia', shortCode: 'SRB', flagUrl: null, teamType: 'national', countryCode: 'rs', marketValueEur: null, transfermarktId: null },
      venue: null, league: null,
      stage: 'round_of_16', groupName: null, matchNumber: 50,
      scheduledAt: '2026-06-29T18:00:00.000Z',
      status: 'finished',
      result: { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
    }
    const KNOCKOUT_DECISIVE_MATCH: Match = {
      ...KNOCKOUT_DRAW_MATCH,
      id: 'match-ko-decisive',
      result: { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null },
    }

    function predictionFor(matchId: string, outcome: 'penalties_home' | 'penalties_away' | null, pointsResult = 0): Prediction {
      return {
        id: `pred-${matchId}`,
        userId: 'db-user-uuid-001',
        matchId,
        homeGoals: 1,
        awayGoals: 1,
        outcomeAfterDraw: outcome,
        pointsGlobal: pointsResult,
        pointsResult,
        scorerPickPlayerId: null,
        scorerPlayerNameSnapshot: null,
        scorerBonusPoints: null,
        createdAt: '2026-06-20T10:00:00.000Z',
        updatedAt: '2026-06-20T10:00:00.000Z',
      }
    }

    it('knockout draw + correct outcome tip → badge shows the advancing team with +1 bonus', async () => {
      const { wrapper } = await mountView('match-ko-draw', [KNOCKOUT_DRAW_MATCH], [], [predictionFor('match-ko-draw', 'penalties_home', 2)])
      const badge = wrapper.find('[data-testid="own-outcome-after-draw"] [data-testid="outcome-after-draw-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.attributes('data-status')).toBe('correct')
      expect(badge.text()).toContain('Magyarország')
      expect(badge.text()).toContain('+1')
    })

    it('knockout draw + incorrect outcome tip → badge marked "incorrect" with strikethrough team', async () => {
      const { wrapper } = await mountView('match-ko-draw', [KNOCKOUT_DRAW_MATCH], [], [predictionFor('match-ko-draw', 'penalties_away', 1)])
      const badge = wrapper.find('[data-testid="own-outcome-after-draw"] [data-testid="outcome-after-draw-badge"]')
      expect(badge.attributes('data-status')).toBe('incorrect')
      expect(badge.text()).toContain('Szerbia')
    })

    it('knockout decisive result → badge marked "inactive" (was not a draw)', async () => {
      const { wrapper } = await mountView('match-ko-decisive', [KNOCKOUT_DECISIVE_MATCH], [], [predictionFor('match-ko-decisive', 'penalties_home', 1)])
      const badge = wrapper.find('[data-testid="own-outcome-after-draw"] [data-testid="outcome-after-draw-badge"]')
      expect(badge.attributes('data-status')).toBe('inactive')
    })

    it('group-stage match → no outcome badge in own tip', async () => {
      const groupPrediction: Prediction = {
        ...PREDICTION_FOR_FINISHED,
        outcomeAfterDraw: 'penalties_home',
      }
      const { wrapper } = await mountView('match-finished', [MATCH_FINISHED], [], [groupPrediction])
      expect(wrapper.find('[data-testid="own-outcome-after-draw"]').exists()).toBe(false)
    })
  })
})
