import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarketValuesBar from './MarketValuesBar.vue'

const HOME_BASE = {
  name: 'Hungary',
  shortCode: 'HUN',
  flagUrl: 'https://example.com/hun.png',
  marketValueEur: 200_000_000,
  transfermarktId: 3437,
}

const AWAY_BASE = {
  name: 'Germany',
  shortCode: 'GER',
  flagUrl: 'https://example.com/ger.png',
  marketValueEur: 1_000_000_000,
  transfermarktId: 3262,
}

describe('MarketValuesBar', () => {
  it('renders block with both rows when both values present', () => {
    const wrapper = mount(MarketValuesBar, {
      props: { homeTeam: HOME_BASE, awayTeam: AWAY_BASE },
    })
    expect(wrapper.find('[data-testid="market-values-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="market-values-home-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="market-values-away-bar"]').exists()).toBe(true)
  })

  it('hides entire block when both market values are null', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, marketValueEur: null, transfermarktId: null },
        awayTeam: { ...AWAY_BASE, marketValueEur: null, transfermarktId: null },
      },
    })
    expect(wrapper.find('[data-testid="market-values-section"]').exists()).toBe(false)
  })

  it('exact bar widths reflect linear ratio (300M / 700M → 30% / 70%)', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, marketValueEur: 300_000_000 },
        awayTeam: { ...AWAY_BASE, marketValueEur: 700_000_000 },
      },
    })
    const homeBar = wrapper.find('[data-testid="market-values-home-bar"]')
    const awayBar = wrapper.find('[data-testid="market-values-away-bar"]')
    expect(homeBar.attributes('style')).toContain('width: 30%')
    expect(awayBar.attributes('style')).toContain('width: 70%')
  })

  it('chip is not rendered (concrete values shown only)', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, marketValueEur: 100_000_000 },
        awayTeam: { ...AWAY_BASE, marketValueEur: 240_000_000 },
      },
    })
    expect(wrapper.find('[data-testid="market-values-home-chip"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="market-values-away-chip"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="market-values-home-value"]').text()).toBe('100 M €')
    expect(wrapper.find('[data-testid="market-values-away-value"]').text()).toBe('240 M €')
  })

  it('home null → home shows "—", empty bar; away still rendered', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, marketValueEur: null, transfermarktId: null },
        awayTeam: { ...AWAY_BASE, marketValueEur: 500_000_000 },
      },
    })
    expect(wrapper.find('[data-testid="market-values-section"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="market-values-home-value"]').text()).toBe('—')
    expect(wrapper.find('[data-testid="market-values-home-bar"]').exists()).toBe(false)
  })

  it('away null → away shows "—", empty bar', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, marketValueEur: 500_000_000 },
        awayTeam: { ...AWAY_BASE, marketValueEur: null, transfermarktId: null },
      },
    })
    expect(wrapper.find('[data-testid="market-values-away-value"]').text()).toBe('—')
    expect(wrapper.find('[data-testid="market-values-away-bar"]').exists()).toBe(false)
  })

  it('team name link uses transfermarkt URL with slug + id when transfermarktId is present', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, name: 'Mexico', transfermarktId: 6303 },
        awayTeam: AWAY_BASE,
      },
    })
    const homeName = wrapper.find('[data-testid="market-values-home-name"]')
    expect(homeName.element.tagName).toBe('A')
    expect(homeName.attributes('href')).toBe('https://www.transfermarkt.com/mexico/startseite/verein/6303')
    expect(homeName.attributes('target')).toBe('_blank')
    expect(homeName.attributes('rel')).toBe('noopener noreferrer')
  })

  it('slug strips diacritics and collapses whitespace', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, name: 'São Paulo', transfermarktId: 999 },
        awayTeam: AWAY_BASE,
      },
    })
    const homeName = wrapper.find('[data-testid="market-values-home-name"]')
    expect(homeName.attributes('href')).toBe('https://www.transfermarkt.com/sao-paulo/startseite/verein/999')
  })

  it('team name is plain span when transfermarktId is null', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, transfermarktId: null },
        awayTeam: AWAY_BASE,
      },
    })
    const homeName = wrapper.find('[data-testid="market-values-home-name"]')
    expect(homeName.element.tagName).toBe('SPAN')
  })

  it('aria-label on bar contains team name + formatted value', () => {
    const wrapper = mount(MarketValuesBar, {
      props: {
        homeTeam: { ...HOME_BASE, marketValueEur: 850_000_000 },
        awayTeam: AWAY_BASE,
      },
    })
    const bar = wrapper.find('[data-testid="market-values-home-bar"]')
    expect(bar.attributes('aria-label')).toBe('Hungary piaci értéke 850 M €')
  })
})
