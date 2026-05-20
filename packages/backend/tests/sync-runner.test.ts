import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getConfiguredLeagueDescriptors } from '../src/services/sync-runner.js'

const ENV_KEYS = [
  'FOOTBALL_API_WC_LEAGUE_ID',
  'FOOTBALL_INTERNAL_WC_LEAGUE_ID',
  'FOOTBALL_API_NBI_LEAGUE_ID',
  'FOOTBALL_INTERNAL_NBI_LEAGUE_ID',
  'FOOTBALL_API_FRIENDLY_LEAGUE_ID',
] as const

describe('getConfiguredLeagueDescriptors', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      original[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
  })

  it('returns empty array when no leagues configured', () => {
    expect(getConfiguredLeagueDescriptors()).toEqual([])
  })

  it('returns WC descriptor when WC env vars are set', () => {
    process.env['FOOTBALL_API_WC_LEAGUE_ID'] = '1'
    process.env['FOOTBALL_INTERNAL_WC_LEAGUE_ID'] = 'wc-uuid'

    expect(getConfiguredLeagueDescriptors()).toEqual([
      { name: 'VB', externalId: 1, season: 2026 },
    ])
  })

  it('returns both WC and NB I descriptors when both env vars are set', () => {
    process.env['FOOTBALL_API_WC_LEAGUE_ID'] = '1'
    process.env['FOOTBALL_INTERNAL_WC_LEAGUE_ID'] = 'wc-uuid'
    process.env['FOOTBALL_API_NBI_LEAGUE_ID'] = '848'
    process.env['FOOTBALL_INTERNAL_NBI_LEAGUE_ID'] = 'nbi-uuid'

    expect(getConfiguredLeagueDescriptors()).toEqual([
      { name: 'VB', externalId: 1, season: 2026 },
      { name: 'NB I', externalId: 848, season: 2025 },
    ])
  })

  it('returns Pre-VB Edzőmeccsek descriptor when only API env var is set (split league does not need internal id env)', () => {
    process.env['FOOTBALL_API_FRIENDLY_LEAGUE_ID'] = '10'

    expect(getConfiguredLeagueDescriptors()).toEqual([
      { name: 'Pre-VB Edzőmeccsek', externalId: 10, season: 2026 },
    ])
  })

  it('returns all three descriptors when every required env var is set', () => {
    process.env['FOOTBALL_API_WC_LEAGUE_ID'] = '1'
    process.env['FOOTBALL_INTERNAL_WC_LEAGUE_ID'] = 'wc-uuid'
    process.env['FOOTBALL_API_NBI_LEAGUE_ID'] = '848'
    process.env['FOOTBALL_INTERNAL_NBI_LEAGUE_ID'] = 'nbi-uuid'
    process.env['FOOTBALL_API_FRIENDLY_LEAGUE_ID'] = '10'

    expect(getConfiguredLeagueDescriptors()).toEqual([
      { name: 'VB', externalId: 1, season: 2026 },
      { name: 'NB I', externalId: 848, season: 2025 },
      { name: 'Pre-VB Edzőmeccsek', externalId: 10, season: 2026 },
    ])
  })

  it('does not leak api key or internal id', () => {
    process.env['FOOTBALL_API_WC_LEAGUE_ID'] = '1'
    process.env['FOOTBALL_INTERNAL_WC_LEAGUE_ID'] = 'wc-uuid'

    const descriptors = getConfiguredLeagueDescriptors()
    const json = JSON.stringify(descriptors)

    expect(json).not.toContain('wc-uuid')
    expect(descriptors[0]).not.toHaveProperty('internalId')
  })
})
