import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import OnboardingOverlay from '@/components/OnboardingOverlay.vue'
import { buildTestRouter } from '@/test-utils/router'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

function buildRouter() {
  return buildTestRouter()
}

function mountOverlay() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(OnboardingOverlay, {
    global: { plugins: [pinia, buildRouter()] },
  })
}

async function clickNext(wrapper: ReturnType<typeof mountOverlay>): Promise<void> {
  await wrapper.find('[data-testid="next-button"]').trigger('click')
}

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders step 0 (welcome) initially', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="step-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="step-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="step-4"]').exists()).toBe(false)
  })

  it('shows 5 progress dots', () => {
    const wrapper = mountOverlay()
    expect(wrapper.findAll('[data-testid="progress-dot"]')).toHaveLength(5)
  })

  it('shows step counter "1/5" on first step', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="step-counter"]').text()).toBe('1/5')
  })

  it('next button advances step by step from 0 to 4', async () => {
    const wrapper = mountOverlay()
    await clickNext(wrapper)
    expect(wrapper.find('[data-testid="step-1"]').exists()).toBe(true)
    await clickNext(wrapper)
    expect(wrapper.find('[data-testid="step-2"]').exists()).toBe(true)
    await clickNext(wrapper)
    expect(wrapper.find('[data-testid="step-3"]').exists()).toBe(true)
    await clickNext(wrapper)
    expect(wrapper.find('[data-testid="step-4"]').exists()).toBe(true)
  })

  it('back button is hidden on step 0', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="back-button"]').exists()).toBe(false)
  })

  it('back button is visible on step 1+ and goes back', async () => {
    const wrapper = mountOverlay()
    await clickNext(wrapper)
    expect(wrapper.find('[data-testid="back-button"]').exists()).toBe(true)
    await wrapper.find('[data-testid="back-button"]').trigger('click')
    expect(wrapper.find('[data-testid="step-0"]').exists()).toBe(true)
  })

  it('skip button emits complete event on step 0', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="skip-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('skip button emits complete event on later steps', async () => {
    const wrapper = mountOverlay()
    await clickNext(wrapper)
    await clickNext(wrapper)
    await wrapper.find('[data-testid="skip-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('Escape key emits complete event', async () => {
    const wrapper = mountOverlay()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('step 4 (hub): primary CTA emits complete and navigates to /app/matches', async () => {
    const wrapper = mountOverlay()
    await clickNext(wrapper)
    await clickNext(wrapper)
    await clickNext(wrapper)
    await clickNext(wrapper)
    expect(wrapper.find('[data-testid="step-4"]').exists()).toBe(true)
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mockPush).toHaveBeenCalledWith('/app/matches')
  })

  it('step 4 (hub): card click emits complete and navigates to its route', async () => {
    const wrapper = mountOverlay()
    await clickNext(wrapper)
    await clickNext(wrapper)
    await clickNext(wrapper)
    await clickNext(wrapper)
    await wrapper.find('[data-testid="hub-card-profile"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mockPush).toHaveBeenCalledWith('/app/profile')
  })

  it('step 4 (hub): groups card navigates to /app/groups', async () => {
    const wrapper = mountOverlay()
    await clickNext(wrapper)
    await clickNext(wrapper)
    await clickNext(wrapper)
    await clickNext(wrapper)
    await wrapper.find('[data-testid="hub-card-groups"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mockPush).toHaveBeenCalledWith('/app/groups')
  })

  it('has aria-modal and role dialog', () => {
    const wrapper = mountOverlay()
    const overlay = wrapper.find('[data-testid="onboarding-overlay"]')
    expect(overlay.attributes('role')).toBe('dialog')
    expect(overlay.attributes('aria-modal')).toBe('true')
  })

  it('exposes aria-live region with current step label', async () => {
    const wrapper = mountOverlay()
    const live = wrapper.find('[data-testid="step-aria-live"]')
    expect(live.exists()).toBe(true)
    expect(live.attributes('aria-live')).toBe('polite')
  })

  it('does not expose any deprecated step-2 group action buttons', async () => {
    const wrapper = mountOverlay()
    // Walk through all 5 steps; none should have action CTAs
    for (let i = 0; i < 5; i++) {
      expect(wrapper.find('[data-testid="create-group-button"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="join-group-button"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="later-button"]').exists()).toBe(false)
      if (i < 4) await clickNext(wrapper)
    }
  })
})
