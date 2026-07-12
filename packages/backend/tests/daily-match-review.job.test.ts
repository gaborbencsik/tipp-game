import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockSendToUser,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSendToUser: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect },
}))

vi.mock('../src/db/schema/index.js', () => ({
  matches: {
    id: 'matches.id',
    scheduledAt: 'matches.scheduledAt',
    status: 'matches.status',
    deletedAt: 'matches.deletedAt',
  },
  users: { id: 'users.id', pushEnabled: 'users.pushEnabled', deletedAt: 'users.deletedAt' },
  predictions: { matchId: 'predictions.matchId', userId: 'predictions.userId' },
  pushSubscriptions: { userId: 'pushSubs.userId', deletedAt: 'pushSubs.deletedAt' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  eq: vi.fn((c: unknown, v: unknown) => ({ __eq: [c, v] })),
  isNull: vi.fn((c: unknown) => ({ __isNull: c })),
  gte: vi.fn((c: unknown, v: unknown) => ({ __gte: [c, v] })),
  lt: vi.fn((c: unknown, v: unknown) => ({ __lt: [c, v] })),
  asc: vi.fn((c: unknown) => ({ __asc: c })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: { strings, vals } })),
    { raw: vi.fn((s: string) => ({ __sqlRaw: s })) },
  ),
}))

vi.mock('../src/services/webpush.service.js', () => ({
  sendToUser: mockSendToUser,
}))

vi.mock('../src/services/push-settings.service.js', () => ({
  getPushSettings: vi.fn().mockResolvedValue({ kickoffReminderEnabled: true, dailyReviewEnabled: true }),
}))

import { runDailyMatchReviewJob } from '../src/jobs/daily-match-review.job.js'
import { runDailyReviewIfDueWindow } from '../src/jobs/daily-match-review.job.js'

interface MatchRow { id: string; scheduledAt: Date }
interface UserRow { id: string; missingCount: number }

function setMatchesQuery(matches: MatchRow[]): void {
  const orderBy = vi.fn().mockResolvedValueOnce(matches.map(m => ({
    matchId: m.id,
    scheduledAt: m.scheduledAt,
  })))
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  mockSelect.mockReturnValueOnce({ from })
}

function setTargetUsersQuery(users: UserRow[]): void {
  const where = vi.fn().mockResolvedValueOnce(users.map(u => ({ id: u.id, missingCount: u.missingCount })))
  const innerJoin = vi.fn().mockReturnValue({ where })
  const from = vi.fn().mockReturnValue({ innerJoin })
  mockSelect.mockReturnValueOnce({ from })
}

describe('runDailyMatchReviewJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendToUser.mockResolvedValue(undefined)
  })

  it('returns silently when there are no matches today', async () => {
    setMatchesQuery([])
    const result = await runDailyMatchReviewJob()
    expect(result.sent).toBe(0)
    expect(result.targetCount).toBe(0)
    expect(result.firstMatchId).toBeNull()
    expect(mockSendToUser).not.toHaveBeenCalled()
  })

  it('sends a daily review push to every user with at least one missing prediction', async () => {
    setMatchesQuery([
      { id: 'm1', scheduledAt: new Date('2026-06-11T18:00:00Z') },
      { id: 'm2', scheduledAt: new Date('2026-06-11T21:00:00Z') },
    ])
    setTargetUsersQuery([
      { id: 'u1', missingCount: 1 },
      { id: 'u2', missingCount: 2 },
    ])

    const result = await runDailyMatchReviewJob(new Date('2026-06-11T10:00:00Z'))

    expect(result.sent).toBe(2)
    expect(result.targetCount).toBe(2)
    expect(result.firstMatchId).toBe('m1')
    expect(mockSendToUser).toHaveBeenCalledTimes(2)
    expect(mockSendToUser).toHaveBeenCalledWith('u1',
      expect.objectContaining({
        title: expect.stringContaining('1 tipp hiányzik'),
        body: expect.stringContaining('Az első meccs'),
        url: '/app/matches?date=today',
      }),
      expect.objectContaining({
        type: 'daily_match_review',
        scopeKey: '2026-06-11',
      }),
    )
    expect(mockSendToUser).toHaveBeenCalledWith('u2',
      expect.objectContaining({
        title: expect.stringContaining('2 tipp hiányzik'),
      }),
      expect.anything(),
    )
  })

  it('uses Europe/Budapest calendar day for the scope_key', async () => {
    // 2026-06-11 22:30 UTC = 2026-06-12 00:30 Budapest
    setMatchesQuery([{ id: 'm1', scheduledAt: new Date('2026-06-12T18:00:00Z') }])
    setTargetUsersQuery([{ id: 'u1', missingCount: 1 }])

    await runDailyMatchReviewJob(new Date('2026-06-11T22:30:00Z'))

    expect(mockSendToUser).toHaveBeenCalledWith('u1', expect.anything(),
      expect.objectContaining({ scopeKey: '2026-06-12' }),
    )
  })

  it('continues when one user send fails', async () => {
    setMatchesQuery([{ id: 'm1', scheduledAt: new Date('2026-06-11T18:00:00Z') }])
    setTargetUsersQuery([
      { id: 'u1', missingCount: 1 },
      { id: 'u2', missingCount: 1 },
    ])
    mockSendToUser
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    const result = await runDailyMatchReviewJob(new Date('2026-06-11T10:00:00Z'))
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('returns 0 sent when target list is empty (everyone tipped)', async () => {
    setMatchesQuery([{ id: 'm1', scheduledAt: new Date('2026-06-11T18:00:00Z') }])
    setTargetUsersQuery([])

    const result = await runDailyMatchReviewJob(new Date('2026-06-11T10:00:00Z'))
    expect(result.sent).toBe(0)
    expect(result.targetCount).toBe(0)
    expect(mockSendToUser).not.toHaveBeenCalled()
  })

  it('window covers 17:00 today through 07:00 tomorrow Europe/Budapest', async () => {
    // Anchor: 2026-06-11 10:00 UTC = 12:00 Budapest CEST (UTC+2). Window:
    //   start = 17:00 Budapest 2026-06-11 = 15:00 UTC
    //   end   = 07:00 Budapest 2026-06-12 = 05:00 UTC
    setMatchesQuery([])
    let capturedWhere: unknown = null
    mockSelect.mockReset()
    const orderBy = vi.fn().mockResolvedValueOnce([])
    const where = vi.fn((args: unknown) => {
      capturedWhere = args
      return { orderBy }
    })
    const from = vi.fn().mockReturnValue({ where })
    mockSelect.mockReturnValueOnce({ from })

    await runDailyMatchReviewJob(new Date('2026-06-11T10:00:00Z'))

    const conds = (capturedWhere as { __and: unknown[] }).__and as Array<Record<string, unknown[]>>
    const gteCond = conds.find(c => '__gte' in c)
    const ltCond = conds.find(c => '__lt' in c)
    const start = (gteCond as { __gte: [unknown, Date] }).__gte[1]
    const end = (ltCond as { __lt: [unknown, Date] }).__lt[1]
    expect(start.toISOString()).toBe('2026-06-11T15:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-12T05:00:00.000Z')
  })

  it('window respects DST off (winter, UTC+1)', async () => {
    // Anchor: 2026-12-15 11:00 UTC = 12:00 Budapest CET (UTC+1).
    //   start = 17:00 Budapest = 16:00 UTC
    //   end   = 07:00 Budapest tomorrow = 06:00 UTC
    setMatchesQuery([])
    let capturedWhere: unknown = null
    mockSelect.mockReset()
    const orderBy = vi.fn().mockResolvedValueOnce([])
    const where = vi.fn((args: unknown) => {
      capturedWhere = args
      return { orderBy }
    })
    const from = vi.fn().mockReturnValue({ where })
    mockSelect.mockReturnValueOnce({ from })

    await runDailyMatchReviewJob(new Date('2026-12-15T11:00:00Z'))

    const conds = (capturedWhere as { __and: unknown[] }).__and as Array<Record<string, unknown[]>>
    const gteCond = conds.find(c => '__gte' in c)
    const ltCond = conds.find(c => '__lt' in c)
    const start = (gteCond as { __gte: [unknown, Date] }).__gte[1]
    const end = (ltCond as { __lt: [unknown, Date] }).__lt[1]
    expect(start.toISOString()).toBe('2026-12-15T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-16T06:00:00.000Z')
  })

  it('skips when dailyReviewEnabled is false', async () => {
    const { getPushSettings } = await import('../src/services/push-settings.service.js')
    vi.mocked(getPushSettings).mockResolvedValueOnce({ kickoffReminderEnabled: true, dailyReviewEnabled: false })
    const result = await runDailyMatchReviewJob(new Date('2026-06-11T10:00:00Z'))
    expect(result.sent).toBe(0)
    expect(result.targetCount).toBe(0)
    expect(mockSendToUser).not.toHaveBeenCalled()
  })
})

describe('runDailyReviewIfDueWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendToUser.mockResolvedValue(undefined)
  })

  // Trigger window: 12:00 .. 12:04 Budapest (CEST in summer = UTC+2)
  // 12:00 Budapest CEST == 10:00 UTC
  it('runs the daily review job when now is exactly 12:00 Budapest', async () => {
    setMatchesQuery([])
    const result = await runDailyReviewIfDueWindow(new Date('2026-06-15T10:00:00Z'))
    expect('skipped' in result && result.skipped).not.toBe(true)
  })

  it('runs the daily review job when now is 12:04 Budapest', async () => {
    setMatchesQuery([])
    const result = await runDailyReviewIfDueWindow(new Date('2026-06-15T10:04:00Z'))
    expect('skipped' in result && result.skipped).not.toBe(true)
  })

  it('skips when now is 12:05 Budapest (just past the window)', async () => {
    const result = await runDailyReviewIfDueWindow(new Date('2026-06-15T10:05:00Z'))
    expect(result).toEqual({ skipped: true, reason: 'not in trigger window' })
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('skips when now is 11:59 Budapest (just before the window)', async () => {
    const result = await runDailyReviewIfDueWindow(new Date('2026-06-15T09:59:00Z'))
    expect(result).toEqual({ skipped: true, reason: 'not in trigger window' })
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('skips when now is 09:30 Budapest (different hour)', async () => {
    const result = await runDailyReviewIfDueWindow(new Date('2026-06-15T07:30:00Z'))
    expect(result).toEqual({ skipped: true, reason: 'not in trigger window' })
  })

  // Winter: 12:00 Budapest CET (UTC+1) == 11:00 UTC
  it('runs in the trigger window in winter time (CET, UTC+1)', async () => {
    setMatchesQuery([])
    const result = await runDailyReviewIfDueWindow(new Date('2026-12-15T11:00:00Z'))
    expect('skipped' in result && result.skipped).not.toBe(true)
  })

  it('skips at 12:05 Budapest in winter time', async () => {
    const result = await runDailyReviewIfDueWindow(new Date('2026-12-15T11:05:00Z'))
    expect(result).toEqual({ skipped: true, reason: 'not in trigger window' })
  })
})
