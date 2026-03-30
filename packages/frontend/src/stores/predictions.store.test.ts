import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Prediction } from '@/types/index'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const { mockGetSession, mockPredictionsMine, mockPredictionsUpsert } = vi.hoisted(() => ({
  mockGetSession: vi.fn().mockResolvedValue({
    data: { session: { access_token: 'mock-token' } },
  }),
  mockPredictionsMine: vi.fn(),
  mockPredictionsUpsert: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
    matches: { list: vi.fn() },
    predictions: { mine: mockPredictionsMine, upsert: mockPredictionsUpsert },
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    user: { id: 'db-user-uuid-001', role: 'user' },
    isAuthenticated: () => true,
  }),
}))

import { usePredictionsStore } from '@/stores/predictions.store'

const PREDICTION_1: Prediction = {
  id: 'pred-1',
  userId: 'db-user-uuid-001',
  matchId: 'match-1',
  homeGoals: 2,
  awayGoals: 1,
  pointsGlobal: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
}

const PREDICTION_2: Prediction = {
  id: 'pred-2',
  userId: 'db-user-uuid-001',
  matchId: 'match-2',
  homeGoals: 0,
  awayGoals: 0,
  pointsGlobal: null,
  createdAt: '2026-06-10T11:00:00.000Z',
  updatedAt: '2026-06-10T11:00:00.000Z',
}

describe('predictions.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPredictionsMine.mockReset()
    mockPredictionsUpsert.mockReset()
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
  })

  // ─── Initial state ───────────────────────────────────────────────────────────

  it('initial predictions array is empty', () => {
    const store = usePredictionsStore()
    expect(store.predictions).toEqual([])
  })

  it('initial isLoading is false', () => {
    const store = usePredictionsStore()
    expect(store.isLoading).toBe(false)
  })

  it('initial error is null', () => {
    const store = usePredictionsStore()
    expect(store.error).toBeNull()
  })

  // ─── fetchMyPredictions ──────────────────────────────────────────────────────

  it('fetchMyPredictions() → predictions populated', async () => {
    mockPredictionsMine.mockResolvedValue([PREDICTION_1, PREDICTION_2])
    const store = usePredictionsStore()
    await store.fetchMyPredictions()
    expect(store.predictions).toEqual([PREDICTION_1, PREDICTION_2])
  })

  it('fetchMyPredictions() → isLoading false after completion', async () => {
    mockPredictionsMine.mockResolvedValue([])
    const store = usePredictionsStore()
    await store.fetchMyPredictions()
    expect(store.isLoading).toBe(false)
  })

  it('fetchMyPredictions() error → error set', async () => {
    mockPredictionsMine.mockRejectedValue(new Error('Network error'))
    const store = usePredictionsStore()
    await store.fetchMyPredictions()
    expect(store.error).toBe('Network error')
  })

  // ─── predictionByMatchId ─────────────────────────────────────────────────────

  it('predictionByMatchId → correct Prediction returned', () => {
    const store = usePredictionsStore()
    store.predictions = [PREDICTION_1, PREDICTION_2]
    expect(store.predictionByMatchId('match-1')).toEqual(PREDICTION_1)
  })

  it('predictionByMatchId unknown id → undefined', () => {
    const store = usePredictionsStore()
    store.predictions = [PREDICTION_1]
    expect(store.predictionByMatchId('ismeretlen')).toBeUndefined()
  })

  // ─── upsertPrediction ────────────────────────────────────────────────────────

  it('upsertPrediction() new prediction → added to predictions array', async () => {
    mockPredictionsUpsert.mockResolvedValue(PREDICTION_1)
    const store = usePredictionsStore()
    await store.upsertPrediction({ matchId: 'match-1', homeGoals: 2, awayGoals: 1 })
    expect(store.predictions).toHaveLength(1)
    expect(store.predictions[0]).toEqual(PREDICTION_1)
  })

  it('upsertPrediction() new prediction → saveStatus saved', async () => {
    mockPredictionsUpsert.mockResolvedValue(PREDICTION_1)
    const store = usePredictionsStore()
    await store.upsertPrediction({ matchId: 'match-1', homeGoals: 2, awayGoals: 1 })
    expect(store.saveStatus['match-1']).toBe('saved')
  })

  it('upsertPrediction() existing prediction update → in-place update, array size unchanged', async () => {
    const updated: Prediction = { ...PREDICTION_1, homeGoals: 3, awayGoals: 0 }
    mockPredictionsUpsert.mockResolvedValue(updated)
    const store = usePredictionsStore()
    store.predictions = [PREDICTION_1]
    await store.upsertPrediction({ matchId: 'match-1', homeGoals: 3, awayGoals: 0 })
    expect(store.predictions).toHaveLength(1)
    expect(store.predictions[0]?.homeGoals).toBe(3)
  })

  it('upsertPrediction() API error → saveStatus error, error set', async () => {
    mockPredictionsUpsert.mockRejectedValue(new Error('Tippelési határidő lejárt'))
    const store = usePredictionsStore()
    await store.upsertPrediction({ matchId: 'match-1', homeGoals: 1, awayGoals: 1 })
    expect(store.saveStatus['match-1']).toBe('error')
    expect(store.error).toBe('Tippelési határidő lejárt')
  })
})
