import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect,
  mockSendToUser,
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
    homeTeamId: 'matches.homeTeamId',
    awayTeamId: 'matches.awayTeamId',
  },
  teams: { id: 'teams.id', name: 'teams.name' },
  users: { id: 'users.id', pushEnabled: 'users.pushEnabled', deletedAt: 'users.deletedAt' },
  predictions: { matchId: 'predictions.matchId', userId: 'predictions.userId' },
  pushSubscriptions: { userId: 'pushSubs.userId', deletedAt: 'pushSubs.deletedAt' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  eq: vi.fn((c: unknown, v: unknown) => ({ __eq: [c, v] })),
  gt: vi.fn((c: unknown, v: unknown) => ({ __gt: [c, v] })),
  lte: vi.fn((c: unknown, v: unknown) => ({ __lte: [c, v] })),
  isNull: vi.fn((c: unknown) => ({ __isNull: c })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: { strings, vals } })),
    { raw: vi.fn((s: string) => ({ __sqlRaw: s })) },
  ),
}))

vi.mock('drizzle-orm/pg-core', () => ({
  alias: vi.fn((table: unknown, name: string) => ({ __alias: { table, name }, name: `${name}.name`, id: `${name}.id` })),
}))

vi.mock('../src/services/webpush.service.js', () => ({
  sendToUser: mockSendToUser,
}))

vi.mock('../src/services/push-settings.service.js', () => ({
  getPushSettings: vi.fn().mockResolvedValue({ kickoffReminderEnabled: true, dailyReviewEnabled: true }),
}))

import { runMatchKickoffReminderJob } from '../src/jobs/match-kickoff-reminder.job.js'

interface MatchRow {
  id: string
  scheduledAt: Date
  homeName: string
  awayName: string
}

interface UserRow {
  id: string
}

function setMatchesQuery(matches: MatchRow[]): void {
  const where = vi.fn().mockResolvedValueOnce(matches.map(m => ({
    matchId: m.id,
    scheduledAt: m.scheduledAt,
    homeName: m.homeName,
    awayName: m.awayName,
  })))
  const innerJoin2 = vi.fn().mockReturnValue({ where })
  const innerJoin1 = vi.fn().mockReturnValue({ innerJoin: innerJoin2 })
  const from = vi.fn().mockReturnValue({ innerJoin: innerJoin1 })
  mockSelect.mockReturnValueOnce({ from })
}

function setTargetUsersQuery(users: UserRow[]): void {
  const where = vi.fn().mockResolvedValueOnce(users.map(u => ({ id: u.id })))
  const innerJoin = vi.fn().mockReturnValue({ where })
  const from = vi.fn().mockReturnValue({ innerJoin })
  mockSelect.mockReturnValueOnce({ from })
}

function setTargetUsersQueryThrows(err: Error): void {
  const where = vi.fn().mockRejectedValueOnce(err)
  const innerJoin = vi.fn().mockReturnValue({ where })
  const from = vi.fn().mockReturnValue({ innerJoin })
  mockSelect.mockReturnValueOnce({ from })
}

describe('runMatchKickoffReminderJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendToUser.mockResolvedValue(undefined)
  })

  it('returns 0 sent when no upcoming matches in window', async () => {
    setMatchesQuery([])
    const result = await runMatchKickoffReminderJob()
    expect(result.matchesProcessed).toBe(0)
    expect(result.sent).toBe(0)
    expect(mockSendToUser).not.toHaveBeenCalled()
  })

  it('sends a reminder to every user without a prediction for the match', async () => {
    const kickoff = new Date('2026-06-11T15:00:00Z')
    setMatchesQuery([{ id: 'match-1', scheduledAt: kickoff, homeName: 'Hungary', awayName: 'Germany' }])
    setTargetUsersQuery([{ id: 'u1' }, { id: 'u2' }])

    const result = await runMatchKickoffReminderJob()

    expect(result.matchesProcessed).toBe(1)
    expect(result.sent).toBe(2)
    expect(mockSendToUser).toHaveBeenCalledTimes(2)
    expect(mockSendToUser).toHaveBeenCalledWith('u1',
      expect.objectContaining({
        title: expect.stringContaining('Hungary'),
        body: expect.stringContaining('tippeltél'),
        url: '/app/matches?focus=match-1',
        tag: 'match-kickoff-match-1',
      }),
      expect.objectContaining({ type: 'match_kickoff_reminder', scopeKey: 'match-1' }),
    )
  })

  it('processes multiple matches independently', async () => {
    const t1 = new Date('2026-06-11T15:00:00Z')
    const t2 = new Date('2026-06-11T15:30:00Z')
    setMatchesQuery([
      { id: 'm1', scheduledAt: t1, homeName: 'A', awayName: 'B' },
      { id: 'm2', scheduledAt: t2, homeName: 'C', awayName: 'D' },
    ])
    setTargetUsersQuery([{ id: 'u1' }])
    setTargetUsersQuery([{ id: 'u2' }, { id: 'u3' }])

    const result = await runMatchKickoffReminderJob()
    expect(result.matchesProcessed).toBe(2)
    expect(result.sent).toBe(3)
  })

  it('continues processing other users when one send fails', async () => {
    setMatchesQuery([{ id: 'm1', scheduledAt: new Date('2026-06-11T15:00:00Z'), homeName: 'A', awayName: 'B' }])
    setTargetUsersQuery([{ id: 'u1' }, { id: 'u2' }])
    mockSendToUser
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    const result = await runMatchKickoffReminderJob()
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(1)
  })

  it('skips when kickoffReminderEnabled is false', async () => {
    const { getPushSettings } = await import('../src/services/push-settings.service.js')
    vi.mocked(getPushSettings).mockResolvedValueOnce({ kickoffReminderEnabled: false, dailyReviewEnabled: true })
    const result = await runMatchKickoffReminderJob()
    expect(result.matchesProcessed).toBe(0)
    expect(result.sent).toBe(0)
    expect(mockSendToUser).not.toHaveBeenCalled()
  })

  it('continues processing other matches when one match throws', async () => {
    setMatchesQuery([
      { id: 'm1', scheduledAt: new Date('2026-06-11T15:00:00Z'), homeName: 'A', awayName: 'B' },
      { id: 'm2', scheduledAt: new Date('2026-06-11T15:30:00Z'), homeName: 'C', awayName: 'D' },
    ])
    setTargetUsersQueryThrows(new Error('db error'))
    setTargetUsersQuery([{ id: 'u1' }])

    const result = await runMatchKickoffReminderJob()
    expect(result.matchesProcessed).toBe(2)
    expect(result.sent).toBe(1)
  })
})
