import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ProfileView from '@/views/ProfileView.vue'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/index'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: vi.fn() }) }
})

const { mockUpdateProfile } = vi.hoisted(() => ({
  mockUpdateProfile: vi.fn().mockResolvedValue(undefined),
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
    users: { updateProfile: mockUpdateProfile },
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
}

function buildRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/profile', component: ProfileView },
      { path: '/app/matches', component: { template: '<div />' } },
    ],
  })
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
})
