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
  users: { id: 'users.id', pushEnabled: 'users.pushEnabled', deletedAt: 'users.deletedAt' },
  auditLogs: 'auditLogs',
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  eq: vi.fn((c: unknown, v: unknown) => ({ __eq: [c, v] })),
  isNull: vi.fn((c: unknown) => ({ __isNull: c })),
}))

vi.mock('../src/services/webpush.service.js', () => ({
  sendToUser: mockSendToUser,
}))

import { broadcastToAllUsers, getBroadcastTargetCount } from '../src/services/admin-push.service.js'

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

  it('sends to every eligible user with admin_broadcast type and tag', async () => {
    setEligibleUserIds(['u1', 'u2'])
    const result = await broadcastToAllUsers('actor-1', { title: 'Hi', body: 'Test' })
    expect(result).toEqual({ totalTargets: 2, delivered: 2, failed: 0, errors: [] })
    expect(mockSendToUser).toHaveBeenCalledTimes(2)
    expect(mockSendToUser).toHaveBeenCalledWith('u1',
      expect.objectContaining({ title: 'Hi', body: 'Test', tag: 'admin_broadcast' }),
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
