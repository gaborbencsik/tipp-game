import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import { buildTestRouter } from '@/test-utils/router'

const mockPush = vi.fn().mockResolvedValue(undefined)
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  }
})

const mockGetSession = vi.fn()
const mockUpdateUser = vi.fn()
const mockVerifyOtp = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

function buildRouter() {
  return buildTestRouter({})
}

function mountView() {
  return mount(ResetPasswordView, {
    global: { plugins: [createPinia(), buildRouter()] },
  })
}

async function mountViewWithQuery(query: Record<string, string>) {
  const router = buildRouter()
  router.addRoute({ path: '/auth/reset-password', component: ResetPasswordView })
  await router.push({ path: '/auth/reset-password', query })
  await router.isReady()
  return mount(ResetPasswordView, {
    global: { plugins: [createPinia(), router] },
  })
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
    mockGetSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    mockUpdateUser.mockReset().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockVerifyOtp.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders two password inputs and a submit button', async () => {
    const wrapper = mountView()
    await flushPromises()
    const inputs = wrapper.findAll('input[type="password"]')
    expect(inputs.length).toBe(2)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="locale-toggle-hu"]').exists()).toBe(true)
  })

  it('shows the localized title and subtitle', async () => {
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('Jelszó helyreállítása')
  })

  it('password shorter than 8 chars → inline error and no API call', async () => {
    const wrapper = mountView()
    await flushPromises()
    const [pw, confirm] = wrapper.findAll('input[type="password"]')
    await pw.setValue('abc')
    await confirm.setValue('abc')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Legalább 8 karakternek kell lennie')
  })

  it('passwords do not match → inline error and no API call', async () => {
    const wrapper = mountView()
    await flushPromises()
    const [pw, confirm] = wrapper.findAll('input[type="password"]')
    await pw.setValue('password123')
    await confirm.setValue('password456')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('jelszavak nem egyeznek')
  })

  it('no recovery session → link expired error shown and inputs disabled', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.text()).toContain('helyreállítási link lejárt')
    const inputs = wrapper.findAll('input[type="password"]')
    inputs.forEach((i) => expect(i.attributes('disabled')).toBeDefined())
    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('successful submit → updateUser called and redirects to /app/matches', async () => {
    const wrapper = mountView()
    await flushPromises()
    const [pw, confirm] = wrapper.findAll('input[type="password"]')
    await pw.setValue('password123')
    await confirm.setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'password123' })
    expect(wrapper.text()).toContain('Jelszó sikeresen beállítva')
    await vi.runAllTimersAsync()
    expect(mockPush).toHaveBeenCalledWith('/app/matches')
  })

  it('weak password error from Supabase → weak password message shown', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Password should be stronger', name: 'AuthApiError' },
    })
    const wrapper = mountView()
    await flushPromises()
    const [pw, confirm] = wrapper.findAll('input[type="password"]')
    await pw.setValue('password123')
    await confirm.setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('biztonsági követelményeknek')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('generic error from Supabase → generic error message shown', async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Network failure', name: 'AuthError' },
    })
    const wrapper = mountView()
    await flushPromises()
    const [pw, confirm] = wrapper.findAll('input[type="password"]')
    await pw.setValue('password123')
    await confirm.setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Hiba történt')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('?token_hash + type=recovery → calls verifyOtp and enables form on success', async () => {
    const wrapper = await mountViewWithQuery({ token_hash: 'abc123', type: 'recovery' })
    await flushPromises()
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123', type: 'recovery' })
    expect(mockGetSession).not.toHaveBeenCalled()
    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('?token_hash + type=recovery with verifyOtp error → link expired and form disabled', async () => {
    mockVerifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'token expired', name: 'AuthError' } })
    const wrapper = await mountViewWithQuery({ token_hash: 'expired', type: 'recovery' })
    await flushPromises()
    expect(wrapper.text()).toContain('helyreállítási link lejárt')
    const button = wrapper.find('button[type="submit"]')
    expect(button.attributes('disabled')).toBeDefined()
  })
})
