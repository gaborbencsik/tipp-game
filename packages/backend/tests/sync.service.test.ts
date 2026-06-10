import { describe, it, expect } from 'vitest'
import {
  parseRound,
  FIXTURE_STATUS_MAP,
  derivePenaltyOutcome,
  filterFixturesByAllowlist,
  teamsFromFixtures,
  mapEventsToScorerPlayerIds,
} from '../src/services/sync.service.js'
import type { ApiFootballFixture, ApiFootballTeamEntry, ApiFootballFixtureEvent } from '../src/types/index.js'

function makeTeam(id: number, name: string, code: string | null = null): ApiFootballTeamEntry {
  return { id, name, code, logo: '', national: true }
}

function makeFixture(id: number, home: ApiFootballTeamEntry, away: ApiFootballTeamEntry): ApiFootballFixture {
  return {
    fixture: { id, date: '2026-06-01T18:00:00+00:00', status: { short: 'NS', long: 'Not Started', elapsed: null }, venue: { id: null, name: null, city: null } },
    league: { id: 10, round: 'Regular Season - 1' },
    teams: { home, away },
    goals: { home: null, away: null },
    score: { fulltime: { home: null, away: null }, penalty: { home: null, away: null } },
  }
}

describe('sync.service – pure functions', () => {
  describe('parseRound', () => {
    it('parses "Group A - 1" as group stage with groupName "A"', () => {
      expect(parseRound('Group A - 1')).toEqual({ stage: 'group', groupName: 'A' })
    })

    it('parses "Group F - 3" as group stage with groupName "F"', () => {
      expect(parseRound('Group F - 3')).toEqual({ stage: 'group', groupName: 'F' })
    })

    it('parses "Group Stage - 1" as group stage with groupName "Group Stage - 1"', () => {
      expect(parseRound('Group Stage - 1')).toEqual({ stage: 'group', groupName: 'Group Stage - 1' })
    })

    it('parses "Round of 16" as round_of_16', () => {
      expect(parseRound('Round of 16')).toEqual({ stage: 'round_of_16', groupName: null })
    })

    it('parses "Quarter-finals" as quarter_final', () => {
      expect(parseRound('Quarter-finals')).toEqual({ stage: 'quarter_final', groupName: null })
    })

    it('parses "Semi-finals" as semi_final', () => {
      expect(parseRound('Semi-finals')).toEqual({ stage: 'semi_final', groupName: null })
    })

    it('parses "3rd Place Final" as third_place', () => {
      expect(parseRound('3rd Place Final')).toEqual({ stage: 'third_place', groupName: null })
    })

    it('parses "Final" as final', () => {
      expect(parseRound('Final')).toEqual({ stage: 'final', groupName: null })
    })

    it('parses "Regular Season - 22" as group with null groupName', () => {
      expect(parseRound('Regular Season - 22')).toEqual({ stage: 'group', groupName: null })
    })

    it('falls back to group with null groupName for unknown rounds', () => {
      expect(parseRound('Playoffs - 1')).toEqual({ stage: 'group', groupName: null })
    })

    it('falls back for empty string', () => {
      expect(parseRound('')).toEqual({ stage: 'group', groupName: null })
    })
  })

  describe('FIXTURE_STATUS_MAP', () => {
    it('maps NS to scheduled', () => {
      expect(FIXTURE_STATUS_MAP['NS']).toBe('scheduled')
    })

    it('maps live statuses correctly', () => {
      for (const status of ['1H', 'HT', '2H', 'ET', 'P', 'LIVE', 'BT']) {
        expect(FIXTURE_STATUS_MAP[status]).toBe('live')
      }
    })

    it('maps finished statuses correctly', () => {
      for (const status of ['FT', 'AET', 'PEN']) {
        expect(FIXTURE_STATUS_MAP[status]).toBe('finished')
      }
    })

    it('maps cancelled statuses correctly', () => {
      for (const status of ['CANC', 'SUSP', 'ABD', 'AWD', 'WO']) {
        expect(FIXTURE_STATUS_MAP[status]).toBe('cancelled')
      }
    })
  })

  describe('derivePenaltyOutcome', () => {
    it('returns penalties_home when home > away', () => {
      expect(derivePenaltyOutcome({ home: 5, away: 3 })).toBe('penalties_home')
    })

    it('returns penalties_away when away > home', () => {
      expect(derivePenaltyOutcome({ home: 3, away: 5 })).toBe('penalties_away')
    })

    it('returns null when both are equal', () => {
      expect(derivePenaltyOutcome({ home: 4, away: 4 })).toBeNull()
    })

    it('returns null when home is null', () => {
      expect(derivePenaltyOutcome({ home: null, away: 3 })).toBeNull()
    })

    it('returns null when away is null', () => {
      expect(derivePenaltyOutcome({ home: 3, away: null })).toBeNull()
    })

    it('returns null when both are null', () => {
      expect(derivePenaltyOutcome({ home: null, away: null })).toBeNull()
    })
  })

  describe('filterFixturesByAllowlist', () => {
    const f1 = makeFixture(1001, makeTeam(1, 'A'), makeTeam(2, 'B'))
    const f2 = makeFixture(1002, makeTeam(3, 'C'), makeTeam(4, 'D'))
    const f3 = makeFixture(1003, makeTeam(5, 'E'), makeTeam(6, 'F'))

    it('returns empty array when allowlist is empty', () => {
      expect(filterFixturesByAllowlist([f1, f2, f3], [])).toEqual([])
    })

    it('returns only fixtures whose id is in allowlist (partial match)', () => {
      expect(filterFixturesByAllowlist([f1, f2, f3], [1001, 1003])).toEqual([f1, f3])
    })

    it('returns all fixtures when allowlist contains every id', () => {
      expect(filterFixturesByAllowlist([f1, f2, f3], [1001, 1002, 1003])).toEqual([f1, f2, f3])
    })

    it('ignores allowlist ids that do not match any fixture', () => {
      expect(filterFixturesByAllowlist([f1, f2], [9999, 1001])).toEqual([f1])
    })

    it('returns empty array when fixture list is empty', () => {
      expect(filterFixturesByAllowlist([], [1001])).toEqual([])
    })
  })

  describe('teamsFromFixtures', () => {
    it('returns empty array for empty input', () => {
      expect(teamsFromFixtures([])).toEqual([])
    })

    it('returns one entry per unique team id', () => {
      const teamA = makeTeam(1, 'A')
      const teamB = makeTeam(2, 'B')
      const teamC = makeTeam(3, 'C')
      const fixtures = [makeFixture(101, teamA, teamB), makeFixture(102, teamA, teamC)]

      const result = teamsFromFixtures(fixtures)

      expect(result).toHaveLength(3)
      const ids = result.map((t) => t.team.id).sort()
      expect(ids).toEqual([1, 2, 3])
    })

    it('wraps each team with venue: null (suitable for upsertTeams)', () => {
      const fixtures = [makeFixture(101, makeTeam(1, 'A'), makeTeam(2, 'B'))]
      const result = teamsFromFixtures(fixtures)

      expect(result.every((t) => t.venue === null)).toBe(true)
    })
  })

  describe('mapEventsToScorerPlayerIds', () => {
    function makeEvent(overrides: Partial<ApiFootballFixtureEvent>): ApiFootballFixtureEvent {
      return {
        time: { elapsed: 30, extra: null },
        team: { id: 1, name: 'Team', logo: '' },
        player: { id: 100, name: 'Player' },
        assist: { id: null, name: null },
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null,
        ...overrides,
      }
    }

    const playerIdMap = new Map<number, string>([
      [100, 'uuid-100'],
      [101, 'uuid-101'],
      [102, 'uuid-102'],
    ])

    it('includes regular normal-time goal', () => {
      const events = [makeEvent({ player: { id: 100, name: 'A' } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual(['uuid-100'])
    })

    it('includes extra-time goal (elapsed: 110)', () => {
      const events = [makeEvent({ time: { elapsed: 110, extra: null }, player: { id: 100, name: 'A' } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual(['uuid-100'])
    })

    it('includes ET penalty (elapsed: 118, comments: null) — not a shootout', () => {
      const events = [makeEvent({
        time: { elapsed: 118, extra: null },
        detail: 'Penalty',
        comments: null,
        player: { id: 101, name: 'B' },
      })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual(['uuid-101'])
    })

    it('excludes shootout scored goal (comments = "Penalty Shootout")', () => {
      const events = [makeEvent({
        detail: 'Penalty',
        comments: 'Penalty Shootout',
        player: { id: 100, name: 'A' },
      })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('excludes shootout missed penalty', () => {
      const events = [makeEvent({
        detail: 'Missed Penalty',
        comments: 'Penalty Shootout',
        player: { id: 100, name: 'A' },
      })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('excludes own goal', () => {
      const events = [makeEvent({ detail: 'Own Goal', player: { id: 100, name: 'A' } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('excludes missed normal-time penalty', () => {
      const events = [makeEvent({ detail: 'Missed Penalty', player: { id: 100, name: 'A' } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('excludes a goal cancelled by VAR (Goal Cancelled with same time+player)', () => {
      const events = [
        makeEvent({
          time: { elapsed: 50, extra: null },
          player: { id: 100, name: 'A' },
        }),
        makeEvent({
          time: { elapsed: 50, extra: null },
          type: 'Var',
          detail: 'Goal cancelled',
          player: { id: 100, name: 'A' },
        }),
      ]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('hat-trick (3 goals from same player) deduplicates to one entry', () => {
      const events = [
        makeEvent({ time: { elapsed: 12, extra: null }, player: { id: 100, name: 'A' } }),
        makeEvent({ time: { elapsed: 38, extra: null }, player: { id: 100, name: 'A' } }),
        makeEvent({ time: { elapsed: 67, extra: null }, player: { id: 100, name: 'A' } }),
      ]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual(['uuid-100'])
    })

    it('skips unknown player.id (not in playerIdMap)', () => {
      const events = [makeEvent({ player: { id: 9999, name: 'Unknown' } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('skips events with player.id = null', () => {
      const events = [makeEvent({ player: { id: null, name: null } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('skips events with time.elapsed = null', () => {
      const events = [makeEvent({ time: { elapsed: null, extra: null }, player: { id: 100, name: 'A' } })]
      expect(mapEventsToScorerPlayerIds(events, playerIdMap)).toEqual([])
    })

    it('returns empty array for empty events list', () => {
      expect(mapEventsToScorerPlayerIds([], playerIdMap)).toEqual([])
    })

    it('handles multiple distinct scorers in order', () => {
      const events = [
        makeEvent({ time: { elapsed: 10, extra: null }, player: { id: 100, name: 'A' } }),
        makeEvent({ time: { elapsed: 22, extra: null }, type: 'Card', detail: 'Yellow Card', player: { id: 101, name: 'B' } }),
        makeEvent({ time: { elapsed: 55, extra: null }, player: { id: 102, name: 'C' } }),
      ]
      const result = mapEventsToScorerPlayerIds(events, playerIdMap)
      expect(result).toEqual(['uuid-100', 'uuid-102'])
    })
  })
})
