import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminStatsView from '@/views/AdminStatsView.vue'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const {
  mockGetSession,
  mockStatsGet,
  mockStatsMatches,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockStatsGet: vi.fn().mockResolvedValue({
    summary: {
      userCount: 10,
      activeUsers7d: 7,
      predictionCount: 120,
      fillRate: 60,
      groupCount: 3,
      avgGroupSize: 5,
      zeroTipUsers: 2,
    },
    users: [
      { id: 'u1', avatarUrl: null, displayName: 'Alice', tipCount: 8, fillPercent: 80, points: 20, groupCount: 2, lastActivity: '2026-05-01T10:00:00Z', isBanned: false },
      { id: 'u2', avatarUrl: null, displayName: 'Bob', tipCount: 0, fillPercent: 0, points: 0, groupCount: 1, lastActivity: null, isBanned: true },
    ],
  }),
  mockStatsMatches: vi.fn().mockResolvedValue({
    matches: [
      { matchId: 'm1', homeTeam: 'Germany', awayTeam: 'France', date: '2026-06-15T18:00:00Z', tippedCount: 8, totalUsers: 10, fillPercent: 80, result: '2-1' },
      { matchId: 'm2', homeTeam: 'Spain', awayTeam: 'Italy', date: '2026-06-16T20:00:00Z', tippedCount: 3, totalUsers: 10, fillPercent: 30, result: null },
    ],
  }),
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
      stats: {
        get: (...args: unknown[]) => mockStatsGet(...args),
        matches: (...args: unknown[]) => mockStatsMatches(...args),
      },
    },
  },
}))

function buildRouter() {
  return buildTestRouter({ '/admin/stats': AdminStatsView })
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminStatsView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return wrapper
}

describe('AdminStatsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders summary cards with correct values', async () => {
    const wrapper = await mountView()
    const cards = wrapper.find('[data-testid="summary-cards"]')
    expect(cards.text()).toContain('10')
    expect(cards.text()).toContain('7')
    expect(cards.text()).toContain('120')
    expect(cards.text()).toContain('60%')
  })

  it('renders subtitle with group count and avg size', async () => {
    const wrapper = await mountView()
    const subtitle = wrapper.find('[data-testid="subtitle"]')
    expect(subtitle.text()).toContain('3 csoport')
    expect(subtitle.text()).toContain('5 fő')
  })

  it('applies yellow background to fill rate card when < 50%', async () => {
    mockStatsGet.mockResolvedValueOnce({
      summary: { userCount: 5, activeUsers7d: 2, predictionCount: 10, fillRate: 30, groupCount: 1, avgGroupSize: 3, zeroTipUsers: 1 },
      users: [],
    })
    const wrapper = await mountView()
    const fillCard = wrapper.find('[data-testid="fill-rate-card"]')
    expect(fillCard.classes()).toContain('bg-yellow-50')
  })

  it('does not apply yellow background when fill rate >= 50%', async () => {
    const wrapper = await mountView()
    const fillCard = wrapper.find('[data-testid="fill-rate-card"]')
    expect(fillCard.classes()).not.toContain('bg-yellow-50')
    expect(fillCard.classes()).toContain('bg-white')
  })

  it('highlights zero-tip users with red background', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('[data-testid="user-row"]')
    expect(rows[1].classes()).toContain('bg-red-50')
  })

  it('does not highlight users with tips', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('[data-testid="user-row"]')
    expect(rows[0].classes()).not.toContain('bg-red-50')
  })

  it('filters users by search input', async () => {
    const wrapper = await mountView()
    const search = wrapper.find('[data-testid="user-search"]')
    await search.setValue('Alice')
    const rows = wrapper.findAll('[data-testid="user-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('Alice')
  })

  it('renders matches table sorted by date desc', async () => {
    const wrapper = await mountView()
    const rows = wrapper.findAll('[data-testid="match-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Spain')
    expect(rows[0].text()).toContain('Italy')
    expect(rows[1].text()).toContain('Germany')
    expect(rows[1].text()).toContain('2-1')
  })

  it('shows error banner on fetch failure', async () => {
    mockStatsGet.mockRejectedValueOnce(new Error('Network error'))
    const wrapper = await mountView()
    const banner = wrapper.find('[data-testid="error-banner"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Network error')
  })

  it('shows spinner during loading', async () => {
    mockStatsGet.mockImplementation(() => new Promise(() => {}))
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(AdminStatsView, { global: { plugins: [pinia, buildRouter()] } })
    await flushPromises()
    expect(wrapper.find('[data-testid="spinner"]').exists()).toBe(true)
  })
})
