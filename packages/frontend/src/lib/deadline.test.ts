import { describe, it, expect } from 'vitest'
import { formatRelativeDeadline } from './deadline.js'

describe('formatRelativeDeadline', () => {
  const now = new Date('2026-06-15T12:00:00Z').getTime()

  it('returns gray "N nap múlva" when >= 48 hours remain', () => {
    const deadline = '2026-06-18T12:00:00Z' // 3 days
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('3 nap múlva')
    expect(result.cssClass).toBe('text-gray-500')
  })

  it('returns amber "N óra múlva" when >= 2h and < 48h remain', () => {
    const deadline = '2026-06-15T20:00:00Z' // 8 hours
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('8 óra múlva')
    expect(result.cssClass).toContain('text-amber-600')
  })

  it('returns red pulsing "N perc múlva" when < 2h remain', () => {
    const deadline = '2026-06-15T13:30:00Z' // 90 minutes
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('90 perc múlva')
    expect(result.cssClass).toContain('text-red-600')
    expect(result.cssClass).toContain('animate-pulse')
  })

  it('returns "Lezárva" when deadline has passed', () => {
    const deadline = '2026-06-15T11:55:00Z' // 5 min ago
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('Lezárva')
    expect(result.cssClass).toBe('text-gray-400')
  })

  it('returns "Lezárva" when deadline is exactly now', () => {
    const deadline = '2026-06-15T12:00:00Z'
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('Lezárva')
  })

  it('returns "2 nap múlva" at exactly 48h boundary', () => {
    const deadline = '2026-06-17T12:00:00Z' // exactly 48h
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('2 nap múlva')
    expect(result.cssClass).toBe('text-gray-500')
  })

  it('returns "2 óra múlva" at exactly 2h boundary', () => {
    const deadline = '2026-06-15T14:00:00Z' // exactly 2h
    const result = formatRelativeDeadline(deadline, now)
    expect(result.label).toBe('2 óra múlva')
    expect(result.cssClass).toContain('text-amber-600')
  })
})
