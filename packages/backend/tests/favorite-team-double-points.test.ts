import { describe, it, expect } from 'vitest'
import { applyFavoriteTeamMultiplier } from '../src/services/scoring.service.js'

describe('applyFavoriteTeamMultiplier', () => {
  const MATCH = { homeTeamId: 'team-home', awayTeamId: 'team-away', leagueId: 'league-1' }

  it('returns ×2 when group has doublePoints enabled and user fav team is home team', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-home' }]
    const result = applyFavoriteTeamMultiplier(5, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(10)
  })

  it('returns ×2 when group has doublePoints enabled and user fav team is away team', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-away' }]
    const result = applyFavoriteTeamMultiplier(3, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(6)
  })

  it('returns ×1 when group has doublePoints enabled but fav team is NOT in match', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-other' }]
    const result = applyFavoriteTeamMultiplier(5, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(5)
  })

  it('returns ×1 when group has doublePoints DISABLED even if fav team plays', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-home' }]
    const result = applyFavoriteTeamMultiplier(5, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: false,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(5)
  })

  it('returns ×1 when user has NO favorite team set for the match league', () => {
    const favorites: Array<{ userId: string; leagueId: string; teamId: string }> = []
    const result = applyFavoriteTeamMultiplier(5, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(5)
  })

  it('returns ×1 when match has no leagueId', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-home' }]
    const result = applyFavoriteTeamMultiplier(5, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: { homeTeamId: 'team-home', awayTeamId: 'team-away', leagueId: null },
      userFavorites: favorites,
    })
    expect(result).toBe(5)
  })

  it('returns 0 when base points is 0 (no doubling of zero)', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'league-1', teamId: 'team-home' }]
    const result = applyFavoriteTeamMultiplier(0, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(0)
  })

  it('only considers the favorite for the correct league', () => {
    const favorites = [{ userId: 'user-1', leagueId: 'other-league', teamId: 'team-home' }]
    const result = applyFavoriteTeamMultiplier(5, {
      userId: 'user-1',
      groupFavoriteTeamDoublePoints: true,
      match: MATCH,
      userFavorites: favorites,
    })
    expect(result).toBe(5)
  })
})
