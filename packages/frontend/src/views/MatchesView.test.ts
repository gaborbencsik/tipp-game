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
      user: { id: 'db-user-uuid-001', role: 'user', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: () => true,
      logout: vi.fn(),
    }),
  }
})

// scheduled match with future kickoff (tomorrow = within 7 days)
const MATCH_SCHEDULED: Match = {
  id: 'match-sched',
  homeTeam: { id: 'ht3', name: 'Brazil', shortCode: 'BRA', flagUrl: null, teamType: 'national' as const, countryCode: 'br' },
  awayTeam: { id: 'at3', name: 'Argentina', shortCode: 'ARG', flagUrl: null, teamType: 'national' as const, countryCode: 'ar' },
  venue: { name: 'Stadium', city: 'Sao Paulo' },
  league: null,
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
  homeTeam: { id: 'ht5', name: 'Portugal', shortCode: 'POR', flagUrl: null, teamType: 'national' as const, countryCode: 'pt' },
  awayTeam: { id: 'at5', name: 'Belgium', shortCode: 'BEL', flagUrl: null, teamType: 'national' as const, countryCode: 'be' },
  venue: null,
  league: null,
  stage: 'group',
  groupName: 'C',
  matchNumber: 10,
  scheduledAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days from now
  status: 'scheduled',
  result: null,
}

const MATCH_LIVE: Match = {
  id: 'match-live',
  homeTeam: { id: 'ht1', name: 'Germany', shortCode: 'GER', flagUrl: null, teamType: 'national' as const, countryCode: 'de' },
  awayTeam: { id: 'at1', name: 'France', shortCode: 'FRA', flagUrl: null, teamType: 'national' as const, countryCode: 'fr' },
  venue: { name: 'Arena', city: 'Munich' },
  league: null,
  stage: 'group',
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: '2026-06-11T15:00:00.000Z',
  status: 'live',
  result: null,
}

const MATCH_FINISHED: Match = {
  id: 'match-finished',
  homeTeam: { id: 'ht2', name: 'Spain', shortCode: 'ESP', flagUrl: null, teamType: 'national' as const, countryCode: 'es' },
  awayTeam: { id: 'at2', name: 'Italy', shortCode: 'ITA', flagUrl: null, teamType: 'national' as const, countryCode: 'it' },
  venue: null,
  league: null,
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
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

function buildRouter() {
  return buildTestRouter({ '/app/matches': MatchesView })
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
    localStorage.clear()
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

  it('matches loaded → live and scheduled groups rendered, finished group hidden', async () => {
    // MATCH_FINISHED is on a different day from MATCH_LIVE so it forms its own all-finished group
    const finishedOnOwnDay: Match = {
      ...MATCH_FINISHED,
      scheduledAt: '2026-06-10T18:00:00.000Z',
    }
    const { wrapper } = await mountView([MATCH_LIVE, finishedOnOwnDay, MATCH_SCHEDULED])
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('France')
    expect(wrapper.text()).toContain('Brazil')
    // finished section is collapsed by default
    expect(wrapper.text()).not.toContain('Spain')
  })

  it('live match → ÉLŐBEN text visible', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('ÉLŐBEN')
  })

  it('finished match → result scores and teams visible after expanding section', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    // expand the finished section
    await wrapper.find('[data-testid="finished-section-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
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

  it('finished match → section collapsed by default, teams not visible', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Spain')
  })

  it('finished match → clicking finished-section-toggle expands and shows teams', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.text()).not.toContain('Spain')
    await wrapper.find('[data-testid="finished-section-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Spain')
  })

  it('finished match → finished-section-toggle button is visible', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.find('[data-testid="finished-section-toggle"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Lejátszott meccsek')
  })

  it('finished match → toggle shows day and match count in header', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    const toggleText = wrapper.find('[data-testid="finished-section-toggle"]').text()
    expect(toggleText).toContain('1 nap')
    expect(toggleText).toContain('1 mérkőzés')
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

  // ─── UX-003: Far future matches collapsed ────────────────────────────────────

  it('far future match (>7 days) → hidden by default', async () => {
    const { wrapper } = await mountView([MATCH_FAR_FUTURE])
    expect(wrapper.text()).not.toContain('Portugal')
    expect(wrapper.text()).toContain('további tervezett mérkőzés')
  })

  it('within-7-days match → visible by default', async () => {
    const { wrapper } = await mountView([MATCH_SCHEDULED])
    expect(wrapper.find('[data-testid="input-home"]').exists()).toBe(true)
  })

  it('clicking future matches button → far future match becomes visible', async () => {
    const { wrapper } = await mountView([MATCH_FAR_FUTURE])
    const btn = wrapper.findAll('button').find(b => b.text().includes('további tervezett'))
    expect(btn).toBeDefined()
    await btn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Portugal')
  })

  it('live match is always visible regardless of date', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('Germany')
  })

})
