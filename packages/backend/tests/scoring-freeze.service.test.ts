import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUpdate, mockSet, mockUpdateWhere, mockSubSelect } = vi.hoisted(() => ({
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
  mockUpdateWhere: vi.fn().mockResolvedValue(undefined),
  mockSubSelect: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: {
    update: mockUpdate,
    select: mockSubSelect,
  },
}))

import { freezeApplicableConfigs } from '../src/services/scoring-freeze.service.js'

describe('scoring-freeze.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSet.mockReturnValue({ where: mockUpdateWhere })
    mockUpdate.mockReturnValue({ set: mockSet })
    // Subquery chain: db.select(...).from(...).innerJoin(...).where(...)
    const subWhere = vi.fn().mockReturnValue({})
    const subInnerJoin = vi.fn().mockReturnValue({ where: subWhere })
    const subFrom = vi.fn().mockReturnValue({ innerJoin: subInnerJoin })
    mockSubSelect.mockReturnValue({ from: subFrom })
  })

  it('freezeApplicableConfigs() → issues a single UPDATE', async () => {
    await freezeApplicableConfigs('user-1')
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockSet).toHaveBeenCalledTimes(1)
    expect(mockUpdateWhere).toHaveBeenCalledTimes(1)
  })

  it('freezeApplicableConfigs() → sets frozenAt to a Date', async () => {
    await freezeApplicableConfigs('user-1')
    const setArg = mockSet.mock.calls[0]?.[0]
    expect(setArg).toBeDefined()
    expect(setArg.frozenAt).toBeInstanceOf(Date)
  })

  it('freezeApplicableConfigs() → idempotent: second call also passes (filters by frozenAt IS NULL in WHERE)', async () => {
    await freezeApplicableConfigs('user-1')
    await freezeApplicableConfigs('user-1')
    expect(mockUpdate).toHaveBeenCalledTimes(2)
    expect(mockUpdateWhere).toHaveBeenCalledTimes(2)
  })
})
