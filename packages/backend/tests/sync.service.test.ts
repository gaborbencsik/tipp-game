import { describe, it, expect } from 'vitest'
import { parseRound, FIXTURE_STATUS_MAP, derivePenaltyOutcome } from '../src/services/sync.service.js'

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
})
