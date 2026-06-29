import { describe, it, expect } from 'vitest'
import { TOURNAMENT_POINTS, scoreGroupExact } from './tournamentPoints'

describe('TOURNAMENT_POINTS', () => {
  it('mirrors the backend constants from plans/05-tournament-scoring.md §4', () => {
    expect(TOURNAMENT_POINTS.perGroup).toBe(3)
    expect(TOURNAMENT_POINTS.perTeam.last_32).toBe(2)
    expect(TOURNAMENT_POINTS.perTeam.last_16).toBe(3)
    expect(TOURNAMENT_POINTS.perTeam.qf).toBe(4)
    expect(TOURNAMENT_POINTS.perTeam.sf).toBe(6)
    expect(TOURNAMENT_POINTS.perTeam.final).toBe(8)
    expect(TOURNAMENT_POINTS.perTeam.champion).toBe(10)
  })
})

describe('scoreGroupExact', () => {
  it('returns perGroup on exact position match', () => {
    expect(scoreGroupExact(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(3)
  })

  it('returns 0 on any deviation', () => {
    expect(scoreGroupExact(['a', 'b', 'c', 'd'], ['a', 'c', 'b', 'd'])).toBe(0)
  })

  it('returns 0 when the user pick has a null', () => {
    expect(scoreGroupExact(['a', null, 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(0)
  })

  it('returns 0 when the correct answer has a null (incomplete official)', () => {
    expect(scoreGroupExact(['a', 'b', 'c', 'd'], ['a', 'b', 'c', null])).toBe(0)
  })

  it('returns 0 when either argument is missing', () => {
    expect(scoreGroupExact(null, ['a', 'b', 'c', 'd'])).toBe(0)
    expect(scoreGroupExact(['a', 'b', 'c', 'd'], null)).toBe(0)
  })

  it('returns 0 when the array lengths differ', () => {
    expect(scoreGroupExact(['a', 'b', 'c'], ['a', 'b', 'c', 'd'])).toBe(0)
  })
})
