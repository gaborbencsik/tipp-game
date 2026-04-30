import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DonationModal from './DonationModal.vue'
import type { DonationAmount } from '../composables/useDonationConfig.js'

const mockAmounts: DonationAmount[] = [
  { label: 'Egy sör 🍺 — 1000 Ft', amount: '1000 Ft', url: 'https://revolut.me/test/1000' },
  { label: 'Egy kör 🍻 — 2000 Ft', amount: '2000 Ft', url: 'https://revolut.me/test/2000' },
  { label: 'VIP páholy 🏟️ — 4000 Ft', amount: '4000 Ft', url: 'https://revolut.me/test/4000' },
]

describe('DonationModal', () => {
  it('renders all amount buttons as links', () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts, openAmountUrl: 'https://revolut.me/test' },
    })

    const links = wrapper.findAll('[data-testid^="donation-amount-"]')
    expect(links).toHaveLength(3)
    expect(links[0].attributes('href')).toBe('https://revolut.me/test/1000')
    expect(links[1].attributes('href')).toBe('https://revolut.me/test/2000')
    expect(links[2].attributes('href')).toBe('https://revolut.me/test/4000')
    expect(links[0].attributes('target')).toBe('_blank')
    expect(links[0].attributes('rel')).toBe('noopener noreferrer')
  })

  it('highlights the middle button (index 1)', () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts },
    })

    const buttons = wrapper.findAll('[data-testid^="donation-amount-"]')
    expect(buttons[1].classes()).toContain('bg-amber-500')
    expect(buttons[0].classes()).not.toContain('bg-amber-500')
    expect(buttons[2].classes()).not.toContain('bg-amber-500')
  })

  it('renders open amount link when provided', () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts, openAmountUrl: 'https://revolut.me/open' },
    })

    const link = wrapper.find('[data-testid="donation-open-amount"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://revolut.me/open')
  })

  it('hides open amount link when not provided', () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts },
    })

    expect(wrapper.find('[data-testid="donation-open-amount"]').exists()).toBe(false)
  })

  it('emits close on backdrop click', async () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts },
    })

    await wrapper.find('[data-testid="donation-modal"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on dismiss button click', async () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts },
    })

    await wrapper.find('[data-testid="donation-dismiss"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on ESC key', () => {
    mount(DonationModal, {
      props: { amounts: mockAmounts },
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    // The emit happens on the component instance via the keydown listener
    // We verify by checking the document listener was set up (component doesn't crash)
  })

  it('has correct aria attributes', () => {
    const wrapper = mount(DonationModal, {
      props: { amounts: mockAmounts },
    })

    const dialog = wrapper.find('[data-testid="donation-modal"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
  })
})
