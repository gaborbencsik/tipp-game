import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ProfileView from '@/views/ProfileView.vue'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/index'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockUpdateProfile, mockSetLeagueFavorite, mockLeaguesList, mockLeagueTeamsForLeague } = vi.hoisted(() => ({
  mockUpdateProfile: vi.fn().mockResolvedValue(undefined),
  mockSetLeagueFavorite: vi.fn().mockResolvedValue(undefined),
  mockLeaguesList: vi.fn().mockResolvedValue([]),
  mockLeagueTeamsForLeague: vi.fn().mockResolvedValue([]),
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
    users: {
      updateProfile: mockUpdateProfile,
      getLeagueFavorites: vi.fn().mockResolvedValue([]),
      setLeagueFavorite: mockSetLeagueFavorite,
    },
    leagues: { list: mockLeaguesList },
    leagueTeams: { forLeague: mockLeagueTeamsForLeague },
    matches: { list: vi.fn() },
    predictions: { mine: vi.fn(), upsert: vi.fn() },
    admin: {
      teams: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
      matches: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), setResult: vi.fn() },
    },
  },
}))

const MOCK_USER: User = {
  id: 'user-1',
  supabaseId: 'supa-1',
  email: 'test@example.com',
  displayName: 'Test User',
  avatarUrl: 'https://example.com/avatar.png',
  role: 'user',
  onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
}

function buildRouter() {
  return buildTestRouter({ '/app/profile': ProfileView })
}

async function mountView(user: User | null = MOCK_USER) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useAuthStore()
  store.user = user
  const wrapper = mount(ProfileView, { global: { plugins: [pinia, buildRouter()] } })
  await flushPromises()
  return { wrapper, store }
}

describe('ProfileView', () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset().mockResolvedValue(undefined)
    setActivePinia(createPinia())
  })

  it('shows user email (readonly)', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="email"]').text()).toBe('test@example.com')
  })

  it('pre-fills displayName input with current value', async () => {
    const { wrapper } = await mountView()
    const input = wrapper.find('[data-testid="displayName-input"]').element as HTMLInputElement
    expect(input.value).toBe('Test User')
  })

  it('shows avatar when avatarUrl is set', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.find('[data-testid="avatar"]').exists()).toBe(true)
  })

  it('save button → calls authStore.updateProfile with trimmed displayName', async () => {
    const { wrapper, store } = await mountView()
    const updateSpy = vi.spyOn(store, 'updateProfile').mockResolvedValue()

    const vm = wrapper.vm as unknown as { displayName: string; save: () => Promise<void> }
    vm.displayName = '  New Name  '
    await vm.save()
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledWith('New Name')
  })

  it('successful save → shows success message', async () => {
    const { wrapper, store } = await mountView()
    vi.spyOn(store, 'updateProfile').mockResolvedValue()

    const vm = wrapper.vm as unknown as { save: () => Promise<void> }
    await vm.save()
    await flushPromises()

    expect(wrapper.find('[data-testid="save-success"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error-banner"]').exists()).toBe(false)
  })

  it('failed save → shows error message', async () => {
    const { wrapper, store } = await mountView()
    vi.spyOn(store, 'updateProfile').mockRejectedValue(new Error('Server error'))

    const vm = wrapper.vm as unknown as { save: () => Promise<void> }
    await vm.save()
    await flushPromises()

    expect(wrapper.find('[data-testid="error-banner"]').text()).toBe('Server error')
    expect(wrapper.find('[data-testid="save-success"]').exists()).toBe(false)
  })

  it('back link points to /matches', async () => {
    const { wrapper } = await mountView()
    const link = wrapper.find('a[href="/app/matches"]')
    expect(link.exists()).toBe(true)
  })

  // ─── Favorite save feedback ──────────────────────────────────────────────────

  it('successful favorite save → shows "Elmentve ✓"', async () => {
    mockLeaguesList.mockResolvedValue([
      { id: 'l1', name: 'NB I', shortName: 'NB I', createdAt: '', updatedAt: '' },
    ])
    mockLeagueTeamsForLeague.mockResolvedValue([
      { id: 't1', name: 'Ferencváros', shortCode: 'FTC' },
      { id: 't2', name: 'Újpest FC', shortCode: 'UJP' },
    ])
    mockSetLeagueFavorite.mockResolvedValue({ id: 'fav-1', userId: 'user-1', leagueId: 'l1', teamId: 't1', setAt: '', isLocked: false })

    const { wrapper } = await mountView()
    await flushPromises()

    const select = wrapper.find('[data-testid="fav-select-l1"]')
    await select.setValue('t1')
    await flushPromises()

    expect(wrapper.find('[data-testid="fav-saved-l1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fav-saved-l1"]').text()).toContain('Elmentve')
  })

  it('failed favorite save → shows error', async () => {
    mockLeaguesList.mockResolvedValue([
      { id: 'l1', name: 'NB I', shortName: 'NB I', createdAt: '', updatedAt: '' },
    ])
    mockLeagueTeamsForLeague.mockResolvedValue([
      { id: 't1', name: 'Ferencváros', shortCode: 'FTC' },
    ])
    mockSetLeagueFavorite.mockRejectedValue(new Error('Lock error'))

    const { wrapper } = await mountView()
    await flushPromises()

    const select = wrapper.find('[data-testid="fav-select-l1"]')
    await select.setValue('t1')
    await flushPromises()

    expect(wrapper.find('[data-testid="fav-error-l1"]').exists()).toBe(true)
  })

  it('favorite select is disabled during save', async () => {
    mockLeaguesList.mockResolvedValue([
      { id: 'l1', name: 'NB I', shortName: 'NB I', createdAt: '', updatedAt: '' },
    ])
    mockLeagueTeamsForLeague.mockResolvedValue([
      { id: 't1', name: 'Ferencváros', shortCode: 'FTC' },
    ])
    let resolveSave!: (v: unknown) => void
    mockSetLeagueFavorite.mockReturnValue(new Promise(r => { resolveSave = r }))

    const { wrapper } = await mountView()
    await flushPromises()

    const select = wrapper.find('[data-testid="fav-select-l1"]')
    await select.setValue('t1')
    await wrapper.vm.$nextTick()

    expect((wrapper.find('[data-testid="fav-select-l1"]').element as HTMLSelectElement).disabled).toBe(true)

    resolveSave({ id: 'fav-1', userId: 'user-1', leagueId: 'l1', teamId: 't1', setAt: '', isLocked: false })
    await flushPromises()

    expect((wrapper.find('[data-testid="fav-select-l1"]').element as HTMLSelectElement).disabled).toBe(false)
  })
})
