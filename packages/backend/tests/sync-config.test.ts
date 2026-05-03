import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('sync-config', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('defaults to off when env var is absent', async () => {
    vi.stubEnv('FOOTBALL_SYNC_MODE', '')
    const { getSyncMode } = await import('../src/services/sync-config.js')
    expect(getSyncMode()).toBe('off')
  })

  it('reads mode from FOOTBALL_SYNC_MODE env var', async () => {
    vi.stubEnv('FOOTBALL_SYNC_MODE', 'final_only')
    const { getSyncMode } = await import('../src/services/sync-config.js')
    expect(getSyncMode()).toBe('final_only')
  })

  it('defaults to off for invalid env value', async () => {
    vi.stubEnv('FOOTBALL_SYNC_MODE', 'invalid_mode')
    const { getSyncMode } = await import('../src/services/sync-config.js')
    expect(getSyncMode()).toBe('off')
  })

  it('setSyncMode changes current mode', async () => {
    vi.stubEnv('FOOTBALL_SYNC_MODE', 'off')
    const { getSyncMode, setSyncMode } = await import('../src/services/sync-config.js')
    setSyncMode('adaptive')
    expect(getSyncMode()).toBe('adaptive')
  })

  it('VALID_SYNC_MODES contains all four modes', async () => {
    vi.stubEnv('FOOTBALL_SYNC_MODE', 'off')
    const { VALID_SYNC_MODES } = await import('../src/services/sync-config.js')
    expect(VALID_SYNC_MODES).toEqual(['off', 'final_only', 'adaptive', 'full_live'])
  })
})
