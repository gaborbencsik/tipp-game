import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'

vi.mock('@/components/ToastContainer.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/components/ScoringExplainerModal.vue', () => ({
  default: { template: '<div data-testid="scoring-explainer-modal" />' },
}))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, RouterView: { template: '<div />' } }
})

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(App, { global: { plugins: [pinia] } })
}

describe('App — UX-049 scoring-rules feature toggle', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders the scoring-explainer modal when the flag is enabled', () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'true')
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="scoring-explainer-modal"]').exists()).toBe(true)
  })

  it('does not render the scoring-explainer modal when the flag is disabled', () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'false')
    const wrapper = mountApp()
    expect(wrapper.find('[data-testid="scoring-explainer-modal"]').exists()).toBe(false)
  })
})
