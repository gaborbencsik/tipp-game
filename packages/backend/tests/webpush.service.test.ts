import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSelect, mockInsert, mockUpdate,
  mockUserFrom, mockUserWhere, mockUserLimit,
  mockSubFrom, mockSubWhere,
  mockCountFrom, mockCountWhere,
  mockInsertValues, mockOnConflict,
  mockUpdateSet, mockUpdateWhere,
  mockSendNotification, mockSetVapidDetails,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockUserFrom: vi.fn(),
  mockUserWhere: vi.fn(),
  mockUserLimit: vi.fn(),
  mockSubFrom: vi.fn(),
  mockSubWhere: vi.fn(),
  mockCountFrom: vi.fn(),
  mockCountWhere: vi.fn(),
  mockInsertValues: vi.fn(),
  mockOnConflict: vi.fn(() => Promise.resolve()),
  mockUpdateSet: vi.fn(),
  mockUpdateWhere: vi.fn(() => Promise.resolve()),
  mockSendNotification: vi.fn(() => Promise.resolve()),
  mockSetVapidDetails: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}))

vi.mock('../src/db/schema/index.js', () => ({
  users: { id: 'users.id', pushEnabled: 'users.pushEnabled' },
  pushSubscriptions: {
    id: 'ps.id',
    userId: 'ps.userId',
    endpoint: 'ps.endpoint',
    auth: 'ps.auth',
    p256dh: 'ps.p256dh',
    deletedAt: 'ps.deletedAt',
    lastUsedAt: 'ps.lastUsedAt',
  },
  pushNotificationLog: {
    userId: 'pnl.userId',
    type: 'pnl.type',
    scopeKey: 'pnl.scopeKey',
    endpoint: 'pnl.endpoint',
    skippedReason: 'pnl.skippedReason',
    sentAt: 'pnl.sentAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ __eq: [a, b] })),
  and: vi.fn((...args) => ({ __and: args })),
  isNull: vi.fn((a) => ({ __isNull: a })),
  gte: vi.fn((a, b) => ({ __gte: [a, b] })),
  sql: Object.assign(vi.fn(() => 'sql-expr'), { raw: vi.fn() }),
}))

vi.mock('web-push', () => ({
  default: {
    sendNotification: mockSendNotification,
    setVapidDetails: mockSetVapidDetails,
  },
}))

import {
  sendToUser,
  isQuietHourBudapest,
  PushPayloadError,
} from '../src/services/webpush.service.js'

const USER_ID = 'user-1'
const SUB = {
  id: 'sub-1',
  endpoint: 'https://push.example.com/sub-1',
  auth: 'auth-key',
  p256dh: 'p256dh-key',
}
const PAYLOAD = { title: 'Hello', body: 'World' }

function setupHarness(opts: {
  userPushEnabled?: boolean | null
  subs?: Array<typeof SUB>
  recentCount?: number
} = {}) {
  const userPushEnabled = 'userPushEnabled' in opts ? opts.userPushEnabled : true
  const subs = opts.subs ?? [SUB]
  const recentCount = opts.recentCount ?? 0

  // user select chain: select().from(users).where(...).limit(1)
  mockUserLimit.mockResolvedValue(userPushEnabled === null ? [] : [{ pushEnabled: userPushEnabled }])
  mockUserWhere.mockReturnValue({ limit: mockUserLimit })
  mockUserFrom.mockReturnValue({ where: mockUserWhere })

  // count select chain: select({c}).from(pushNotificationLog).where(...) -> resolves
  mockCountWhere.mockResolvedValue([{ c: recentCount }])
  mockCountFrom.mockReturnValue({ where: mockCountWhere })

  // subs select chain: select().from(pushSubscriptions).where(...) -> resolves
  mockSubWhere.mockResolvedValue(subs)
  mockSubFrom.mockReturnValue({ where: mockSubWhere })

  // select() routing — must return the correct chain by call order:
  // 1) users, 2) (rate-limit count) | (subs), 3) subs (after rate-limit)
  // We track call index and pick the right `from` by which table is requested.
  mockSelect.mockImplementation((arg?: unknown) => {
    if (arg && typeof arg === 'object' && 'c' in (arg as object)) {
      return { from: mockCountFrom }
    }
    if (arg && typeof arg === 'object' && 'pushEnabled' in (arg as object)) {
      return { from: mockUserFrom }
    }
    return { from: mockSubFrom }
  })

  // insert (logEntry) chain
  mockOnConflict.mockResolvedValue(undefined)
  mockInsertValues.mockReturnValue({ onConflictDoNothing: mockOnConflict })
  mockInsert.mockReturnValue({ values: mockInsertValues })

  // update chain (sub lastUsedAt / soft delete)
  mockUpdateWhere.mockResolvedValue(undefined)
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere })
  mockUpdate.mockReturnValue({ set: mockUpdateSet })
}

describe('webpush.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnConflict.mockResolvedValue(undefined)
    mockSendNotification.mockResolvedValue(undefined)
  })

  describe('payload validation', () => {
    it('throws when title is empty', async () => {
      await expect(sendToUser(USER_ID, { title: '', body: 'b' })).rejects.toBeInstanceOf(PushPayloadError)
    })

    it('throws when body is empty', async () => {
      await expect(sendToUser(USER_ID, { title: 't', body: '' })).rejects.toBeInstanceOf(PushPayloadError)
    })

    it('throws when title is whitespace only', async () => {
      await expect(sendToUser(USER_ID, { title: '   ', body: 'b' })).rejects.toBeInstanceOf(PushPayloadError)
    })
  })

  describe('quiet hours (Europe/Budapest)', () => {
    it('22:30 Budapest → quiet hour', () => {
      // 2026-01-15 21:30 UTC = 22:30 CET (winter, UTC+1)
      expect(isQuietHourBudapest(new Date('2026-01-15T21:30:00Z'))).toBe(true)
    })

    it('06:30 Budapest → quiet hour', () => {
      expect(isQuietHourBudapest(new Date('2026-01-15T05:30:00Z'))).toBe(true)
    })

    it('07:00 Budapest → not quiet', () => {
      expect(isQuietHourBudapest(new Date('2026-01-15T06:00:00Z'))).toBe(false)
    })

    it('21:59 Budapest → not quiet', () => {
      expect(isQuietHourBudapest(new Date('2026-01-15T20:59:00Z'))).toBe(false)
    })

    it('DST: 23:00 Budapest in summer (UTC+2) → quiet hour', () => {
      // 2026-07-15 21:00 UTC = 23:00 CEST
      expect(isQuietHourBudapest(new Date('2026-07-15T21:00:00Z'))).toBe(true)
    })

    it('DST: 06:30 Budapest in summer (UTC+2) → quiet hour', () => {
      // 2026-07-15 04:30 UTC = 06:30 CEST
      expect(isQuietHourBudapest(new Date('2026-07-15T04:30:00Z'))).toBe(true)
    })
  })

  describe('sendToUser', () => {
    const dayTimeBudapest = new Date('2026-01-15T10:00:00Z') // 11:00 CET, daytime

    it('skips with push_disabled when user.pushEnabled is false', async () => {
      setupHarness({ userPushEnabled: false })
      await sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })

      expect(mockSendNotification).not.toHaveBeenCalled()
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ skippedReason: 'push_disabled' }))
    })

    it('returns silently when user does not exist (no log)', async () => {
      setupHarness({ userPushEnabled: null })
      await sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })
      expect(mockSendNotification).not.toHaveBeenCalled()
      expect(mockInsertValues).not.toHaveBeenCalled()
    })

    it('skips with quiet_hours during quiet window', async () => {
      setupHarness()
      const quietTime = new Date('2026-01-15T22:00:00Z') // 23:00 CET
      await sendToUser(USER_ID, PAYLOAD, { now: quietTime })

      expect(mockSendNotification).not.toHaveBeenCalled()
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ skippedReason: 'quiet_hours' }))
    })

    it('bypassQuietHours sends in quiet window', async () => {
      setupHarness()
      const quietTime = new Date('2026-01-15T22:00:00Z')
      await sendToUser(USER_ID, PAYLOAD, { now: quietTime, bypassQuietHours: true })

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })

    it('skips with rate_limit when 5+ sends in last 24h', async () => {
      setupHarness({ recentCount: 5 })
      await sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })

      expect(mockSendNotification).not.toHaveBeenCalled()
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ skippedReason: 'rate_limit' }))
    })

    it('bypassRateLimit sends past the cap', async () => {
      setupHarness({ recentCount: 99 })
      await sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest, bypassRateLimit: true })

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })

    it('logs no_subscription when user has no active subscriptions', async () => {
      setupHarness({ subs: [] })
      await sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })

      expect(mockSendNotification).not.toHaveBeenCalled()
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ skippedReason: 'no_subscription' }))
    })

    it('successful send: web-push called with subscription + payload, log entry inserted', async () => {
      setupHarness()
      await sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest, type: 'admin_broadcast', scopeKey: 'broadcast-1' })

      expect(mockSendNotification).toHaveBeenCalledWith(
        { endpoint: SUB.endpoint, keys: { auth: SUB.auth, p256dh: SUB.p256dh } },
        JSON.stringify(PAYLOAD),
      )
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
        userId: USER_ID,
        type: 'admin_broadcast',
        scopeKey: 'broadcast-1',
        endpoint: SUB.endpoint,
        skippedReason: null,
      }))
    })

    it('410 Gone: subscription is soft-deleted, no throw', async () => {
      setupHarness()
      const err = Object.assign(new Error('Gone'), { statusCode: 410 })
      mockSendNotification.mockRejectedValueOnce(err)

      await expect(sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })).resolves.toBeUndefined()

      // The update was called twice in normal flow (lastUsedAt + ...) — for soft delete, only set deletedAt
      // Find the call that set deletedAt
      const setCalls = mockUpdateSet.mock.calls.map(c => c[0])
      expect(setCalls.some(s => s && typeof s === 'object' && 'deletedAt' in s)).toBe(true)
    })

    it('404: subscription is also soft-deleted (not found)', async () => {
      setupHarness()
      const err = Object.assign(new Error('Not found'), { statusCode: 404 })
      mockSendNotification.mockRejectedValueOnce(err)

      await expect(sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })).resolves.toBeUndefined()
      const setCalls = mockUpdateSet.mock.calls.map(c => c[0])
      expect(setCalls.some(s => s && typeof s === 'object' && 'deletedAt' in s)).toBe(true)
    })

    it('500-class error: not soft-deleted, re-throws', async () => {
      setupHarness()
      const err = Object.assign(new Error('Server error'), { statusCode: 500 })
      mockSendNotification.mockRejectedValueOnce(err)

      await expect(sendToUser(USER_ID, PAYLOAD, { now: dayTimeBudapest })).rejects.toBe(err)
      const setCalls = mockUpdateSet.mock.calls.map(c => c[0])
      expect(setCalls.some(s => s && typeof s === 'object' && 'deletedAt' in s)).toBe(false)
    })
  })
})
