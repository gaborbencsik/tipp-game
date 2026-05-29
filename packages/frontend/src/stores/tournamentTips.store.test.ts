import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { SpecialPredictionWithType } from '@/types/index'

const { mockGetSession, mockTournamentTipsList, mockTournamentTipsUpsert, mockTournamentTipsAccess } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockTournamentTipsList: vi.fn(),
  mockTournamentTipsUpsert: vi.fn(),
  mockTournamentTipsAccess: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    tournamentTips: {
      list: mockTournamentTipsList,
      upsert: mockTournamentTipsUpsert,
      access: mockTournamentTipsAccess,
    },
  },
}))

import { useTournamentTipsStore } from '@/stores/tournamentTips.store'

const TIP_OPEN: SpecialPredictionWithType = {
  id: null,
  typeId: 'type-1',
  typeName: 'Top scorer',
  typeDescription: null,
  inputType: 'player_select',
  options: null,
  deadline: '2026-07-01T00:00:00.000Z',
  maxPoints: 10,
  answer: null,
  answerLabel: null,
  points: null,
  correctAnswer: null,
  correctAnswerLabel: null,
  isGlobal: true,
  createdAt: null,
  updatedAt: null,
}

const TIP_FILLED: SpecialPredictionWithType = {
  ...TIP_OPEN,
  id: 'pred-1',
  answer: 'player-uuid-1',
  answerLabel: 'Lionel Messi',
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

describe('tournamentTips.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockTournamentTipsList.mockReset()
    mockTournamentTipsUpsert.mockReset()
    mockTournamentTipsAccess.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  it('has empty initial state', () => {
    const store = useTournamentTipsStore()
    expect(store.tips).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.saveStatusByTypeId).toEqual({})
    expect(store.hasAccess).toBeNull()
  })

  it('fetchAccess sets hasAccess true when API returns true', async () => {
    mockTournamentTipsAccess.mockResolvedValueOnce({ hasAccess: true })
    const store = useTournamentTipsStore()
    await store.fetchAccess()
    expect(store.hasAccess).toBe(true)
  })

  it('fetchAccess sets hasAccess false when API returns false', async () => {
    mockTournamentTipsAccess.mockResolvedValueOnce({ hasAccess: false })
    const store = useTournamentTipsStore()
    await store.fetchAccess()
    expect(store.hasAccess).toBe(false)
  })

  it('fetchAccess sets hasAccess false when API errors', async () => {
    mockTournamentTipsAccess.mockRejectedValueOnce(new Error('Network'))
    const store = useTournamentTipsStore()
    await store.fetchAccess()
    expect(store.hasAccess).toBe(false)
  })

  it('fetchTips loads tips from API', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN])
    const store = useTournamentTipsStore()
    await store.fetchTips()
    expect(mockTournamentTipsList).toHaveBeenCalledWith('mock-token')
    expect(store.tips).toEqual([TIP_OPEN])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.hasAccess).toBe(true)
  })

  it('fetchTips treats 403 No tournament access as hasAccess=false (no error)', async () => {
    mockTournamentTipsList.mockRejectedValueOnce(new Error('No tournament access — join a group with the WC league first'))
    const store = useTournamentTipsStore()
    await store.fetchTips()
    expect(store.hasAccess).toBe(false)
    expect(store.error).toBeNull()
    expect(store.tips).toEqual([])
  })

  it('fetchTips records error on generic API failure', async () => {
    mockTournamentTipsList.mockRejectedValueOnce(new Error('Network down'))
    const store = useTournamentTipsStore()
    await store.fetchTips()
    expect(store.error).toBe('Network down')
    expect(store.tips).toEqual([])
    expect(store.isLoading).toBe(false)
  })

  it('upsertTip replaces matching tip and marks saved', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_OPEN])
    mockTournamentTipsUpsert.mockResolvedValueOnce(TIP_FILLED)
    const store = useTournamentTipsStore()
    await store.fetchTips()
    await store.upsertTip({ typeId: 'type-1', answer: 'player-uuid-1' })
    expect(mockTournamentTipsUpsert).toHaveBeenCalledWith('mock-token', { typeId: 'type-1', answer: 'player-uuid-1' })
    expect(store.tips).toEqual([TIP_FILLED])
    expect(store.saveStatusByTypeId['type-1']).toBe('saved')
  })

  it('upsertTip flags error status and rethrows', async () => {
    mockTournamentTipsUpsert.mockRejectedValueOnce(new Error('Deadline passed'))
    const store = useTournamentTipsStore()
    await expect(store.upsertTip({ typeId: 'type-1', answer: 'x' })).rejects.toThrow('Deadline passed')
    expect(store.saveStatusByTypeId['type-1']).toBe('error')
  })

  it('reset clears state', async () => {
    mockTournamentTipsList.mockResolvedValueOnce([TIP_FILLED])
    const store = useTournamentTipsStore()
    await store.fetchTips()
    store.reset()
    expect(store.tips).toEqual([])
    expect(store.error).toBeNull()
    expect(store.saveStatusByTypeId).toEqual({})
  })
})
