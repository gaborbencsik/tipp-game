import { describe, it, expect, vi, afterEach } from 'vitest'
import { useDonationConfig } from './useDonationConfig.js'

const TEMPLATE = 'https://revolut.me/gaborbencsik?currency={currency}&amount={amount}&note={note}'

describe('useDonationConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns configured with amounts when VITE_DONATION_URL is set', () => {
    vi.stubEnv('VITE_DONATION_URL', TEMPLATE)

    const config = useDonationConfig()

    expect(config.isConfigured).toBe(true)
    expect(config.amounts).toHaveLength(3)
    expect(config.amounts[0]).toEqual({
      label: 'Egy sör 🍺 — 1000 Ft',
      amount: '1000',
      url: 'https://revolut.me/gaborbencsik?currency=HUF&amount=100000&note=VB%20Tippj%C3%A1t%C3%A9k%20t%C3%A1mogat%C3%A1s',
    })
    expect(config.amounts[1]).toEqual({
      label: 'Egy kör 🍻 — 2000 Ft',
      amount: '2000',
      url: 'https://revolut.me/gaborbencsik?currency=HUF&amount=200000&note=VB%20Tippj%C3%A1t%C3%A9k%20t%C3%A1mogat%C3%A1s',
    })
    expect(config.amounts[2]).toEqual({
      label: 'VIP páholy 🏟️ — 4000 Ft',
      amount: '4000',
      url: 'https://revolut.me/gaborbencsik?currency=HUF&amount=400000&note=VB%20Tippj%C3%A1t%C3%A9k%20t%C3%A1mogat%C3%A1s',
    })
  })

  it('returns not configured when VITE_DONATION_URL is missing', () => {
    vi.stubEnv('VITE_DONATION_URL', '')

    const config = useDonationConfig()

    expect(config.isConfigured).toBe(false)
    expect(config.amounts).toEqual([])
    expect(config.openAmountUrl).toBeUndefined()
  })

  it('openAmountUrl strips the amount param but keeps currency and note', () => {
    vi.stubEnv('VITE_DONATION_URL', TEMPLATE)

    const config = useDonationConfig()

    expect(config.openAmountUrl).toBe('https://revolut.me/gaborbencsik?currency=HUF&note=VB%20Tippj%C3%A1t%C3%A9k%20t%C3%A1mogat%C3%A1s')
  })
})
