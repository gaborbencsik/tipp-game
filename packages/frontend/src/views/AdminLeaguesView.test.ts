import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AdminLeaguesView from '@/views/AdminLeaguesView.vue'
import { useAdminLeaguesStore } from '@/stores/admin-leagues.store'
import type { League } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockGetSession, mockLeaguesList, mockLeaguesArchive, mockLeaguesRestore } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
  mockLeaguesList: vi.fn().mockResolvedValue([]),
  mockLeaguesArchive: vi.fn().mockResolvedValue(undefined),
  mockLeaguesRestore: vi.fn().mockResolvedValue(undefined),
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
    admin: {
      leagues: {
        list: mockLeaguesList,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        archive: mockLeaguesArchive,
        restore: mockLeaguesRestore,
      },
    },
  },
}))

const ACTIVE: League = {
  id: 'league-1',
  name: 'World Cup 2026',
  shortName: 'WC2026',
  archivedAt: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}

const ARCHIVED: League = { ...ACTIVE, id: 'league-2', name: 'Euro 2024', archivedAt: '2026-07-21T10:00:00.000Z' }

function buildRouter() {
  return buildTestRouter({ '/admin/leagues': AdminLeaguesView })
}

async function mountView(leagues: League[] = []) {
  mockLeaguesList.mockResolvedValue(leagues)
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(AdminLeaguesView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store: useAdminLeaguesStore() }
}

describe('AdminLeaguesView', () => {
  beforeEach(() => {
    mockLeaguesList.mockReset().mockResolvedValue([])
    mockLeaguesArchive.mockReset().mockResolvedValue(undefined)
    mockLeaguesRestore.mockReset().mockResolvedValue(undefined)
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
  })

  it('fetches with includeArchived (admin sees archived leagues too)', async () => {
    await mountView([ACTIVE, ARCHIVED])
    expect(mockLeaguesList).toHaveBeenCalledWith('mock-token', true)
    expect(mockLeaguesList).toHaveBeenCalledTimes(1)
  })

  it('shows archived badge only on archived rows', async () => {
    const { wrapper } = await mountView([ACTIVE, ARCHIVED])
    const badges = wrapper.findAll('[data-testid="league-archived-badge"]')
    expect(badges).toHaveLength(1)
  })

  it('shows archive button on active league, restore button on archived league', async () => {
    const { wrapper } = await mountView([ACTIVE, ARCHIVED])
    expect(wrapper.find('[data-testid="league-archive-btn-league-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="league-restore-btn-league-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="league-restore-btn-league-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="league-archive-btn-league-2"]').exists()).toBe(false)
  })

  it('archive button confirms then calls archive endpoint', async () => {
    mockLeaguesArchive.mockResolvedValue({ ...ACTIVE, archivedAt: '2026-07-21T11:00:00.000Z' })
    const { wrapper } = await mountView([ACTIVE])
    await wrapper.find('[data-testid="league-archive-btn-league-1"]').trigger('click')
    await flushPromises()
    expect(window.confirm).toHaveBeenCalledOnce()
    expect(mockLeaguesArchive).toHaveBeenCalledWith('mock-token', 'league-1')
  })

  it('archive button does not call endpoint when confirm is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    const { wrapper } = await mountView([ACTIVE])
    await wrapper.find('[data-testid="league-archive-btn-league-1"]').trigger('click')
    await flushPromises()
    expect(mockLeaguesArchive).not.toHaveBeenCalled()
  })

  it('restore button calls restore endpoint without confirm', async () => {
    mockLeaguesRestore.mockResolvedValue({ ...ARCHIVED, archivedAt: null })
    const { wrapper } = await mountView([ARCHIVED])
    await wrapper.find('[data-testid="league-restore-btn-league-2"]').trigger('click')
    await flushPromises()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockLeaguesRestore).toHaveBeenCalledWith('mock-token', 'league-2')
  })
})
