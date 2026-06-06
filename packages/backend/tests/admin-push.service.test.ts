import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockFrom, mockWhere,
  mockInsert, mockValues,
  mockSendToUser,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn().mockResolvedValue(undefined),
  mockSendToUser: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: { select: mockSelect, insert: mockInsert },
}))

vi.mock('../src/db/schema/index.js', () => ({
  users: {
    id: 'users.id',
    pushEnabled: 'users.pushEnabled',
    deletedAt: 'users.deletedAt',
    displayName: 'users.displayName',
    email: 'users.email',
  },
  auditLogs: 'auditLogs',
  matches: { id: 'matches.id', kickoffTime: 'matches.kickoffTime', kickedAt: 'matches.kickedAt', deletedAt: 'matches.deletedAt' },
  predictions: { matchId: 'predictions.matchId', userId: 'predictions.userId', deletedAt: 'predictions.deletedAt' },
  specialPredictionTypes: { id: 'spt.id', isGlobal: 'spt.isGlobal', isActive: 'spt.isActive', deadline: 'spt.deadline' },
  specialPredictions: { typeId: 'sp.typeId', userId: 'sp.userId', deletedAt: 'sp.deletedAt' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  eq: vi.fn((c: unknown, v: unknown) => ({ __eq: [c, v] })),
  isNull: vi.fn((c: unknown) => ({ __isNull: c })),
  gt: vi.fn((c: unknown, v: unknown) => ({ __gt: [c, v] })),
  exists: vi.fn((q: unknown) => ({ __exists: q })),
  notExists: vi.fn((q: unknown) => ({ __notExists: q })),
  asc: vi.fn((c: unknown) => ({ __asc: c })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: { strings, vals } })),
    { raw: vi.fn((s: string) => ({ __sqlRaw: s })) },
  ),
}))

vi.mock('../src/services/webpush.service.js', () => ({
  sendToUser: mockSendToUser,
}))

import { broadcastToAllUsers, getBroadcastTargetCount, listEligibleUsersBySegment } from '../src/services/admin-push.service.js'

function setEligibleUserIds(ids: string[]): void {
  mockWhere.mockResolvedValueOnce(ids.map(id => ({ id })))
  mockFrom.mockReturnValue({ where: mockWhere })
  mockSelect.mockReturnValueOnce({ from: mockFrom })
}

describe('getBroadcastTargetCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({ values: mockValues })
  })

  it('returns the count of push-enabled, non-deleted users', async () => {
    setEligibleUserIds(['u1', 'u2', 'u3'])
    expect(await getBroadcastTargetCount()).toBe(3)
  })

  it('returns 0 when no eligible users', async () => {
    setEligibleUserIds([])
    expect(await getBroadcastTargetCount()).toBe(0)
  })
})

describe('broadcastToAllUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({ values: mockValues })
    mockSendToUser.mockResolvedValue(undefined)
  })

  it('sends to every eligible user with admin_broadcast type and unique tag', async () => {
    setEligibleUserIds(['u1', 'u2'])
    const result = await broadcastToAllUsers('actor-1', { title: 'Hi', body: 'Test' })
    expect(result).toEqual({ totalTargets: 2, delivered: 2, failed: 0, errors: [] })
    expect(mockSendToUser).toHaveBeenCalledTimes(2)
    expect(mockSendToUser).toHaveBeenCalledWith('u1',
      expect.objectContaining({ title: 'Hi', body: 'Test', tag: expect.stringMatching(/^admin_broadcast_\d+$/) }),
      expect.objectContaining({ type: 'admin_broadcast', bypassQuietHours: false, bypassRateLimit: false }),
    )
  })

  it('passes through bypass flags', async () => {
    setEligibleUserIds(['u1'])
    await broadcastToAllUsers('actor-1', { title: 'A', body: 'B', bypassQuietHours: true, bypassRateLimit: true })
    expect(mockSendToUser).toHaveBeenCalledWith('u1', expect.anything(),
      expect.objectContaining({ bypassQuietHours: true, bypassRateLimit: true }),
    )
  })

  it('counts failures and continues with other users', async () => {
    setEligibleUserIds(['u1', 'u2', 'u3'])
    mockSendToUser
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)

    const result = await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' })
    expect(result.totalTargets).toBe(3)
    expect(result.delivered).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.errors[0]).toContain('u2')
    expect(result.errors[0]).toContain('boom')
  })

  it('writes a push_send audit log entry with delivery stats', async () => {
    setEligibleUserIds(['u1', 'u2'])
    await broadcastToAllUsers('actor-1', { title: 'Hi', body: 'B', url: '/matches' })
    expect(mockInsert).toHaveBeenCalledWith('auditLogs')
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor-1',
      action: 'push_send',
      entityType: 'broadcast',
      entityId: 'actor-1',
      newValue: expect.objectContaining({
        title: 'Hi',
        body: 'B',
        url: '/matches',
        totalTargets: 2,
        delivered: 2,
        failed: 0,
      }),
    }))
  })

  it('with no targets, returns zeros and still writes audit entry', async () => {
    setEligibleUserIds([])
    const result = await broadcastToAllUsers('actor-1', { title: 'Hi', body: 'B' })
    expect(result).toEqual({ totalTargets: 0, delivered: 0, failed: 0, errors: [] })
    expect(mockSendToUser).not.toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalled()
  })

  it('includes url=null in audit when url is omitted', async () => {
    setEligibleUserIds(['u1'])
    await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      newValue: expect.objectContaining({ url: null }),
    }))
  })
})

describe('segment support', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({ values: mockValues })
    mockSendToUser.mockResolvedValue(undefined)
  })

  it("getBroadcastTargetCount defaults to 'all' segment", async () => {
    setEligibleUserIds(['u1', 'u2'])
    expect(await getBroadcastTargetCount()).toBe(2)
  })

  it("getBroadcastTargetCount accepts 'all' explicitly", async () => {
    setEligibleUserIds(['u1', 'u2'])
    expect(await getBroadcastTargetCount('all')).toBe(2)
  })

  it("getBroadcastTargetCount accepts 'missing-tournament-tips'", async () => {
    setEligibleUserIds(['u1'])
    expect(await getBroadcastTargetCount('missing-tournament-tips')).toBe(1)
  })

  it("getBroadcastTargetCount accepts 'missing-today-match-tips'", async () => {
    setEligibleUserIds(['u1', 'u2'])
    expect(await getBroadcastTargetCount('missing-today-match-tips')).toBe(2)
  })

  it("broadcastToAllUsers defaults to 'all' segment when not given", async () => {
    setEligibleUserIds(['u1'])
    const result = await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' })
    expect(result.totalTargets).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledWith('u1', expect.anything(), expect.anything())
  })

  it("broadcastToAllUsers passes 'missing-tournament-tips' through to lookup", async () => {
    setEligibleUserIds(['u1', 'u2'])
    const result = await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' }, 'missing-tournament-tips')
    expect(result.totalTargets).toBe(2)
    expect(result.delivered).toBe(2)
  })

  it("broadcastToAllUsers passes 'missing-today-match-tips' through to lookup", async () => {
    setEligibleUserIds(['u3'])
    const result = await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' }, 'missing-today-match-tips')
    expect(result.totalTargets).toBe(1)
    expect(mockSendToUser).toHaveBeenCalledWith('u3', expect.anything(), expect.anything())
  })

  it('audit log includes the segment field', async () => {
    setEligibleUserIds(['u1'])
    await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' }, 'missing-tournament-tips')
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      newValue: expect.objectContaining({ segment: 'missing-tournament-tips' }),
    }))
  })

  it("audit log includes segment='all' when default", async () => {
    setEligibleUserIds(['u1'])
    await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' })
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
      newValue: expect.objectContaining({ segment: 'all' }),
    }))
  })

  it('returns zero targets gracefully for any segment with no matches', async () => {
    setEligibleUserIds([])
    const result = await broadcastToAllUsers('actor-1', { title: 'T', body: 'B' }, 'missing-tournament-tips')
    expect(result).toEqual({ totalTargets: 0, delivered: 0, failed: 0, errors: [] })
    expect(mockSendToUser).not.toHaveBeenCalled()
  })
})

describe('listEligibleUsersBySegment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setUserRows(rows: Array<{ id: string; displayName: string | null; email: string }>): void {
    const orderBy = vi.fn().mockResolvedValueOnce(rows)
    const where = vi.fn().mockReturnValue({ orderBy })
    const from = vi.fn().mockReturnValue({ where })
    mockSelect.mockReturnValueOnce({ from })
  }

  it("returns user summaries for 'all' segment", async () => {
    setUserRows([
      { id: 'u1', displayName: 'Alice', email: 'a@x.hu' },
      { id: 'u2', displayName: 'Bob', email: 'b@x.hu' },
    ])
    const result = await listEligibleUsersBySegment('all')
    expect(result).toEqual([
      { id: 'u1', displayName: 'Alice', email: 'a@x.hu' },
      { id: 'u2', displayName: 'Bob', email: 'b@x.hu' },
    ])
  })

  it("works for 'missing-tournament-tips'", async () => {
    setUserRows([{ id: 'u1', displayName: 'Carl', email: 'c@x.hu' }])
    const result = await listEligibleUsersBySegment('missing-tournament-tips')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('u1')
  })

  it("works for 'missing-today-match-tips'", async () => {
    setUserRows([{ id: 'u3', displayName: null, email: 'd@x.hu' }])
    const result = await listEligibleUsersBySegment('missing-today-match-tips')
    expect(result).toEqual([{ id: 'u3', displayName: null, email: 'd@x.hu' }])
  })

  it('returns empty array when no eligible users', async () => {
    setUserRows([])
    const result = await listEligibleUsersBySegment('all')
    expect(result).toEqual([])
  })
})
