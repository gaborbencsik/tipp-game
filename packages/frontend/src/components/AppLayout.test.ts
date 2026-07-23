import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppLayout from '@/components/AppLayout.vue'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: { health: vi.fn(), auth: { me: vi.fn() } },
}))

// Child components that pull their own stores — stub to keep the mount light.
vi.mock('@/components/UserMenuButton.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/OnboardingOverlay.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/DonationButton.vue', () => ({ default: { template: '<div />' } }))

vi.mock('@/composables/usePendingTodayCount', () => ({
  usePendingTodayCount: () => ({ pendingTodayCount: { value: 0 } }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'u1', onboardingCompletedAt: '2026-01-01T00:00:00.000Z' } }),
}))

vi.mock('@/stores/scoring-explainer.store', () => ({
  useScoringExplainerStore: () => ({ open: vi.fn() }),
}))

const { mockFetchAccess, hasAccessRef } = vi.hoisted(() => ({
  mockFetchAccess: vi.fn().mockResolvedValue(undefined),
  hasAccessRef: { value: null as boolean | null },
}))

vi.mock('@/stores/tournamentTips.store', () => ({
  useTournamentTipsStore: () => ({
    get hasAccess() { return hasAccessRef.value },
    fetchAccess: mockFetchAccess,
  }),
}))

function mountLayout() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(AppLayout, {
    global: { plugins: [pinia, buildTestRouter()], mocks: { $t: (k: string) => k } },
  })
}

describe('AppLayout — US-954 tournament-tips nav visibility', () => {
  beforeEach(() => {
    mockFetchAccess.mockClear().mockResolvedValue(undefined)
    hasAccessRef.value = null
  })

  it('fetches tournament access on mount', async () => {
    mountLayout()
    await flushPromises()
    expect(mockFetchAccess).toHaveBeenCalledOnce()
  })

  it('shows the tournament-tips nav link when hasAccess is true', async () => {
    hasAccessRef.value = true
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-tournament-tips"]').exists()).toBe(true)
  })

  it('hides the tournament-tips nav link when hasAccess is false', async () => {
    hasAccessRef.value = false
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-tournament-tips"]').exists()).toBe(false)
  })

  it('hides the tournament-tips nav link while access is unknown (null)', async () => {
    hasAccessRef.value = null
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-tournament-tips"]').exists()).toBe(false)
  })
})

describe('AppLayout — UX-049 scoring-rules feature toggle', () => {
  beforeEach(() => {
    mockFetchAccess.mockClear().mockResolvedValue(undefined)
    hasAccessRef.value = null
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('shows the scoring-explainer nav item when the flag is enabled', async () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'true')
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-scoring-explainer"]').exists()).toBe(true)
  })

  it('hides the scoring-explainer nav item when the flag is disabled', async () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'false')
    const wrapper = mountLayout()
    await flushPromises()
    expect(wrapper.find('[data-testid="nav-scoring-explainer"]').exists()).toBe(false)
  })
})
