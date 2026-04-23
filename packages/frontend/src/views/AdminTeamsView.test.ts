import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminTeamsView from '@/views/AdminTeamsView.vue'
import { useAdminTeamsStore } from '@/stores/admin-teams.store'
import type { Team } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockGetSession,
  mockTeamsList,
  mockTeamsCreate,
  mockTeamsUpdate,
  mockTeamsDelete,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockTeamsList: vi.fn().mockResolvedValue([]),
  mockTeamsCreate: vi.fn().mockResolvedValue(undefined),
  mockTeamsUpdate: vi.fn().mockResolvedValue(undefined),
  mockTeamsDelete: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
    matches: { list: vi.fn() },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    admin: {
      teams: {
        list: mockTeamsList,
        get: vi.fn(),
        create: mockTeamsCreate,
        update: mockTeamsUpdate,
        delete: mockTeamsDelete,
      },
    },
  },
}))

const TEAM_1: Team = { id: 'team-1', name: 'Germany', shortCode: 'GER', flagUrl: null, group: 'A', teamType: 'national', countryCode: 'de' }
const TEAM_2: Team = { id: 'team-2', name: 'France', shortCode: 'FRA', flagUrl: null, group: 'B', teamType: 'national', countryCode: 'fr' }

function buildRouter() {
  return buildTestRouter({ '/admin/teams': AdminTeamsView })
}

async function mountView(teams: Team[] = []) {
  mockTeamsList.mockResolvedValue(teams)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminTeamsView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store: useAdminTeamsStore() }
}

describe('AdminTeamsView', () => {
  beforeEach(() => {
    mockTeamsList.mockReset()
    mockTeamsList.mockResolvedValue([])
    mockTeamsCreate.mockReset()
    mockTeamsUpdate.mockReset()
    mockTeamsDelete.mockReset()
    setActivePinia(createPinia())
  })

  it('loading state → spinner visible', async () => {
    let resolveList!: (v: Team[]) => void
    mockTeamsList.mockReturnValue(new Promise<Team[]>(res => { resolveList = res }))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AdminTeamsView, { global: { plugins: [pinia, buildRouter()] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
    resolveList([])
  })

  it('teams loaded → table rows rendered', async () => {
    const { wrapper } = await mountView([TEAM_1, TEAM_2])
    expect(wrapper.findAll('[data-testid="team-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Germany')
    expect(wrapper.text()).toContain('France')
  })

  it('"Új csapat" button → form appears', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="team-form"]').exists()).toBe(false)
    await wrapper.find('[data-testid="new-team-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="team-form"]').exists()).toBe(true)
  })

  it('form submit → store.createTeam called', async () => {
    const newTeam: Team = { id: 'new-id', name: 'Spain', shortCode: 'ESP', flagUrl: null, group: 'C', teamType: 'national', countryCode: 'es' }
    mockTeamsCreate.mockResolvedValue(newTeam)
    const { wrapper, store } = await mountView()
    const createSpy = vi.spyOn(store, 'createTeam').mockResolvedValue()

    await wrapper.find('[data-testid="new-team-btn"]').trigger('click')
    await wrapper.find('[data-testid="form-name"]').setValue('Spain')
    await wrapper.find('[data-testid="form-short-code"]').setValue('ESP')
    await wrapper.find('[data-testid="team-form"]').trigger('submit')
    await flushPromises()

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Spain', shortCode: 'ESP' }))
  })

  it('edit button → form pre-filled with team data', async () => {
    const { wrapper } = await mountView([TEAM_1])
    await wrapper.find(`[data-testid="edit-btn-${TEAM_1.id}"]`).trigger('click')
    const nameInput = wrapper.find('[data-testid="form-name"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('Germany')
    const shortCodeInput = wrapper.find('[data-testid="form-short-code"]')
    expect((shortCodeInput.element as HTMLInputElement).value).toBe('GER')
  })

  it('delete button (confirm) → store.deleteTeam called', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    mockTeamsDelete.mockResolvedValue(undefined)
    const { wrapper, store } = await mountView([TEAM_1])
    const deleteSpy = vi.spyOn(store, 'deleteTeam').mockResolvedValue()

    await wrapper.find(`[data-testid="delete-btn-${TEAM_1.id}"]`).trigger('click')
    await flushPromises()

    expect(deleteSpy).toHaveBeenCalledWith(TEAM_1.id)
    vi.unstubAllGlobals()
  })
})
