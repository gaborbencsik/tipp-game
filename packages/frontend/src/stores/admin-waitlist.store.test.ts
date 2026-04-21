import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { WaitlistListResult } from '@/types/index'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

const { mockWaitlistList, mockWaitlistDelete, mockWaitlistAdd } = vi.hoisted(() => ({
  mockWaitlistList: vi.fn(),
  mockWaitlistDelete: vi.fn(),
  mockWaitlistAdd: vi.fn(),
}))

vi.mock('@/api/index', () => ({
  api: {
    admin: { waitlist: { list: mockWaitlistList, delete: mockWaitlistDelete, add: mockWaitlistAdd } },
  },
}))

import { useAdminWaitlistStore } from '@/stores/admin-waitlist.store'

const MOCK_RESULT: WaitlistListResult = {
  totalCount: 2,
  entries: [
    { id: 'uuid-1', email: 'alice@example.com', source: 'hero', createdAt: '2026-04-20T10:00:00.000Z' },
    { id: 'uuid-2', email: 'bob@example.com', source: 'footer', createdAt: '2026-04-19T08:00:00.000Z' },
  ],
}

const EMPTY_RESULT: WaitlistListResult = {
  totalCount: 0,
  entries: [],
}

describe('admin-waitlist.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockWaitlistList.mockReset()
  })

  // ─── initial state ─────────────────────────────────────────────────────────

  it('initial entries is empty', () => {
    const store = useAdminWaitlistStore()
    expect(store.entries).toEqual([])
  })

  it('initial totalCount is 0', () => {
    const store = useAdminWaitlistStore()
    expect(store.totalCount).toBe(0)
  })

  it('initial isLoading is false', () => {
    const store = useAdminWaitlistStore()
    expect(store.isLoading).toBe(false)
  })

  it('initial error is null', () => {
    const store = useAdminWaitlistStore()
    expect(store.error).toBeNull()
  })

  // ─── fetchWaitlist ─────────────────────────────────────────────────────────

  it('fetchWaitlist() populates entries and totalCount', async () => {
    mockWaitlistList.mockResolvedValue(MOCK_RESULT)
    const store = useAdminWaitlistStore()
    await store.fetchWaitlist()
    expect(store.entries).toEqual(MOCK_RESULT.entries)
    expect(store.totalCount).toBe(2)
  })

  it('fetchWaitlist() sets isLoading false after completion', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    await store.fetchWaitlist()
    expect(store.isLoading).toBe(false)
  })

  it('fetchWaitlist() error sets error message', async () => {
    mockWaitlistList.mockRejectedValue(new Error('Network error'))
    const store = useAdminWaitlistStore()
    await store.fetchWaitlist()
    expect(store.error).toBe('Network error')
    expect(store.entries).toEqual([])
    expect(store.totalCount).toBe(0)
  })

  it('fetchWaitlist() handles empty result', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    await store.fetchWaitlist()
    expect(store.entries).toEqual([])
    expect(store.totalCount).toBe(0)
  })

  // ─── filters ───────────────────────────────────────────────────────────────

  it('fetchWaitlist() passes source filter to API', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    store.setSourceFilter('hero')
    await store.fetchWaitlist()
    expect(mockWaitlistList).toHaveBeenCalledWith('', { source: 'hero' })
  })

  it('fetchWaitlist() passes search filter to API', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    store.setSearchFilter('alice')
    await store.fetchWaitlist()
    expect(mockWaitlistList).toHaveBeenCalledWith('', { search: 'alice' })
  })

  it('fetchWaitlist() passes both filters to API', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    store.setSourceFilter('footer')
    store.setSearchFilter('bob')
    await store.fetchWaitlist()
    expect(mockWaitlistList).toHaveBeenCalledWith('', { source: 'footer', search: 'bob' })
  })

  it('setSourceFilter(undefined) clears source filter', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    store.setSourceFilter('hero')
    store.setSourceFilter(undefined)
    await store.fetchWaitlist()
    expect(mockWaitlistList).toHaveBeenCalledWith('', {})
  })

  it('setSearchFilter("") clears search filter', async () => {
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    store.setSearchFilter('test')
    store.setSearchFilter('')
    await store.fetchWaitlist()
    expect(mockWaitlistList).toHaveBeenCalledWith('', {})
  })

  // ─── initial state for new fields ─────────────────────────────────────────

  it('initial addError is null', () => {
    const store = useAdminWaitlistStore()
    expect(store.addError).toBeNull()
  })

  it('initial deletingId is null', () => {
    const store = useAdminWaitlistStore()
    expect(store.deletingId).toBeNull()
  })

  it('initial isAdding is false', () => {
    const store = useAdminWaitlistStore()
    expect(store.isAdding).toBe(false)
  })

  // ─── deleteEntry ──────────────────────────────────────────────────────────

  it('deleteEntry() calls API and refreshes list', async () => {
    mockWaitlistDelete.mockResolvedValue(undefined)
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    await store.deleteEntry('uuid-1')
    expect(mockWaitlistDelete).toHaveBeenCalledWith('', 'uuid-1')
    expect(mockWaitlistList).toHaveBeenCalled()
  })

  it('deleteEntry() sets error on failure', async () => {
    mockWaitlistDelete.mockRejectedValue(new Error('Not found'))
    const store = useAdminWaitlistStore()
    await store.deleteEntry('uuid-1')
    expect(store.error).toBe('Not found')
  })

  it('deleteEntry() sets deletingId during operation', async () => {
    let capturedDeletingId: string | null = null
    mockWaitlistDelete.mockImplementation(async () => {
      capturedDeletingId = store.deletingId
    })
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    await store.deleteEntry('uuid-1')
    expect(capturedDeletingId).toBe('uuid-1')
    expect(store.deletingId).toBeNull()
  })

  it('deleteEntry() resets deletingId on error', async () => {
    mockWaitlistDelete.mockRejectedValue(new Error('fail'))
    const store = useAdminWaitlistStore()
    await store.deleteEntry('uuid-1')
    expect(store.deletingId).toBeNull()
  })

  // ─── addEntry ─────────────────────────────────────────────────────────────

  it('addEntry() calls API and refreshes list', async () => {
    const newEntry = { id: 'uuid-new', email: 'new@example.com', source: 'admin' as const, createdAt: '2026-04-21T12:00:00.000Z' }
    mockWaitlistAdd.mockResolvedValue(newEntry)
    mockWaitlistList.mockResolvedValue(MOCK_RESULT)
    const store = useAdminWaitlistStore()
    const result = await store.addEntry('new@example.com', 'admin')
    expect(result).toBe(true)
    expect(mockWaitlistAdd).toHaveBeenCalledWith('', 'new@example.com', 'admin')
    expect(mockWaitlistList).toHaveBeenCalled()
  })

  it('addEntry() sets addError on 409 duplicate', async () => {
    mockWaitlistAdd.mockRejectedValue(new Error('Email already on waitlist'))
    const store = useAdminWaitlistStore()
    const result = await store.addEntry('dup@example.com', 'admin')
    expect(result).toBe(false)
    expect(store.addError).toBe('Email already on waitlist')
  })

  it('addEntry() sets isAdding during operation', async () => {
    let capturedIsAdding = false
    mockWaitlistAdd.mockImplementation(async () => {
      capturedIsAdding = store.isAdding
      return { id: 'uuid-new', email: 'new@example.com', source: 'admin' as const, createdAt: '2026-04-21T12:00:00.000Z' }
    })
    mockWaitlistList.mockResolvedValue(EMPTY_RESULT)
    const store = useAdminWaitlistStore()
    await store.addEntry('new@example.com', 'admin')
    expect(capturedIsAdding).toBe(true)
    expect(store.isAdding).toBe(false)
  })

  it('addEntry() resets isAdding on error', async () => {
    mockWaitlistAdd.mockRejectedValue(new Error('fail'))
    const store = useAdminWaitlistStore()
    await store.addEntry('fail@example.com', 'admin')
    expect(store.isAdding).toBe(false)
  })
})
