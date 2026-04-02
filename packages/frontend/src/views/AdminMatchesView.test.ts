import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminMatchesView from '@/views/AdminMatchesView.vue'
import { useAdminMatchesStore } from '@/stores/admin-matches.store'
import type { Match } from '@/types/index'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockMatchesList,
  mockTeamsList,
  mockMatchesCreate,
  mockMatchesUpdate,
  mockMatchesDelete,
  mockMatchesSetResult,
} = vi.hoisted(() => ({
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockTeamsList: vi.fn().mockResolvedValue([]),
  mockMatchesCreate: vi.fn().mockResolvedValue(undefined),
  mockMatchesUpdate: vi.fn().mockResolvedValue(undefined),
  mockMatchesDelete: vi.fn().mockResolvedValue(undefined),
  mockMatchesSetResult: vi.fn().mockResolvedValue(undefined),
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
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    admin: {
      teams: { list: mockTeamsList, get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      matches: {
        create: mockMatchesCreate,
        update: mockMatchesUpdate,
        delete: mockMatchesDelete,
        setResult: mockMatchesSetResult,
      },
    },
  },
}))

const MATCH: Match = {
  id: 'match-1',
  homeTeam: { id: 'ht', name: 'Germany', shortCode: 'GER', flagUrl: null },
  awayTeam: { id: 'at', name: 'France', shortCode: 'FRA', flagUrl: null },
  venue: null,
  stage: 'group',
  groupName: 'A',
  matchNumber: 1,
  scheduledAt: '2026-06-11T15:00:00.000Z',
  status: 'scheduled',
  result: null,
}

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/matches', component: AdminMatchesView },
      { path: '/admin/teams', component: { template: '<div />' } },
    ],
  })
}

async function mountView(matches: Match[] = []) {
  mockMatchesList.mockResolvedValue(matches)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminMatchesView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store: useAdminMatchesStore() }
}

describe('AdminMatchesView', () => {
  beforeEach(() => {
    mockMatchesList.mockReset().mockResolvedValue([])
    mockTeamsList.mockReset().mockResolvedValue([])
    mockMatchesCreate.mockReset()
    mockMatchesUpdate.mockReset()
    mockMatchesDelete.mockReset()
    mockMatchesSetResult.mockReset()
    setActivePinia(createPinia())
  })

  it('spinner visible during loading', async () => {
    let resolve!: (v: Match[]) => void
    mockMatchesList.mockReturnValue(new Promise<Match[]>(r => { resolve = r }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AdminMatchesView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolve([])
  })

  it('matches loaded → rows rendered', async () => {
    const { wrapper } = await mountView([MATCH])
    expect(wrapper.findAll('[data-testid="match-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('France')
  })

  it('"Új mérkőzés" button → form appears', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="match-form"]').exists()).toBe(false)
    await wrapper.find('[data-testid="new-match-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="match-form"]').exists()).toBe(true)
  })

  it('form submit (create) → store.createMatch called', async () => {
    mockMatchesCreate.mockResolvedValue(MATCH)
    const { wrapper, store } = await mountView()
    const createSpy = vi.spyOn(store, 'createMatch').mockResolvedValue()

    await wrapper.find('[data-testid="new-match-btn"]').trigger('click')
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as {
      form: { homeTeamId: string; awayTeamId: string; scheduledAt: string; stage: string }
      submitForm: () => Promise<void>
    }
    vm.form.homeTeamId = 'ht'
    vm.form.awayTeamId = 'at'
    vm.form.scheduledAt = '2026-06-11T15:00'
    vm.form.stage = 'group'
    await vm.submitForm()
    await flushPromises()

    expect(createSpy).toHaveBeenCalledOnce()
  })

  it('edit button → form pre-filled', async () => {
    const { wrapper } = await mountView([MATCH])
    await wrapper.find(`[data-testid="edit-btn-${MATCH.id}"]`).trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as unknown as { form: { homeTeamId: string } }
    expect(vm.form.homeTeamId).toBe('ht')
  })

  it('edit form submit → store.updateMatch called', async () => {
    const updated = { ...MATCH, status: 'live' as const }
    mockMatchesUpdate.mockResolvedValue(updated)
    const { wrapper, store } = await mountView([MATCH])
    const updateSpy = vi.spyOn(store, 'updateMatch').mockResolvedValue()

    await wrapper.find(`[data-testid="edit-btn-${MATCH.id}"]`).trigger('click')
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as {
      form: { status: string }
      submitForm: () => Promise<void>
    }
    vm.form.status = 'live'
    await vm.submitForm()
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledWith(MATCH.id, expect.objectContaining({ status: 'live' }))
  })

  it('delete button (confirmed) → store.deleteMatch called', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { wrapper, store } = await mountView([MATCH])
    const deleteSpy = vi.spyOn(store, 'deleteMatch').mockResolvedValue()

    await wrapper.find(`[data-testid="delete-btn-${MATCH.id}"]`).trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith(MATCH.id)
    vi.unstubAllGlobals()
  })

  it('result button → result form appears', async () => {
    const { wrapper } = await mountView([MATCH])
    expect(wrapper.find('[data-testid="result-form"]').exists()).toBe(false)
    await wrapper.find(`[data-testid="result-btn-${MATCH.id}"]`).trigger('click')
    expect(wrapper.find('[data-testid="result-form"]').exists()).toBe(true)
  })

  it('result form submit → store.setResult called', async () => {
    mockMatchesSetResult.mockResolvedValue(undefined)
    const { wrapper, store } = await mountView([MATCH])
    const setResultSpy = vi.spyOn(store, 'setResult').mockResolvedValue()

    await wrapper.find(`[data-testid="result-btn-${MATCH.id}"]`).trigger('click')
    await wrapper.vm.$nextTick()

    const vm = wrapper.vm as unknown as {
      resultForm: { homeGoals: number; awayGoals: number }
      submitResult: () => Promise<void>
    }
    vm.resultForm.homeGoals = 2
    vm.resultForm.awayGoals = 1
    await vm.submitResult()
    await flushPromises()

    expect(setResultSpy).toHaveBeenCalledWith(MATCH.id, { homeGoals: 2, awayGoals: 1 })
  })
})
