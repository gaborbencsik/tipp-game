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

describe('OnboardingOverlay', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders step 0 initially', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="step-0"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="step-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="step-2"]').exists()).toBe(false)
  })

  it('shows 3 progress dots', () => {
    const wrapper = mountOverlay()
    expect(wrapper.findAll('[data-testid="progress-dot"]')).toHaveLength(3)
  })

  it('next button advances from step 0 to step 1', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    expect(wrapper.find('[data-testid="step-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="step-0"]').exists()).toBe(false)
  })

  it('next button advances from step 1 to step 2', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    expect(wrapper.find('[data-testid="step-2"]').exists()).toBe(true)
  })

  it('skip button emits complete event on step 0', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="skip-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('skip button emits complete event on step 1', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="skip-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('Escape key emits complete event', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="onboarding-overlay"]').trigger('keydown.escape')
    // The keydown listener is on document, so we trigger it there
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('step 2: create group button emits complete and navigates', async () => {
    const wrapper = mountOverlay()
    // Go to step 2
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    // Click create group
    await wrapper.find('[data-testid="create-group-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mockPush).toHaveBeenCalledWith('/app/groups?action=create')
  })

  it('step 2: join group button emits complete and navigates', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="join-group-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mockPush).toHaveBeenCalledWith('/app/groups?action=join')
  })

  it('step 2: later button emits complete and navigates to matches', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="next-button"]').trigger('click')
    await wrapper.find('[data-testid="later-button"]').trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(mockPush).toHaveBeenCalledWith('/app/matches')
  })

  it('has aria-modal and role dialog', () => {
    const wrapper = mountOverlay()
    const overlay = wrapper.find('[data-testid="onboarding-overlay"]')
    expect(overlay.attributes('role')).toBe('dialog')
    expect(overlay.attributes('aria-modal')).toBe('true')
  })
})
