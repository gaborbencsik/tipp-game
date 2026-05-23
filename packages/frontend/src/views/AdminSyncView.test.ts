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
  mockRunPolymarket,
  mockRunPlayers,
  mockRunTransfermarkt,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockGetSettings: vi.fn().mockResolvedValue({
    mode: 'adaptive',
    lastSuccessfulSyncAt: null,
    apiCallsToday: 0,
    syncInProgress: false,
    polymarketSyncEnabled: false,
    lastPolymarketSyncAt: null,
    playerSyncEnabled: false,
    lastPlayerSyncAt: null,
    transfermarktSyncEnabled: false,
    lastTransfermarktSyncAt: null,
    configuredLeagues: [],
  }),
  mockUpdateSettings: vi.fn().mockResolvedValue({ mode: 'adaptive' }),
  mockRun: vi.fn().mockResolvedValue({ results: [] }),
  mockRunPolymarket: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  mockRunPlayers: vi.fn().mockResolvedValue({ inserted: 0, updated: 0, statsUpserted: 0 }),
  mockRunTransfermarkt: vi.fn().mockResolvedValue({ updated: 0, skipped: 0 }),
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
        runPolymarket: (...args: unknown[]) => mockRunPolymarket(...args),
        runPlayers: (...args: unknown[]) => mockRunPlayers(...args),
        runTransfermarkt: (...args: unknown[]) => mockRunTransfermarkt(...args),
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
      polymarketSyncEnabled: false,
      lastPolymarketSyncAt: null,
      playerSyncEnabled: false,
      lastPlayerSyncAt: null,
      transfermarktSyncEnabled: false,
      lastTransfermarktSyncAt: null,
      configuredLeagues: [],
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
      polymarketSyncEnabled: false,
      lastPolymarketSyncAt: null,
      playerSyncEnabled: false,
      lastPlayerSyncAt: null,
      transfermarktSyncEnabled: false,
      lastTransfermarktSyncAt: null,
      configuredLeagues: [],
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
    expect(wrapper.text()).toContain('API hívások ma: 42')
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

  describe('UX-020 layout', () => {
    it('renders page title "Adatszinkronizáció"', async () => {
      const wrapper = await mountView()
      expect(wrapper.find('h1').text()).toBe('Adatszinkronizáció')
    })

    it('renders match sync section first', async () => {
      const wrapper = await mountView()
      const sections = wrapper.findAll('section[data-testid$="-sync-section"]')
      expect(sections.length).toBe(5)
      expect(sections[0]!.attributes('data-testid')).toBe('match-sync-section')
    })

    it('removes the standalone gray Sync status card', async () => {
      const wrapper = await mountView()
      expect(wrapper.find('[data-testid="sync-status-card"]').exists()).toBe(false)
    })

    it('renders sync mode select inside match sync section', async () => {
      const wrapper = await mountView()
      const matchSection = wrapper.find('[data-testid="match-sync-section"]')
      expect(matchSection.find('#match-sync-mode').exists()).toBe(true)
    })

    it('shows API calls counter inside match sync section', async () => {
      const wrapper = await mountView({ apiCallsToday: 42 })
      const matchSection = wrapper.find('[data-testid="match-sync-section"]')
      expect(matchSection.text()).toContain('API hívások ma: 42')
    })

    it('shows sync mode help text matching the selected mode', async () => {
      const wrapper = await mountView({ mode: 'adaptive' })
      expect(wrapper.text()).toContain('Élő meccs alatt percenként')
    })

    it('updates help text when mode changes', async () => {
      const wrapper = await mountView({ mode: 'off' })
      expect(wrapper.text()).toContain('A cron nem fut')
    })

    it('disables manual sync button when mode is off', async () => {
      const wrapper = await mountView({ mode: 'off' })
      const syncButton = wrapper.findAll('button').find(b => b.text().includes('Szinkronizálás indítása'))!
      expect(syncButton.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Off módban nem fut')
    })

    it('renders configured leagues as chips', async () => {
      const wrapper = await mountView({
        configuredLeagues: [
          { name: 'VB', externalId: 1, season: 2026 },
          { name: 'NB I', externalId: 848, season: 2025 },
        ],
      })
      const chips = wrapper.find('[data-testid="configured-leagues"]')
      expect(chips.exists()).toBe(true)
      expect(chips.text()).toContain('VB')
      expect(chips.text()).toContain('2026')
      expect(chips.text()).toContain('NB I')
      expect(chips.text()).toContain('2025')
    })

    it('shows warning when no leagues are configured', async () => {
      const wrapper = await mountView({ configuredLeagues: [] })
      expect(wrapper.text()).toContain('Nincs konfigurált liga')
    })

    it('shows polymarket "Utolsó futás" with relative time when set', async () => {
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const wrapper = await mountView({ lastPolymarketSyncAt: tenMinAgo })
      const polySection = wrapper.find('[data-testid="polymarket-sync-section"]')
      expect(polySection.text()).toContain('Utolsó futás')
      expect(polySection.text()).toContain('10 perce')
    })

    it('shows polymarket "Még nem futott" placeholder when null', async () => {
      const wrapper = await mountView({ lastPolymarketSyncAt: null })
      const polySection = wrapper.find('[data-testid="polymarket-sync-section"]')
      expect(polySection.text()).toContain('Még nem futott')
    })

    it('shows toggle frequency label "Aktív (5 percenként)" when polymarket enabled', async () => {
      const wrapper = await mountView({ polymarketSyncEnabled: true })
      const polySection = wrapper.find('[data-testid="polymarket-sync-section"]')
      expect(polySection.text()).toContain('Aktív (5 percenként)')
    })

    it('shows toggle frequency label "Aktív (napi 1×)" when player sync enabled', async () => {
      const wrapper = await mountView({ playerSyncEnabled: true })
      const playerSection = wrapper.find('[data-testid="player-sync-section"]')
      expect(playerSection.text()).toContain('Aktív (napi 1×)')
    })

    it('shows toggle frequency label "Aktív (napi 1×)" when transfermarkt enabled', async () => {
      const wrapper = await mountView({ transfermarktSyncEnabled: true })
      const tmSection = wrapper.find('[data-testid="transfermarkt-sync-section"]')
      expect(tmSection.text()).toContain('Aktív (napi 1×)')
    })

    it('shows "Kikapcsolva" label when toggle is off', async () => {
      const wrapper = await mountView({ polymarketSyncEnabled: false, playerSyncEnabled: false, transfermarktSyncEnabled: false })
      expect(wrapper.find('[data-testid="polymarket-sync-section"]').text()).toContain('Kikapcsolva')
      expect(wrapper.find('[data-testid="player-sync-section"]').text()).toContain('Kikapcsolva')
      expect(wrapper.find('[data-testid="transfermarkt-sync-section"]').text()).toContain('Kikapcsolva')
    })
  })
})
