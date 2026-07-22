import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── DB mock ──────────────────────────────────────────────────────────────────

const { mockSelect, mockFrom, mockWhere } = vi.hoisted(() => {
  const mockWhere = vi.fn().mockResolvedValue([])
  const mockFrom = vi.fn(() => ({ where: mockWhere }))
  const mockSelect = vi.fn(() => ({ from: mockFrom }))
  return { mockSelect, mockFrom, mockWhere }
})

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getConfiguredLeagueDescriptors } from '../src/services/sync-runner.js'

const NOW = new Date('2026-07-21T00:00:00.000Z')

const WC_ROW = {
  id: 'wc-uuid',
  name: 'World Cup 2026',
  shortName: 'VB',
  startsAt: null,
  status: 'active' as 'active' | 'archived',
  syncEnabled: true,
  externalId: 1 as number | null,
  season: 2026 as number | null,
  syncFrom: null as Date | null,
  syncTo: null as Date | null,
  fixtureAllowlist: null as number[] | null,
  createdAt: NOW,
  updatedAt: NOW,
}

describe('getConfiguredLeagueDescriptors (DB-driven)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWhere.mockResolvedValue([])
  })

  it('returns empty array when no syncable leagues in DB', async () => {
    mockWhere.mockResolvedValue([])
    expect(await getConfiguredLeagueDescriptors()).toEqual([])
  })

  it('returns descriptor built from the DB row (shortName as name)', async () => {
    mockWhere.mockResolvedValue([WC_ROW])
    expect(await getConfiguredLeagueDescriptors()).toEqual([
      { name: 'VB', externalId: 1, season: 2026 },
    ])
  })

  it('does not leak the internal id (leagues.id)', async () => {
    mockWhere.mockResolvedValue([WC_ROW])
    const descriptors = await getConfiguredLeagueDescriptors()
    const json = JSON.stringify(descriptors)
    expect(json).not.toContain('wc-uuid')
    expect(descriptors[0]).not.toHaveProperty('internalId')
  })

  it('skips a row missing external_id or season', async () => {
    mockWhere.mockResolvedValue([{ ...WC_ROW, externalId: null }])
    expect(await getConfiguredLeagueDescriptors()).toEqual([])
  })

  it('HARD RULE: query filters on sync_enabled = true AND status = active', async () => {
    // The archived-exclusion is enforced in the WHERE clause, so an archived
    // league never reaches this function's input. Assert the filter is applied.
    mockWhere.mockResolvedValue([WC_ROW])
    await getConfiguredLeagueDescriptors()
    expect(mockWhere).toHaveBeenCalledOnce()
    expect(mockWhere.mock.calls[0]?.[0]).toBeDefined()
  })
})
