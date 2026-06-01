import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockGetScoringExplainer } = vi.hoisted(() => ({
  mockGetScoringExplainer: vi.fn(),
}))

vi.mock('../src/services/scoring-explainer.service.js', () => ({
  getScoringExplainer: mockGetScoringExplainer,
}))

vi.mock('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: async (ctx: any, next: any) => {
    if (ctx.headers.authorization === 'Bearer valid') {
      ctx.state.user = { id: 'user-1' }
      await next()
    } else {
      ctx.status = 401
      ctx.body = { error: 'Unauthorized' }
    }
  },
}))

import app from '../src/app.js'

describe('GET /api/scoring/explainer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('200 valid tokennel', async () => {
    mockGetScoringExplainer.mockResolvedValue({ default: { exactScore: 3 }, defaultFrozenAt: null, groups: [] })
    const res = await request(app.callback()).get('/api/scoring/explainer').set('Authorization', 'Bearer valid')
    expect(res.status).toBe(200)
    expect(res.body.default.exactScore).toBe(3)
    expect(mockGetScoringExplainer).toHaveBeenCalledWith('user-1')
  })

  it('401 token nélkül', async () => {
    const res = await request(app.callback()).get('/api/scoring/explainer')
    expect(res.status).toBe(401)
  })
})
