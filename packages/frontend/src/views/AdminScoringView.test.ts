import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminScoringView from '@/views/AdminScoringView.vue'
import { useAdminScoringStore } from '@/stores/admin-scoring.store'
import type { ScoringConfigFull } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

const {
  mockGetSession,
  mockScoringConfigGet,
  mockScoringConfigUpdate,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockScoringConfigGet: vi.fn().mockResolvedValue(undefined),
  mockScoringConfigUpdate: vi.fn().mockResolvedValue(undefined),
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
      teams: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      users: { list: vi.fn(), updateRole: vi.fn(), ban: vi.fn() },
      scoringConfig: {
        get: mockScoringConfigGet,
        update: mockScoringConfigUpdate,
      },
    },
  },
}))

vi.mock('@/stores/auth.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/auth.store')>()
  return {
    ...actual,
    useAuthStore: () => ({
      user: { id: 'user-uuid-1', role: 'admin', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' },
      isAuthenticated: () => true,
      logout: vi.fn(),
    }),
  }
})

const CONFIG: ScoringConfigFull = {
  id: 'config-uuid-1',
  name: 'Default',
  exactScore: 3,
  correctWinnerAndDiff: 2,
  correctWinner: 1,
  correctDraw: 2,
  correctOutcome: 1,
  incorrect: 0,
}

function buildRouter() {
  return buildTestRouter({ '/admin/scoring': AdminScoringView })
}

async function mountView(config: ScoringConfigFull | null = CONFIG) {
  mockScoringConfigGet.mockResolvedValue(config)
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAdminScoringStore()
  const wrapper = mount(AdminScoringView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store }
}

describe('AdminScoringView', () => {
  beforeEach(() => {
    mockScoringConfigGet.mockReset().mockResolvedValue(CONFIG)
    mockScoringConfigUpdate.mockReset()
    setActivePinia(createPinia())
  })

  it('spinner visible while loading', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    mockScoringConfigGet.mockResolvedValue(CONFIG)
    const store = useAdminScoringStore()
    store.isLoading = true
    const wrapper = mount(AdminScoringView, { global: { plugins: [pinia, buildRouter()] } })
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
  })

  it('form visible after config loaded, fields pre-filled', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="scoring-form"]').exists()).toBe(true)
    expect((wrapper.find('[data-testid="field-exactScore"]').element as HTMLInputElement).value).toBe('3')
    expect((wrapper.find('[data-testid="field-correctWinner"]').element as HTMLInputElement).value).toBe('1')
  })

  it('submit → store.updateConfig called with form values', async () => {
    const { wrapper, store } = await mountView()
    const updateSpy = vi.spyOn(store, 'updateConfig').mockResolvedValue()
    await wrapper.find('[data-testid="scoring-form"]').trigger('submit')
    await flushPromises()
    expect(updateSpy).toHaveBeenCalledWith({
      exactScore: 3,
      correctWinnerAndDiff: 2,
      correctWinner: 1,
      correctDraw: 2,
      correctOutcome: 1,
      incorrect: 0,
    })
  })

  it('saveStatus saved → Elmentve! visible', async () => {
    const { wrapper, store } = await mountView()
    store.saveStatus = 'saved'
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="save-status"]').text()).toBe('Elmentve!')
  })

  it('error banner visible on fetch error', async () => {
    mockScoringConfigGet.mockRejectedValue(new Error('Not found'))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AdminScoringView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="error-banner"]').text()).toContain('Not found')
  })
})
