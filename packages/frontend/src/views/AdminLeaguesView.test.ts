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

const { mockGetSession, mockLeaguesList, mockLeaguesArchive, mockLeaguesRestore, mockLeaguesCreate, mockLeaguesUpdate, mockLeaguesSync } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
  mockLeaguesList: vi.fn().mockResolvedValue([]),
  mockLeaguesArchive: vi.fn().mockResolvedValue(undefined),
  mockLeaguesRestore: vi.fn().mockResolvedValue(undefined),
  mockLeaguesCreate: vi.fn().mockResolvedValue(undefined),
  mockLeaguesUpdate: vi.fn().mockResolvedValue(undefined),
  mockLeaguesSync: vi.fn().mockResolvedValue({ matchesUpserted: 0, teamsUpserted: 0, playersUpserted: 0, errors: [] }),
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
        create: mockLeaguesCreate,
        update: mockLeaguesUpdate,
        delete: vi.fn(),
        archive: mockLeaguesArchive,
        restore: mockLeaguesRestore,
        sync: mockLeaguesSync,
      },
    },
  },
}))

const ACTIVE: League = {
  id: 'league-1',
  name: 'World Cup 2026',
  shortName: 'WC2026',
  status: 'active',
  archivedAt: null,
  startsAt: null,
  syncEnabled: false,
  externalId: null,
  season: null,
  syncFrom: null,
  syncTo: null,
  fixtureAllowlist: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
}

const ARCHIVED: League = {
  ...ACTIVE,
  id: 'league-2',
  name: 'Euro 2024',
  status: 'archived',
  archivedAt: '2026-07-21T10:00:00.000Z',
}

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
    mockLeaguesCreate.mockReset().mockResolvedValue(undefined)
    mockLeaguesUpdate.mockReset().mockResolvedValue(undefined)
    mockLeaguesSync.mockReset().mockResolvedValue({ matchesUpserted: 0, teamsUpserted: 0, playersUpserted: 0, errors: [] })
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

  it('shows active badge only on active rows', async () => {
    const { wrapper } = await mountView([ACTIVE, ARCHIVED])
    const badges = wrapper.findAll('[data-testid="league-active-badge"]')
    expect(badges).toHaveLength(1)
  })

  it('renders an empty-state row when there are no leagues', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.find('[data-testid="leagues-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="league-row"]')).toHaveLength(0)
  })

  it('shows archive button on active league, restore button on archived league', async () => {
    const { wrapper } = await mountView([ACTIVE, ARCHIVED])
    expect(wrapper.find('[data-testid="league-archive-btn-league-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="league-restore-btn-league-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="league-restore-btn-league-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="league-archive-btn-league-2"]').exists()).toBe(false)
  })

  it('archive button confirms then calls archive endpoint', async () => {
    mockLeaguesArchive.mockResolvedValue({ ...ACTIVE, status: 'archived', archivedAt: '2026-07-21T11:00:00.000Z' })
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
    mockLeaguesRestore.mockResolvedValue({ ...ARCHIVED, status: 'active', archivedAt: null })
    const { wrapper } = await mountView([ARCHIVED])
    await wrapper.find('[data-testid="league-restore-btn-league-2"]').trigger('click')
    await flushPromises()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(mockLeaguesRestore).toHaveBeenCalledWith('mock-token', 'league-2')
  })

  it('create button opens the form', async () => {
    const { wrapper } = await mountView([])
    expect(wrapper.find('[data-testid="league-form"]').exists()).toBe(false)
    await wrapper.find('[data-testid="league-create-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="league-form"]').exists()).toBe(true)
  })

  it('create form submit calls store.create with status and syncEnabled as separate fields', async () => {
    mockLeaguesCreate.mockResolvedValue({ ...ACTIVE, id: 'new', name: 'Premier League', shortName: 'PL' })
    const { wrapper } = await mountView([])
    await wrapper.find('[data-testid="league-create-btn"]').trigger('click')
    await wrapper.find('[data-testid="league-form-name"]').setValue('Premier League')
    await wrapper.find('[data-testid="league-form-short-name"]').setValue('PL')
    await wrapper.find('[data-testid="league-form-status"]').setValue('archived')
    await wrapper.find('[data-testid="league-form-sync-enabled"]').setValue(true)
    await wrapper.find('[data-testid="league-form-external-id"]').setValue('42')
    await wrapper.find('[data-testid="league-form-season"]').setValue('2026')
    await wrapper.find('[data-testid="league-form"]').trigger('submit')
    await flushPromises()
    expect(mockLeaguesCreate).toHaveBeenCalledWith('mock-token', {
      name: 'Premier League',
      shortName: 'PL',
      status: 'archived',
      syncEnabled: true,
      externalId: 42,
      season: 2026,
    })
  })

  it('edit button prefills the form and submit calls store.update with id', async () => {
    const withData: League = { ...ARCHIVED, externalId: 7, season: 2024, syncEnabled: true }
    mockLeaguesUpdate.mockResolvedValue(withData)
    const { wrapper } = await mountView([withData])
    await wrapper.find('[data-testid="league-edit-btn-league-2"]').trigger('click')
    const form = wrapper.find('[data-testid="league-form"]')
    expect(form.exists()).toBe(true)
    expect((wrapper.find('[data-testid="league-form-name"]').element as HTMLInputElement).value).toBe('Euro 2024')
    expect((wrapper.find('[data-testid="league-form-status"]').element as HTMLSelectElement).value).toBe('archived')
    expect((wrapper.find('[data-testid="league-form-sync-enabled"]').element as HTMLInputElement).checked).toBe(true)
    await wrapper.find('[data-testid="league-form-name"]').setValue('Euro 2028')
    await form.trigger('submit')
    await flushPromises()
    expect(mockLeaguesUpdate).toHaveBeenCalledWith('mock-token', 'league-2', expect.objectContaining({
      name: 'Euro 2028',
      shortName: 'WC2026',
      status: 'archived',
      syncEnabled: true,
      externalId: 7,
      season: 2024,
    }))
  })

  it('does not submit when name or shortName is empty', async () => {
    const { wrapper } = await mountView([])
    await wrapper.find('[data-testid="league-create-btn"]').trigger('click')
    await wrapper.find('[data-testid="league-form-short-name"]').setValue('PL')
    await wrapper.find('[data-testid="league-form"]').trigger('submit')
    await flushPromises()
    expect(mockLeaguesCreate).not.toHaveBeenCalled()
  })

  it('sync-now button is disabled for an archived league', async () => {
    const { wrapper } = await mountView([{ ...ARCHIVED, externalId: 1 }])
    const btn = wrapper.find('[data-testid="league-sync-now-btn-league-2"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('sync-now button is disabled when external id is missing', async () => {
    const { wrapper } = await mountView([{ ...ACTIVE, externalId: null }])
    const btn = wrapper.find('[data-testid="league-sync-now-btn-league-1"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('sync-now button calls store.syncLeague for a syncable league', async () => {
    const { wrapper } = await mountView([{ ...ACTIVE, externalId: 39, season: 2026 }])
    const btn = wrapper.find('[data-testid="league-sync-now-btn-league-1"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    await btn.trigger('click')
    await flushPromises()
    expect(mockLeaguesSync).toHaveBeenCalledWith('mock-token', 'league-1')
  })
})
