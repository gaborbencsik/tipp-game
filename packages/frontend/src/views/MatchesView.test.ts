import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import MatchesView from '@/views/MatchesView.vue'
import { useMatchesStore } from '@/stores/matches.store'
import type { Match } from '@/types/index'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockMatchesList } = vi.hoisted(() => ({
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
    matches: { list: mockMatchesList },
  },
}))

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

const MATCH_SCHEDULED: Match = {
  id: 'match-sched',
  homeTeam: { id: 'ht3', name: 'Brazil', shortCode: 'BRA', flagUrl: null },
  awayTeam: { id: 'at3', name: 'Argentina', shortCode: 'ARG', flagUrl: null },
  venue: { name: 'Stadium', city: 'Sao Paulo' },
  stage: 'final',
  groupName: null,
  matchNumber: 64,
  scheduledAt: '2026-07-19T18:00:00.000Z',
  status: 'scheduled',
  result: null,
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

async function mountView(apiMatches: Match[] = []) {
  mockMatchesList.mockResolvedValue(apiMatches)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store: useMatchesStore() }
}

describe('MatchesView', () => {
  beforeEach(() => {
    mockMatchesList.mockReset()
    mockMatchesList.mockResolvedValue([])
    setActivePinia(createPinia())
  })

  it('loading állapotban spinner látható', async () => {
    let resolveList!: (v: Match[]) => void
    mockMatchesList.mockReturnValue(new Promise<Match[]>(res => { resolveList = res }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolveList([])
  })

  it('meccsek betöltve → napcsoportok renderelve', async () => {
    const { wrapper } = await mountView([MATCH_LIVE, MATCH_FINISHED, MATCH_SCHEDULED])
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('France')
    expect(wrapper.text()).toContain('Brazil')
  })

  it('live meccs → ÉLŐBEN szöveg látható', async () => {
    const { wrapper } = await mountView([MATCH_LIVE])
    expect(wrapper.text()).toContain('ÉLŐBEN')
  })

  it('finished meccs → végeredmény számok és csapatok láthatók', async () => {
    const { wrapper } = await mountView([MATCH_FINISHED])
    expect(wrapper.text()).toContain('Spain')
    expect(wrapper.text()).toContain('Italy')
    expect(wrapper.text()).toContain('Befejezett')
    expect(wrapper.text()).toContain('2')
  })

  it('Csoportkör szűrő gombra kattintva stageFilter=group lesz', async () => {
    const { wrapper, store } = await mountView()
    const buttons = wrapper.findAll('button')
    const groupBtn = buttons.find(b => b.text() === 'Csoportkör')
    expect(groupBtn).toBeDefined()
    await groupBtn?.trigger('click')
    expect(store.stageFilter).toBe('group')
  })

  it('Összes gombra kattintva stageFilter null lesz', async () => {
    const { wrapper, store } = await mountView()
    store.stageFilter = 'group'
    const buttons = wrapper.findAll('button')
    const allBtn = buttons.find(b => b.text() === 'Összes')
    await allBtn?.trigger('click')
    expect(store.stageFilter).toBeNull()
  })

  it('hiba esetén hibaüzenet jelenik meg', async () => {
    mockMatchesList.mockRejectedValue(new Error('Hálózati hiba'))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(MatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    expect(wrapper.text()).toContain('Hálózati hiba')
  })

  it('üres lista esetén tájékoztató szöveg jelenik meg', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.text()).toContain('Nincs megjeleníthető mérkőzés')
  })
})
