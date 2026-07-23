import { describe, it, expect, vi, afterEach } from 'vitest'
import { useScoringRulesConfig } from './useScoringRulesConfig.js'

describe('useScoringRulesConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to disabled when the env var is undefined', () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', undefined as unknown as string)
    expect(useScoringRulesConfig().isScoringRulesEnabled).toBe(false)
  })

  it('is enabled when the env var is the string "true"', () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'true')
    expect(useScoringRulesConfig().isScoringRulesEnabled).toBe(true)
  })

  it('is disabled when the env var is the string "false"', () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'false')
    expect(useScoringRulesConfig().isScoringRulesEnabled).toBe(false)
  })

  it('returns a boolean value', () => {
    vi.stubEnv('VITE_SCORING_RULES_ENABLED', 'true')
    expect(typeof useScoringRulesConfig().isScoringRulesEnabled).toBe('boolean')
  })
})
