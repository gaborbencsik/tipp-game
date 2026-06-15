import { describe, it, expect } from 'vitest'
import { resolvePlayerDisplayName } from '../src/services/player-display-name.js'

describe('resolvePlayerDisplayName', () => {
  it('keeps the full name when it has 3 or fewer words', () => {
    expect(resolvePlayerDisplayName({ name: 'Agustín Giay', shortName: 'A. Giay' })).toBe('Agustín Giay')
    expect(resolvePlayerDisplayName({ name: 'Alexis Mac Allister', shortName: 'A. Mac Allister' })).toBe('Alexis Mac Allister')
    expect(resolvePlayerDisplayName({ name: 'Franco Mastantuono', shortName: 'Franco Mastantuono' })).toBe('Franco Mastantuono')
  })

  it('uses short_name when the full name has more than 3 words', () => {
    expect(resolvePlayerDisplayName({
      name: 'Damián Emiliano Martínez Romero',
      shortName: 'E. Martínez',
    })).toBe('E. Martínez')
    expect(resolvePlayerDisplayName({
      name: 'Vinícius José Paixão de Oliveira Júnior',
      shortName: 'Vinícius Júnior',
    })).toBe('Vinícius Júnior')
  })

  it('falls back to name when short_name is null even if name is long', () => {
    expect(resolvePlayerDisplayName({
      name: 'Damián Emiliano Martínez Romero',
      shortName: null,
    })).toBe('Damián Emiliano Martínez Romero')
  })

  it('treats consecutive whitespace as a single separator', () => {
    expect(resolvePlayerDisplayName({ name: '  Agustín   Giay  ', shortName: 'A. Giay' })).toBe('  Agustín   Giay  ')
  })

  it('returns short_name when name is empty and short_name exists', () => {
    expect(resolvePlayerDisplayName({ name: '', shortName: 'A. Giay' })).toBe('A. Giay')
  })

  it('returns name when both are present and the cutoff is exactly 3 words', () => {
    expect(resolvePlayerDisplayName({ name: 'A B C', shortName: 'A. C' })).toBe('A B C')
  })

  it('uses short_name at 4 words exactly', () => {
    expect(resolvePlayerDisplayName({ name: 'A B C D', shortName: 'A. D' })).toBe('A. D')
  })
})
