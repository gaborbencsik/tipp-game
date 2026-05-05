import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminSyncView from '@/views/AdminSyncView.vue'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockGetSession,
  mockGetSettings,
  mockUpdateSettings,
  mockRun,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockGetSettings: vi.fn().mockResolvedValue({
    mode: 'adaptive',
    lastSuccessfulSyncAt: null,
    apiCallsToday: 0,
    syncInProgress: false,
  }),
  mockUpdateSettings: vi.fn().mockResolvedValue({ mode: 'adaptive' }),
  mockRun: vi.fn().mockResolvedValue({ results: [] }),
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
      sync: {
        getSettings: (...args: unknown[]) => mockGetSettings(...args),
        updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
        run: (...args: unknown[]) => mockRun(...args),
      },
    },
  },
}))

function buildRouter() {
  return buildTestRouter({ '/admin/sync': AdminSyncView })
}

async function mountView(settingsOverride?: Record<string, unknown>) {
  if (settingsOverride) {
    mockGetSettings.mockResolvedValue({
      mode: 'adaptive',
      lastSuccessfulSyncAt: null,
      apiCallsToday: 0,
      syncInProgress: false,
      ...settingsOverride,
    })
  }
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminSyncView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return wrapper
}

describe('AdminSyncView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSettings.mockResolvedValue({
      mode: 'adaptive',
      lastSuccessfulSyncAt: null,
      apiCallsToday: 0,
      syncInProgress: false,
    })
  })

  it('shows "Még nem futott" when lastSuccessfulSyncAt is null', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Még nem futott')
  })

  it('shows relative time when lastSuccessfulSyncAt is set', async () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const wrapper = await mountView({ lastSuccessfulSyncAt: fiveMinAgo })
    expect(wrapper.text()).toContain('5 perce')
  })

  it('shows "most" when last sync is less than 1 minute ago', async () => {
    const justNow = new Date(Date.now() - 10 * 1000).toISOString()
    const wrapper = await mountView({ lastSuccessfulSyncAt: justNow })
    expect(wrapper.text()).toContain('most')
  })

  it('shows hours when last sync is hours ago', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const wrapper = await mountView({ lastSuccessfulSyncAt: threeHoursAgo })
    expect(wrapper.text()).toContain('3 órája')
  })

  it('shows API calls counter', async () => {
    const wrapper = await mountView({ apiCallsToday: 42 })
    expect(wrapper.text()).toContain('42 / 100')
  })

  it('highlights API calls in red when above 80%', async () => {
    const wrapper = await mountView({ apiCallsToday: 85 })
    const apiText = wrapper.find('.text-red-600')
    expect(apiText.exists()).toBe(true)
    expect(apiText.text()).toContain('85 / 100')
  })

  it('does not highlight API calls when below 80%', async () => {
    const wrapper = await mountView({ apiCallsToday: 50 })
    const redElements = wrapper.findAll('.text-red-600.font-semibold')
    expect(redElements.length).toBe(0)
  })

  it('shows "Folyamatban..." spinner when syncInProgress is true', async () => {
    const wrapper = await mountView({ syncInProgress: true })
    expect(wrapper.text()).toContain('Folyamatban...')
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('does not show spinner when syncInProgress is false', async () => {
    const wrapper = await mountView({ syncInProgress: false })
    expect(wrapper.text()).not.toContain('Folyamatban...')
  })

  it('reloads settings after manual sync trigger', async () => {
    mockRun.mockResolvedValue({ results: [{ teamsUpserted: 1, fixturesUpserted: 5, resultsUpserted: 2, errors: [], partial: false }] })
    const wrapper = await mountView({ mode: 'adaptive' })

    expect(mockGetSettings).toHaveBeenCalledTimes(1)

    const syncButton = wrapper.findAll('button').find(b => b.text().includes('Szinkronizálás indítása'))!
    expect(syncButton.attributes('disabled')).toBeUndefined()
    await syncButton.trigger('click')
    await flushPromises()

    expect(mockRun).toHaveBeenCalled()
    expect(mockGetSettings).toHaveBeenCalledTimes(2)
  })
})
