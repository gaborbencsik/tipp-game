import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSelect, mockFrom, mockWhere, mockInnerJoin, mockLimit } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockLimit: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

import { getScoringExplainer } from '../src/services/scoring-explainer.service.js'

describe('scoring-explainer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('1-csoport user → 1 elemű groups, helyes config', async () => {
    const userId = 'user-1'
    const result = await getScoringExplainer(userId)
    expect(result.default).toBeDefined()
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]?.config).toBeDefined()
  })
})
