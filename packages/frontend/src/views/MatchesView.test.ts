import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import MatchesView from '@/views/MatchesView.vue'
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

// scheduled match with future kickoff
const MATCH_SCHEDULED: Match = {
  id: 'match-sched',
  homeTeam: { id: 'ht3', name: 'Brazil', shortCode: 'BRA', flagUrl: null },
  awayTeam: { id: 'at3', name: 'Argentina', shortCode: 'ARG', flagUrl: null },
  venue: { name: 'Stadium', city: 'Sao Paulo' },
  stage: 'final',
  groupName: null,
  matchNumber: 64,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // tomorrow
  status: 'scheduled',
  result: null,
}

const MATCH_LIVE: Match = {
  id: 'match-live',
  homeTeam: { id: 'ht1', name: 'Germany', shortCode: 'GER', flagUrl: null },
  awayTeam: { id: 'at1', name: 'France', shortCode: 'FRA', flagUrl: null },
  venue: { name: 'Arena', city: 'Munich' },
  stage: 'group',
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: '2026-06-11T15:00:00.000Z',
  status: 'live',
  result: null,
}

const MATCH_FINISHED: Match = {
  id: 'match-finished',
  homeTeam: { id: 'ht2', name: 'Spain', shortCode: 'ESP', flagUrl: null },
  awayTeam: { id: 'at2', name: 'Italy', shortCode: 'ITA', flagUrl: null },
  venue: null,
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
  pointsGlobal: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/matches', component: MatchesView },
    ],
  })
}

async function mountView(apiMatches: Match[] = [], apiPredictions: Prediction[] = []) {
  mockMatchesList.mockResolvedValue(apiMatches)
  mockPredictionsMine.mockResolvedValue(apiPredictions)
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
    setActivePinia(createPinia())
  })

  // ─── Loading and rendering ────────────────────────────────────────────────────

  it('spinner visible during loading', async () => {
    let resolveList!: (v: Match[]) => void
    mockMatchesList.mockReturnValue(new Promise<Match[]>(res => { resolveList = res }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolveList([])
  })

  it('matches loaded → date groups rendered', async () => {
    const { wrapper } = await mountView([MATCH_LIVE, MATCH_FINISHED, MATCH_SCHEDULED])
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('France')
    expect(wrapper.text()).toContain('Brazil')
  })

  it('live match → ÉLŐBEN text visible', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('ÉLŐBEN')
  })

  it('finished match → result scores and teams visible', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
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

  it('finished match → prediction form hidden, no tip shown', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nem tippeltél erre a meccsre')
  })

  it('live match → prediction form hidden', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Nem tippeltél erre a meccsre')
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

})
