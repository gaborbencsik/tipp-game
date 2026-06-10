import { describe, it, expect } from 'vitest'
import { formatMarketValueEur } from './formatMarketValue.js'

describe('formatMarketValueEur — HU locale', () => {
  it('0 → "0 €"', () => {
    expect(formatMarketValueEur(0, 'hu')).toBe('0 €')
  })

  it('1 → "<1 M €"', () => {
    expect(formatMarketValueEur(1, 'hu')).toBe('<1 M €')
  })

  it('999_999 → "<1 M €"', () => {
    expect(formatMarketValueEur(999_999, 'hu')).toBe('<1 M €')
  })

  it('1_000_000 → "1 M €"', () => {
    expect(formatMarketValueEur(1_000_000, 'hu')).toBe('1 M €')
  })

  it('45_000_000 → "45 M €"', () => {
    expect(formatMarketValueEur(45_000_000, 'hu')).toBe('45 M €')
  })

  it('850_000_000 → "850 M €"', () => {
    expect(formatMarketValueEur(850_000_000, 'hu')).toBe('850 M €')
  })

  it('999_000_000 → "999 M €"', () => {
    expect(formatMarketValueEur(999_000_000, 'hu')).toBe('999 M €')
  })

  it('1_000_000_000 → "1 mrd €" (no trailing decimal)', () => {
    expect(formatMarketValueEur(1_000_000_000, 'hu')).toBe('1 mrd €')
  })

  it('1_200_000_000 → "1,2 mrd €"', () => {
    expect(formatMarketValueEur(1_200_000_000, 'hu')).toBe('1,2 mrd €')
  })

  it('999_000_000_000 → "999 mrd €"', () => {
    expect(formatMarketValueEur(999_000_000_000, 'hu')).toBe('999 mrd €')
  })
})

describe('formatMarketValueEur — EN locale', () => {
  it('0 → "€0"', () => {
    expect(formatMarketValueEur(0, 'en')).toBe('€0')
  })

  it('1 → "<€1M"', () => {
    expect(formatMarketValueEur(1, 'en')).toBe('<€1M')
  })

  it('999_999 → "<€1M"', () => {
    expect(formatMarketValueEur(999_999, 'en')).toBe('<€1M')
  })

  it('850_000_000 → "€850M"', () => {
    expect(formatMarketValueEur(850_000_000, 'en')).toBe('€850M')
  })

  it('1_000_000_000 → "€1B"', () => {
    expect(formatMarketValueEur(1_000_000_000, 'en')).toBe('€1B')
  })

  it('1_200_000_000 → "€1.2B"', () => {
    expect(formatMarketValueEur(1_200_000_000, 'en')).toBe('€1.2B')
  })
})
