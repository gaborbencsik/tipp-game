import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import MatchDetailView from '@/views/MatchDetailView.vue'
import { useMatchesStore } from '@/stores/matches.store'
import { usePredictionsStore } from '@/stores/predictions.store'
import type { Match, Prediction } from '@/types/index'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockMatchesList, mockPredictionsMine, mockPredictionsUpsert } = vi.hoisted(() => ({
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockPredictionsMine: vi.fn().mockResolvedValue([]),
  mockPredictionsUpsert: vi.fn().mockResolvedValue(undefined),
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
  },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: 'db-user-uuid-001', role: 'user' },
      isAuthenticated: () => true,
      logout: vi.fn(),
    }),
  }
})

const MATCH_FINISHED: Match = {
  id: 'match-finished',
  homeTeam: { id: 'ht1', name: 'Spain', shortCode: 'ESP', flagUrl: null },
  awayTeam: { id: 'at1', name: 'Italy', shortCode: 'ITA', flagUrl: null },
  venue: { name: 'Estadio Nacional', city: 'Madrid' },
  stage: 'group',
  groupName: 'B',
  matchNumber: 2,
  scheduledAt: '2026-06-11T18:00:00.000Z',
  status: 'finished',
  result: { homeGoals: 2, awayGoals: 1 },
}

const MATCH_SCHEDULED: Match = {
  id: 'match-sched',
  homeTeam: { id: 'ht2', name: 'Brazil', shortCode: 'BRA', flagUrl: null },
  awayTeam: { id: 'at2', name: 'Argentina', shortCode: 'ARG', flagUrl: null },
  venue: { name: 'Maracanã', city: 'Rio de Janeiro' },
  stage: 'final',
  groupName: null,
  matchNumber: 64,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  status: 'scheduled',
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
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

function buildRouter(_matchId?: string) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/matches', component: { template: '<div>Matches</div>' } },
      { path: '/matches/:id', component: MatchDetailView },
    ],
  })
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
  await router.push(`/matches/${matchId}`)
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
    setActivePinia(createPinia())
  })

  it('spinner visible during loading', async () => {
    let resolveList!: (v: Match[]) => void
    mockMatchesList.mockReturnValue(new Promise<Match[]>(res => { resolveList = res }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = buildRouter('match-finished')
    await router.push('/matches/match-finished')
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

  it('"Vissza" link points to /matches', async () => {
    const { wrapper } = await mountView('match-finished', [MATCH_FINISHED])
    const backLink = wrapper.find('[data-testid="back-link"]')
    expect(backLink.exists()).toBe(true)
    expect(backLink.attributes('href')).toBe('/matches')
  })
})
