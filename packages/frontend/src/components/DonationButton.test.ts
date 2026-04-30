import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DonationButton from './DonationButton.vue'

const current = vi.hoisted(() => ({
  value: {
    amounts: [
      { label: 'Egy sör 🍺 — 1000 Ft', amount: '1000 Ft', url: 'https://revolut.me/test/1000' },
      { label: 'Egy kör 🍻 — 2000 Ft', amount: '2000 Ft', url: 'https://revolut.me/test/2000' },
      { label: 'VIP páholy 🏟️ — 4000 Ft', amount: '4000 Ft', url: 'https://revolut.me/test/4000' },
    ],
    openAmountUrl: 'https://revolut.me/test' as string | undefined,
    isConfigured: true,
  },
}))

const mockConfigured = {
  amounts: [
    { label: 'Egy sör 🍺 — 1000 Ft', amount: '1000 Ft', url: 'https://revolut.me/test/1000' },
    { label: 'Egy kör 🍻 — 2000 Ft', amount: '2000 Ft', url: 'https://revolut.me/test/2000' },
    { label: 'VIP páholy 🏟️ — 4000 Ft', amount: '4000 Ft', url: 'https://revolut.me/test/4000' },
  ],
  openAmountUrl: 'https://revolut.me/test' as string | undefined,
  isConfigured: true,
}

const mockUnconfigured = {
  amounts: [] as never[],
  openAmountUrl: undefined,
  isConfigured: false,
}

vi.mock('../composables/useDonationConfig.js', () => ({
  useDonationConfig: () => current.value,
}))

describe('DonationButton', () => {
  it('does not render when config is not available', () => {
    current.value = mockUnconfigured

    const wrapper = mount(DonationButton, { props: { sidebarOpen: true } })
    expect(wrapper.find('[data-testid="donation-btn"]').exists()).toBe(false)

    current.value = mockConfigured
  })

  it('renders button when configured and sidebar open', () => {
    const wrapper = mount(DonationButton, { props: { sidebarOpen: true } })

    const btn = wrapper.find('[data-testid="donation-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Fizess egy sört!')
    expect(btn.attributes('title')).toBeUndefined()
  })

  it('shows only emoji with title tooltip when sidebar collapsed', () => {
    const wrapper = mount(DonationButton, { props: { sidebarOpen: false } })

    const btn = wrapper.find('[data-testid="donation-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('🍺')
    expect(btn.attributes('title')).toBe('Fizess egy sört!')
  })

  it('opens modal on click', async () => {
    const wrapper = mount(DonationButton, { props: { sidebarOpen: true } })

    expect(wrapper.find('[data-testid="donation-modal"]').exists()).toBe(false)
    await wrapper.find('[data-testid="donation-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="donation-modal"]').exists()).toBe(true)
  })

  it('closes modal on close event', async () => {
    const wrapper = mount(DonationButton, { props: { sidebarOpen: true } })

    await wrapper.find('[data-testid="donation-btn"]').trigger('click')
    expect(wrapper.find('[data-testid="donation-modal"]').exists()).toBe(true)

    await wrapper.find('[data-testid="donation-dismiss"]').trigger('click')
    expect(wrapper.find('[data-testid="donation-modal"]').exists()).toBe(false)
  })
})
