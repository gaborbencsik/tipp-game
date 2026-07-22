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
  mockRunRawStats,
  mockRunInsights,
  mockRunInsightsTranslate,
  mockGetInsightsUsage,
  mockMatchesList,
  mockLeaguesList,
  mockLeaguesUpdate,
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
  mockRunRawStats: vi.fn().mockResolvedValue({ processed: 0, skipped: 0, errors: [], apiCalls: 0, durationMs: 0 }),
  mockRunInsights: vi.fn().mockResolvedValue({ generated: 0, skipped: 0, errors: [] }),
  mockRunInsightsTranslate: vi.fn().mockResolvedValue({ translated: 0, skipped: 0, errors: [] }),
  mockGetInsightsUsage: vi.fn().mockResolvedValue({
    date: '2026-05-25',
    requestsToday: { generate: 0, translate: 0, total: 0 },
    inputTokensToday: 0,
    outputTokensToday: 0,
    dailyLimit: 450,
    remaining: 450,
    last7Days: [],
  }),
  mockMatchesList: vi.fn().mockResolvedValue([]),
  mockLeaguesList: vi.fn().mockResolvedValue([]),
  mockLeaguesUpdate: vi.fn().mockResolvedValue({}),
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
    matches: { list: (...args: unknown[]) => mockMatchesList(...args) },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    admin: {
      sync: {
        getSettings: (...args: unknown[]) => mockGetSettings(...args),
        updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
        run: (...args: unknown[]) => mockRun(...args),
        runPolymarket: (...args: unknown[]) => mockRunPolymarket(...args),
        runPlayers: (...args: unknown[]) => mockRunPlayers(...args),
        runTransfermarkt: (...args: unknown[]) => mockRunTransfermarkt(...args),
        runRawStats: (...args: unknown[]) => mockRunRawStats(...args),
        runInsights: (...args: unknown[]) => mockRunInsights(...args),
        runInsightsTranslate: (...args: unknown[]) => mockRunInsightsTranslate(...args),
        getInsightsUsage: (...args: unknown[]) => mockGetInsightsUsage(...args),
      },
      leagues: {
        list: (...args: unknown[]) => mockLeaguesList(...args),
        update: (...args: unknown[]) => mockLeaguesUpdate(...args),
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
    mockLeaguesList.mockResolvedValue([])
    mockLeaguesUpdate.mockResolvedValue({})
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
      expect(sections.length).toBe(6)
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

    it('renders configured leagues with per-league toggles', async () => {
      mockLeaguesList.mockResolvedValue([
        { id: 'lg-1', name: 'World Cup', shortName: 'VB', status: 'active', archivedAt: null, startsAt: null, syncEnabled: true, externalId: 1, season: 2026, syncFrom: null, syncTo: null, fixtureAllowlist: null, createdAt: '', updatedAt: '' },
        { id: 'lg-2', name: 'NB I', shortName: 'NBI', status: 'active', archivedAt: null, startsAt: null, syncEnabled: false, externalId: 848, season: 2025, syncFrom: null, syncTo: null, fixtureAllowlist: null, createdAt: '', updatedAt: '' },
      ])
      const wrapper = await mountView()
      const section = wrapper.find('[data-testid="configured-leagues-section"]')
      expect(section.exists()).toBe(true)
      expect(section.text()).toContain('World Cup')
      expect(section.text()).toContain('NB I')
      expect(wrapper.find('[data-testid="league-sync-toggle-lg-1"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="league-sync-toggle-lg-2"]').exists()).toBe(true)
    })

    it('shows warning when no leagues are configured', async () => {
      mockLeaguesList.mockResolvedValue([])
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

  describe('insights sync section (US-1302)', () => {
    it('renders insights section with title and trigger button', async () => {
      const wrapper = await mountView()
      const section = wrapper.find('[data-testid="insights-sync-section"]')
      expect(section.exists()).toBe(true)
      expect(section.text()).toContain('Match Pulse AI insightok')
      expect(section.find('[data-testid="insights-run-btn"]').exists()).toBe(true)
    })

    it('shows daily usage from getInsightsUsage', async () => {
      mockGetInsightsUsage.mockResolvedValue({
        date: '2026-05-25',
        requestsToday: { generate: 8, translate: 4, total: 12 },
        inputTokensToday: 0,
        outputTokensToday: 0,
        dailyLimit: 450,
        remaining: 438,
        last7Days: [],
      })
      const wrapper = await mountView()
      const usage = wrapper.find('[data-testid="insights-usage"]')
      expect(usage.text()).toContain('12 / 450')
      expect(usage.text()).toContain('438 maradt')
      expect(usage.text()).toContain('generálás: 8')
      expect(usage.text()).toContain('fordítás: 4')
    })

    it('triggers insights run on button click and reloads usage', async () => {
      mockRunInsights.mockResolvedValue({ generated: 3, skipped: 1, errors: [] })
      const wrapper = await mountView()
      mockGetInsightsUsage.mockClear()

      await wrapper.find('[data-testid="insights-run-btn"]').trigger('click')
      await flushPromises()

      expect(mockRunInsights).toHaveBeenCalled()
      expect(mockGetInsightsUsage).toHaveBeenCalled()
      expect(wrapper.text()).toContain('3 generálva')
      expect(wrapper.text()).toContain('1 kihagyva')
    })

    it('shows error when run throws', async () => {
      mockRunInsights.mockRejectedValue(new Error('Daily LLM limit exceeded'))
      const wrapper = await mountView()
      await wrapper.find('[data-testid="insights-run-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="insights-error"]').text()).toContain('Daily LLM limit exceeded')
    })

    it('renders match selector populated from scheduled matches', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      mockMatchesList.mockResolvedValue([
        {
          id: 'match-1',
          homeTeam: { id: 't1', name: 'Magyarország', shortCode: 'HUN', flagUrl: null, teamType: 'national', countryCode: 'HU' },
          awayTeam: { id: 't2', name: 'Németország', shortCode: 'GER', flagUrl: null, teamType: 'national', countryCode: 'DE' },
          venue: null,
          league: null,
          stage: 'group',
          groupName: 'A',
          matchNumber: 1,
          scheduledAt: future,
          status: 'scheduled',
          result: null,
        },
      ])
      const wrapper = await mountView()
      const select = wrapper.find('[data-testid="insights-match-select"]')
      expect(select.exists()).toBe(true)
      expect(select.text()).toContain('Magyarország')
      expect(select.text()).toContain('Németország')
      expect(mockMatchesList).toHaveBeenCalledWith('mock-token', { status: 'scheduled' })
    })

    it('passes selected matchId to runInsights when a match is chosen', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      mockMatchesList.mockResolvedValue([
        {
          id: 'match-42',
          homeTeam: { id: 't1', name: 'A', shortCode: 'A', flagUrl: null, teamType: 'national', countryCode: null },
          awayTeam: { id: 't2', name: 'B', shortCode: 'B', flagUrl: null, teamType: 'national', countryCode: null },
          venue: null,
          league: null,
          stage: 'group',
          groupName: null,
          matchNumber: null,
          scheduledAt: future,
          status: 'scheduled',
          result: null,
        },
      ])
      mockRunInsights.mockResolvedValue({ generated: 1, skipped: 0, errors: [] })
      const wrapper = await mountView()

      const select = wrapper.find('[data-testid="insights-match-select"]')
      await select.setValue('match-42')
      await wrapper.find('[data-testid="insights-run-btn"]').trigger('click')
      await flushPromises()

      expect(mockRunInsights).toHaveBeenCalledWith('mock-token', 'match-42')
    })

    it('passes undefined matchId to runInsights when no match is selected', async () => {
      const wrapper = await mountView()
      await wrapper.find('[data-testid="insights-run-btn"]').trigger('click')
      await flushPromises()
      expect(mockRunInsights).toHaveBeenCalledWith('mock-token', undefined)
    })

    it('filters out matches whose scheduledAt is in the past', async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      mockMatchesList.mockResolvedValue([
        {
          id: 'past-match',
          homeTeam: { id: 't1', name: 'PastHome', shortCode: 'PH', flagUrl: null, teamType: 'national', countryCode: null },
          awayTeam: { id: 't2', name: 'PastAway', shortCode: 'PA', flagUrl: null, teamType: 'national', countryCode: null },
          venue: null, league: null, stage: 'group', groupName: null, matchNumber: null,
          scheduledAt: past, status: 'scheduled', result: null,
        },
        {
          id: 'future-match',
          homeTeam: { id: 't3', name: 'FutureHome', shortCode: 'FH', flagUrl: null, teamType: 'national', countryCode: null },
          awayTeam: { id: 't4', name: 'FutureAway', shortCode: 'FA', flagUrl: null, teamType: 'national', countryCode: null },
          venue: null, league: null, stage: 'group', groupName: null, matchNumber: null,
          scheduledAt: future, status: 'scheduled', result: null,
        },
      ])
      const wrapper = await mountView()
      const select = wrapper.find('[data-testid="insights-match-select"]')
      expect(select.text()).not.toContain('PastHome')
      expect(select.text()).toContain('FutureHome')
    })

    it('renders the translate button (US-1310)', async () => {
      const wrapper = await mountView()
      expect(wrapper.find('[data-testid="insights-translate-btn"]').exists()).toBe(true)
    })

    it('triggers translate on button click and reloads usage', async () => {
      mockRunInsightsTranslate.mockResolvedValue({ translated: 4, skipped: 1, errors: [] })
      const wrapper = await mountView()
      mockGetInsightsUsage.mockClear()

      await wrapper.find('[data-testid="insights-translate-btn"]').trigger('click')
      await flushPromises()

      expect(mockRunInsightsTranslate).toHaveBeenCalledWith('mock-token', undefined)
      expect(mockGetInsightsUsage).toHaveBeenCalled()
      const result = wrapper.find('[data-testid="insights-translate-result"]')
      expect(result.text()).toContain('4 fordítva')
      expect(result.text()).toContain('1 kihagyva')
    })

    it('passes selected matchId to translate when a match is chosen', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      mockMatchesList.mockResolvedValue([
        {
          id: 'match-99',
          homeTeam: { id: 't1', name: 'A', shortCode: 'A', flagUrl: null, teamType: 'national', countryCode: null },
          awayTeam: { id: 't2', name: 'B', shortCode: 'B', flagUrl: null, teamType: 'national', countryCode: null },
          venue: null, league: null, stage: 'group', groupName: null, matchNumber: null,
          scheduledAt: future, status: 'scheduled', result: null,
        },
      ])
      mockRunInsightsTranslate.mockResolvedValue({ translated: 1, skipped: 0, errors: [] })
      const wrapper = await mountView()

      await wrapper.find('[data-testid="insights-match-select"]').setValue('match-99')
      await wrapper.find('[data-testid="insights-translate-btn"]').trigger('click')
      await flushPromises()

      expect(mockRunInsightsTranslate).toHaveBeenCalledWith('mock-token', 'match-99')
    })

    it('shows error when translate throws', async () => {
      mockRunInsightsTranslate.mockRejectedValue(new Error('Daily LLM limit exceeded'))
      const wrapper = await mountView()
      await wrapper.find('[data-testid="insights-translate-btn"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="insights-error"]').text()).toContain('Daily LLM limit exceeded')
    })
  })

  describe('per-league sync toggle (US-957)', () => {
    function league(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        id: 'lg-1',
        name: 'World Cup',
        shortName: 'VB',
        status: 'active',
        archivedAt: null,
        startsAt: null,
        syncEnabled: true,
        externalId: 1,
        season: 2026,
        syncFrom: null,
        syncTo: null,
        fixtureAllowlist: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides,
      }
    }

    it('loads leagues via admin.leagues.list including archived', async () => {
      await mountView()
      expect(mockLeaguesList).toHaveBeenCalledWith('mock-token', true)
    })

    it('renders a toggle for each configured league reflecting syncEnabled', async () => {
      mockLeaguesList.mockResolvedValue([
        league({ id: 'lg-1', syncEnabled: true }),
        league({ id: 'lg-2', name: 'NB I', shortName: 'NBI', externalId: 848, syncEnabled: false }),
      ])
      const wrapper = await mountView()
      const section = wrapper.find('[data-testid="configured-leagues-section"]')
      expect(section.exists()).toBe(true)
      const t1 = wrapper.find('[data-testid="league-sync-toggle-lg-1"]')
      const t2 = wrapper.find('[data-testid="league-sync-toggle-lg-2"]')
      expect((t1.element as HTMLInputElement).checked).toBe(true)
      expect((t2.element as HTMLInputElement).checked).toBe(false)
    })

    it('toggling calls leagues.update with new syncEnabled and keeps state', async () => {
      mockLeaguesList.mockResolvedValue([league({ id: 'lg-1', syncEnabled: false })])
      const wrapper = await mountView()
      const toggle = wrapper.find('[data-testid="league-sync-toggle-lg-1"]')
      await toggle.trigger('change')
      expect(mockLeaguesUpdate).toHaveBeenCalledWith('mock-token', 'lg-1', { syncEnabled: true })
      await flushPromises()
      expect((toggle.element as HTMLInputElement).checked).toBe(true)
      expect(wrapper.find('[data-testid="league-sync-error-lg-1"]').exists()).toBe(false)
    })

    it('rolls back and shows error when update fails', async () => {
      mockLeaguesList.mockResolvedValue([league({ id: 'lg-1', syncEnabled: false })])
      mockLeaguesUpdate.mockRejectedValue(new Error('externalId is required'))
      const wrapper = await mountView()
      const toggle = wrapper.find('[data-testid="league-sync-toggle-lg-1"]')
      await toggle.trigger('change')
      await flushPromises()
      expect((toggle.element as HTMLInputElement).checked).toBe(false)
      const err = wrapper.find('[data-testid="league-sync-error-lg-1"]')
      expect(err.exists()).toBe(true)
      expect(err.text()).toContain('externalId is required')
    })

    it('disables toggle for archived leagues', async () => {
      mockLeaguesList.mockResolvedValue([league({ id: 'lg-1', status: 'archived' })])
      const wrapper = await mountView()
      const toggle = wrapper.find('[data-testid="league-sync-toggle-lg-1"]')
      expect(toggle.attributes('disabled')).toBeDefined()
    })

    it('disables toggle when externalId is missing', async () => {
      mockLeaguesList.mockResolvedValue([league({ id: 'lg-1', externalId: null })])
      const wrapper = await mountView()
      const toggle = wrapper.find('[data-testid="league-sync-toggle-lg-1"]')
      expect(toggle.attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="league-sync-status-lg-1"]').text()).toContain('externalId')
    })

    it('shows season warning when season is null', async () => {
      mockLeaguesList.mockResolvedValue([league({ id: 'lg-1', season: null })])
      const wrapper = await mountView()
      expect(wrapper.find('[data-testid="league-sync-status-lg-1"]').text()).toContain('season')
    })
  })
})
