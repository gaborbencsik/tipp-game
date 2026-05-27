import { describe, it, expect } from 'vitest'
import { toApiInsight } from '../src/services/insights/api.formatter.js'

const BASE = {
  type: 'defense',
  data: { title: 'Strong defense', body: 'Conceded 0.73/match.', dataPoints: { home_clean_sheets: 12 } },
  titleHu: null,
  bodyHu: null,
  translatedAt: null,
}

describe('api.formatter.toApiInsight', () => {
  it('returns Hungarian fields when translation exists', () => {
    const result = toApiInsight({
      ...BASE,
      titleHu: 'Erős védelem',
      bodyHu: 'Mérkőzésenként 0.73 gólt kaptak.',
      translatedAt: new Date('2026-05-25T12:00:00.000Z'),
    })
    expect(result.titleHu).toBe('Erős védelem')
    expect(result.bodyHu).toBe('Mérkőzésenként 0.73 gólt kaptak.')
    expect(result.translatedAt).toBe('2026-05-25T12:00:00.000Z')
  })

  it('falls back to English title/body when translation is null', () => {
    const result = toApiInsight(BASE)
    expect(result.titleHu).toBe('Strong defense')
    expect(result.bodyHu).toBe('Conceded 0.73/match.')
    expect(result.translatedAt).toBeNull()
  })

  it('falls back per-field if only one Hungarian side is missing', () => {
    const result = toApiInsight({ ...BASE, titleHu: 'Erős védelem', bodyHu: null })
    expect(result.titleHu).toBe('Erős védelem')
    expect(result.bodyHu).toBe('Conceded 0.73/match.')
  })

  it('preserves dataPoints (English snake_case keys, numeric values)', () => {
    const result = toApiInsight(BASE)
    expect(result.dataPoints).toEqual({ home_clean_sheets: 12 })
  })

  it('drops non-numeric dataPoints values defensively', () => {
    const result = toApiInsight({
      ...BASE,
      data: { title: 'T', body: 'B', dataPoints: { ok: 5, bad: 'oops' } },
    })
    expect(result.dataPoints).toEqual({ ok: 5 })
  })

  it('handles malformed data gracefully (empty title/body, empty dataPoints)', () => {
    const result = toApiInsight({ ...BASE, data: null })
    expect(result.title).toBe('')
    expect(result.body).toBe('')
    expect(result.dataPoints).toEqual({})
    expect(result.titleHu).toBe('')
  })
})
