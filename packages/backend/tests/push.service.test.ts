import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../src/db/client.js', () => ({ db: mockDb }))

vi.mock('../src/db/schema/index.js', () => ({
  pushSubscriptions: {
    id: 'ps.id',
    userId: 'ps.userId',
    endpoint: 'ps.endpoint',
    auth: 'ps.auth',
    p256dh: 'ps.p256dh',
    userAgent: 'ps.userAgent',
    createdAt: 'ps.createdAt',
    lastUsedAt: 'ps.lastUsedAt',
    deletedAt: 'ps.deletedAt',
  },
  pushNotificationLog: { id: 'pnl.id', clickedAt: 'pnl.clickedAt' },
  users: { id: 'users.id', pushEnabled: 'users.pushEnabled', updatedAt: 'users.updatedAt' },
}))

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  eq: vi.fn((c: unknown, v: unknown) => ({ __eq: [c, v] })),
  isNull: vi.fn((c: unknown) => ({ __isNull: c })),
  desc: vi.fn((c: unknown) => ({ __desc: c })),
  sql: Object.assign(vi.fn((parts: TemplateStringsArray) => ({ __sql: parts.join('') })), {}),
}))

vi.mock('../src/services/user-agent.service.js', () => ({
  parseBrowserName: (ua: string | null | undefined) => ua ? `Browser(${ua})` : 'Unknown browser',
}))

import { subscribe, listDevices, removeDevice, disableAll } from '../src/services/push.service.js'

interface TxStub {
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function buildTx(): TxStub {
  return {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  }
}

describe('push.service.subscribe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts subscription and re-activates pushEnabled within a transaction', async () => {
    const tx = buildTx()
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const insertValues = vi.fn().mockReturnValue({ onConflictDoUpdate })
    tx.insert.mockReturnValue({ values: insertValues })

    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    tx.update.mockReturnValue({ set: updateSet })

    mockDb.transaction.mockImplementation(async (cb: (t: TxStub) => Promise<void>) => cb(tx))

    await subscribe({ userId: 'u1', endpoint: 'https://x', auth: 'a', p256dh: 'p', userAgent: 'UA/1.0' })

    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', endpoint: 'https://x', auth: 'a', p256dh: 'p', userAgent: 'UA/1.0',
    }))
    expect(onConflictDoUpdate).toHaveBeenCalled()
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ pushEnabled: true }))
  })
})

describe('push.service.listDevices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns active devices with parsed browser names, ordered by createdAt desc', async () => {
    const rows = [
      { id: 'd1', endpoint: 'e1', userAgent: 'Chrome', createdAt: new Date('2026-06-01'), lastUsedAt: new Date('2026-06-03') },
      { id: 'd2', endpoint: 'e2', userAgent: null,    createdAt: new Date('2026-05-20'), lastUsedAt: null },
    ]
    const orderBy = vi.fn().mockResolvedValue(rows)
    const where = vi.fn().mockReturnValue({ orderBy })
    const from = vi.fn().mockReturnValue({ where })
    mockDb.select.mockReturnValue({ from })

    const result = await listDevices('u1')

    expect(result).toEqual([
      { id: 'd1', endpoint: 'e1', browserName: 'Browser(Chrome)', createdAt: rows[0]!.createdAt, lastUsedAt: rows[0]!.lastUsedAt },
      { id: 'd2', endpoint: 'e2', browserName: 'Unknown browser', createdAt: rows[1]!.createdAt, lastUsedAt: null },
    ])
  })
})

describe('push.service.removeDevice', () => {
  beforeEach(() => vi.clearAllMocks())

  function setupTxFor(existing: { id: string; deletedAt: Date | null } | null, remainingCount: number, masterFlag: boolean) {
    const tx = buildTx()

    const limit = vi.fn().mockResolvedValue(existing ? [existing] : [])
    const selectWhere = vi.fn().mockReturnValue({ limit })
    const selectFrom = vi.fn().mockReturnValue({ where: selectWhere })

    const countWhere = vi.fn().mockResolvedValue([{ c: remainingCount }])
    const countFrom = vi.fn().mockReturnValue({ where: countWhere })

    const userLimit = vi.fn().mockResolvedValue([{ pushEnabled: masterFlag }])
    const userWhere = vi.fn().mockReturnValue({ limit: userLimit })
    const userFrom = vi.fn().mockReturnValue({ where: userWhere })

    let selectCallIndex = 0
    tx.select.mockImplementation(() => {
      const idx = selectCallIndex++
      if (idx === 0) return { from: selectFrom }
      if (idx === 1) return { from: countFrom }
      return { from: userFrom }
    })

    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    tx.update.mockReturnValue({ set: updateSet })

    mockDb.transaction.mockImplementation(async (cb: (t: TxStub) => Promise<unknown>) => cb(tx))
    return { tx, updateSet }
  }

  it('returns removed:false when device not found (or other user owns it)', async () => {
    setupTxFor(null, 0, false)
    const result = await removeDevice('u1', 'missing')
    expect(result).toEqual({ removed: false, remainingDevices: 0, pushEnabled: false })
  })

  it('soft-deletes device and returns remaining count + flag', async () => {
    const { updateSet } = setupTxFor({ id: 'd1', deletedAt: null }, 2, true)
    const result = await removeDevice('u1', 'd1')
    expect(result).toEqual({ removed: true, remainingDevices: 2, pushEnabled: true })
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }))
  })

  it('idempotent: when device already deleted, does NOT re-update sub but still returns counts', async () => {
    const { updateSet } = setupTxFor({ id: 'd1', deletedAt: new Date('2026-05-01') }, 1, true)
    const result = await removeDevice('u1', 'd1')
    expect(result).toEqual({ removed: true, remainingDevices: 1, pushEnabled: true })
    expect(updateSet).not.toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }))
  })

  it('when last device removed, sets pushEnabled=false', async () => {
    const { updateSet } = setupTxFor({ id: 'd1', deletedAt: null }, 0, true)
    const result = await removeDevice('u1', 'd1')
    expect(result).toEqual({ removed: true, remainingDevices: 0, pushEnabled: false })
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ pushEnabled: false }))
  })
})

describe('push.service.disableAll', () => {
  beforeEach(() => vi.clearAllMocks())

  it('soft-deletes all subs and sets pushEnabled=false in a transaction', async () => {
    const tx = buildTx()
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    tx.update.mockReturnValue({ set: updateSet })

    mockDb.transaction.mockImplementation(async (cb: (t: TxStub) => Promise<unknown>) => cb(tx))

    await disableAll('u1')

    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }))
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ pushEnabled: false }))
  })
})
