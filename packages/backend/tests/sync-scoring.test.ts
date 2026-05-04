import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db/client.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{ id: 'match-uuid-1' }]),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}))

const mockCalculateAndSavePoints = vi.fn().mockResolvedValue(undefined)
const mockCalculateAndSaveGroupPoints = vi.fn().mockResolvedValue(undefined)

vi.mock('../src/services/scoring.service.js', () => ({
  calculateAndSavePoints: (...args: unknown[]) => mockCalculateAndSavePoints(...args),
  calculateAndSaveGroupPoints: (...args: unknown[]) => mockCalculateAndSaveGroupPoints(...args),
}))

import { db } from '../src/db/client.js'
import { upsertResults } from '../src/services/sync.service.js'

describe('sync.service – upsertResults scoring integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls calculateAndSavePoints after upserting a finished result', async () => {
    const fixtures = [{
      fixture: { id: 101, status: { short: 'FT' } },
      goals: { home: 2, away: 1 },
      score: { penalty: { home: null, away: null } },
    }] as any

    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'match-uuid-1' }]),
        }),
      }),
    })
    ;(db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    })

    await upsertResults(fixtures)

    expect(mockCalculateAndSavePoints).toHaveBeenCalledWith(
      'match-uuid-1',
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null },
    )
    expect(mockCalculateAndSaveGroupPoints).toHaveBeenCalledWith(
      'match-uuid-1',
      { homeGoals: 2, awayGoals: 1, outcomeAfterDraw: null },
    )
  })

  it('calls scoring with outcomeAfterDraw when penalties decided', async () => {
    const fixtures = [{
      fixture: { id: 202, status: { short: 'PEN' } },
      goals: { home: 1, away: 1 },
      score: { penalty: { home: 4, away: 2 } },
    }] as any

    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'match-uuid-2' }]),
        }),
      }),
    })
    ;(db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }),
    })

    await upsertResults(fixtures)

    expect(mockCalculateAndSavePoints).toHaveBeenCalledWith(
      'match-uuid-2',
      { homeGoals: 1, awayGoals: 1, outcomeAfterDraw: 'penalties_home' },
    )
  })

  it('does not call scoring for non-finished fixtures', async () => {
    const fixtures = [{
      fixture: { id: 303, status: { short: 'NS' } },
      goals: { home: null, away: null },
      score: { penalty: { home: null, away: null } },
    }] as any

    await upsertResults(fixtures)

    expect(mockCalculateAndSavePoints).not.toHaveBeenCalled()
    expect(mockCalculateAndSaveGroupPoints).not.toHaveBeenCalled()
  })

  it('does not call scoring when match not found in DB', async () => {
    const fixtures = [{
      fixture: { id: 404, status: { short: 'FT' } },
      goals: { home: 3, away: 0 },
      score: { penalty: { home: null, away: null } },
    }] as any

    ;(db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    })

    await upsertResults(fixtures)

    expect(mockCalculateAndSavePoints).not.toHaveBeenCalled()
  })
})
