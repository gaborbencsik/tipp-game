import { describe, it, expect } from 'vitest'
import { computeTypeMaxPoints, type SpecialPredictionTypeLike } from '../src/services/tournament-max.service.js'
import { TOURNAMENT_POINTS } from '../src/services/tournament-scoring.constants.js'

function typeOf(overrides: Partial<SpecialPredictionTypeLike>): SpecialPredictionTypeLike {
  return {
    inputType: 'text',
    options: null,
    points: 0,
    correctAnswer: null,
    ...overrides,
  }
}

describe('computeTypeMaxPoints', () => {
  describe('all_groups_standing', () => {
    const options = { groups: ['A', 'B', 'C'], teamsPerGroup: 4, best3rdPicks: 0 }

    it('returns 0 when correctAnswer is null / empty', () => {
      expect(computeTypeMaxPoints(typeOf({ inputType: 'all_groups_standing', options }))).toBe(0)
      expect(computeTypeMaxPoints(typeOf({ inputType: 'all_groups_standing', options, correctAnswer: '' }))).toBe(0)
    })

    it('counts only fully-populated groups (all positions non-null)', () => {
      const correctAnswer = JSON.stringify({
        groups: {
          A: ['t1', 't2', 't3', 't4'],           // complete → 3p
          B: ['t5', 't6', null, 't8'],            // partial → 0p
          C: ['t9', 't10', 't11', 't12'],         // complete → 3p
        },
        best3rds: [],
      })
      expect(computeTypeMaxPoints(typeOf({ inputType: 'all_groups_standing', options, correctAnswer }))).toBe(
        2 * TOURNAMENT_POINTS.perGroup,
      )
    })

    it('12 fully-populated groups → 12 × perGroup (36 by default)', () => {
      const codes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
      const opts = { groups: codes, teamsPerGroup: 4, best3rdPicks: 0 }
      const groups: Record<string, string[]> = {}
      for (const c of codes) groups[c] = [`${c}1`, `${c}2`, `${c}3`, `${c}4`]
      const correctAnswer = JSON.stringify({ groups, best3rds: [] })
      expect(computeTypeMaxPoints(typeOf({ inputType: 'all_groups_standing', options: opts, correctAnswer }))).toBe(
        12 * TOURNAMENT_POINTS.perGroup,
      )
    })

    it('malformed JSON → 0', () => {
      expect(computeTypeMaxPoints(typeOf({ inputType: 'all_groups_standing', options, correctAnswer: 'nope' }))).toBe(0)
    })
  })

  describe('bracket_progression', () => {
    it('returns 0 for empty / null correctAnswer', () => {
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression' }))).toBe(0)
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression', correctAnswer: '' }))).toBe(0)
    })

    it('participants shape: only last_32 populated → 32p (16 teams × 2)', () => {
      const participants = {
        last_32: Array.from({ length: 32 }, (_, i) => `t${i}`), // 32 slots (16 matches × 2)
        last_16: [], qf: [], sf: [], final: [],
      }
      const correctAnswer = JSON.stringify({ participants, champion: null, bronzeWinner: null })
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression', correctAnswer }))).toBe(
        32 * TOURNAMENT_POINTS.perTeam.last_32,
      )
    })

    it('participants shape: last_32 + last_16 populated', () => {
      const participants = {
        last_32: Array.from({ length: 32 }, (_, i) => `t${i}`),
        last_16: Array.from({ length: 16 }, (_, i) => `w${i}`),
        qf: [], sf: [], final: [],
      }
      const correctAnswer = JSON.stringify({ participants, champion: null, bronzeWinner: null })
      const expected =
        32 * TOURNAMENT_POINTS.perTeam.last_32 +
        16 * TOURNAMENT_POINTS.perTeam.last_16
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression', correctAnswer }))).toBe(expected)
    })

    it('participants shape: full bracket with champion set', () => {
      const participants = {
        last_32: Array.from({ length: 32 }, (_, i) => `t${i}`),
        last_16: Array.from({ length: 16 }, (_, i) => `w${i}`),
        qf: Array.from({ length: 8 }, (_, i) => `q${i}`),
        sf: Array.from({ length: 4 }, (_, i) => `s${i}`),
        final: Array.from({ length: 2 }, (_, i) => `f${i}`),
      }
      const correctAnswer = JSON.stringify({ participants, champion: 'champ', bronzeWinner: null })
      const expected =
        32 * TOURNAMENT_POINTS.perTeam.last_32 +
        16 * TOURNAMENT_POINTS.perTeam.last_16 +
        8 * TOURNAMENT_POINTS.perTeam.qf +
        4 * TOURNAMENT_POINTS.perTeam.sf +
        2 * TOURNAMENT_POINTS.perTeam.final +
        TOURNAMENT_POINTS.perTeam.champion
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression', correctAnswer }))).toBe(expected)
    })

    it('legacy winners-map shape falls back to 0 (unknown per-round contribution)', () => {
      const correctAnswer = JSON.stringify({ winners: { l32_m1: 'ta' } })
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression', correctAnswer }))).toBe(0)
    })

    it('malformed JSON → 0', () => {
      expect(computeTypeMaxPoints(typeOf({ inputType: 'bracket_progression', correctAnswer: '{{' }))).toBe(0)
    })
  })

  describe('multi_team_weighted', () => {
    it('sums the top-maxPicks choice points', () => {
      const options = {
        maxPicks: 2,
        minPicks: 2,
        choices: [
          { teamId: 't1', points: 4 },
          { teamId: 't2', points: 18 },
          { teamId: 't3', points: 10 },
          { teamId: 't4', points: 2 },
        ],
      }
      // Non-empty correctAnswer required for the leaderboard filter, but the value itself does
      // not gate the max for this type (max is a static function of options.choices).
      expect(
        computeTypeMaxPoints(typeOf({ inputType: 'multi_team_weighted', options, correctAnswer: '[]' })),
      ).toBe(18 + 10)
    })

    it('missing / invalid options → 0', () => {
      expect(computeTypeMaxPoints(typeOf({ inputType: 'multi_team_weighted', options: null, correctAnswer: '[]' }))).toBe(0)
    })
  })

  describe('simple types', () => {
    it('text / dropdown / team_select / player_select / number → uses type.points', () => {
      for (const inputType of ['text', 'dropdown', 'team_select', 'player_select', 'number'] as const) {
        expect(computeTypeMaxPoints(typeOf({ inputType, points: 5, correctAnswer: 'x' }))).toBe(5)
      }
    })

    it('multi_team_select → uses type.points', () => {
      expect(computeTypeMaxPoints(typeOf({ inputType: 'multi_team_select', points: 7, correctAnswer: '["a"]' }))).toBe(7)
    })
  })

  describe('regression: reported 60/6 → should be 60/100', () => {
    it('12 groups fully populated (36) + last_32 populated (64) = 100', () => {
      const codes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']
      const opts = { groups: codes, teamsPerGroup: 4, best3rdPicks: 0 }
      const groups: Record<string, string[]> = {}
      for (const c of codes) groups[c] = [`${c}1`, `${c}2`, `${c}3`, `${c}4`]
      const groupsMax = computeTypeMaxPoints(typeOf({
        inputType: 'all_groups_standing',
        options: opts,
        correctAnswer: JSON.stringify({ groups, best3rds: [] }),
      }))
      const participants = {
        last_32: Array.from({ length: 32 }, (_, i) => `t${i}`),
        last_16: [], qf: [], sf: [], final: [],
      }
      const bracketMax = computeTypeMaxPoints(typeOf({
        inputType: 'bracket_progression',
        correctAnswer: JSON.stringify({ participants, champion: null, bronzeWinner: null }),
      }))
      expect(groupsMax).toBe(36)
      expect(bracketMax).toBe(64)
      expect(groupsMax + bracketMax).toBe(100)
    })
  })
})
