import { describe, it, expect } from 'vitest'
import {
  TOURNAMENT_BONUS_TYPE_SEEDS,
  TOURNAMENT_BONUS_TYPE_IDS,
  TOURNAMENT_FIRST_KICKOFF_AT,
} from '../src/db/seeds/tournament-bonus-types.js'

describe('tournament-bonus-types seed', () => {
  it('exports exactly 4 seed entries', () => {
    expect(TOURNAMENT_BONUS_TYPE_SEEDS).toHaveLength(4)
  })

  it('every entry has the canonical attribute set required by US-935', () => {
    for (const seed of TOURNAMENT_BONUS_TYPE_SEEDS) {
      expect(seed.inputType).toBe('team_select')
      expect(seed.points).toBe(3)
      expect(seed.isGlobal).toBe(true)
      expect(seed.groupId).toBeNull()
      expect(seed.isActive).toBe(true)
      expect(seed.deadline).toEqual(TOURNAMENT_FIRST_KICKOFF_AT)
      expect(seed.name).toMatch(/.+/)
      expect(seed.description).toMatch(/.+/)
    }
  })

  it('contains 4 team_select × 3p group-stage entries (top scorer covered by sablon)', () => {
    const teamTypes = TOURNAMENT_BONUS_TYPE_SEEDS.filter(s => s.inputType === 'team_select')
    expect(teamTypes).toHaveLength(4)
    expect(teamTypes.every(s => s.points === 3)).toBe(true)
    expect(TOURNAMENT_BONUS_TYPE_SEEDS.some(s => s.inputType === 'player_select')).toBe(false)
  })

  it('uses stable, unique UUIDs (idempotent re-run via ON CONFLICT (id))', () => {
    const ids = TOURNAMENT_BONUS_TYPE_SEEDS.map(s => s.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids).toEqual([
      TOURNAMENT_BONUS_TYPE_IDS.groupStageMostGoalsScored,
      TOURNAMENT_BONUS_TYPE_IDS.groupStageFewestGoalsScored,
      TOURNAMENT_BONUS_TYPE_IDS.groupStageMostGoalsConceded,
      TOURNAMENT_BONUS_TYPE_IDS.groupStageFewestGoalsConceded,
    ])
  })

  it('deadline is the FIFA WC 2026 first kickoff (2026-06-11 02:00 UTC)', () => {
    expect(TOURNAMENT_FIRST_KICKOFF_AT.toISOString()).toBe('2026-06-11T02:00:00.000Z')
  })
})
