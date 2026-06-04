import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const {
  mockSubscribe, mockUnsubscribe, mockMarkClicked, mockSetPushEnabled, mockGetPushStatus, mockUpsertUser,
  mockListDevices, mockRemoveDevice, mockDisableAll,
} = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockMarkClicked: vi.fn(),
  mockSetPushEnabled: vi.fn(),
  mockGetPushStatus: vi.fn(),
  mockUpsertUser: vi.fn(),
  mockListDevices: vi.fn(),
  mockRemoveDevice: vi.fn(),
  mockDisableAll: vi.fn(),
}))

vi.mock('../src/services/push.service.js', () => ({
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
  markClicked: mockMarkClicked,
  setPushEnabled: mockSetPushEnabled,
  getPushStatus: mockGetPushStatus,
  listDevices: mockListDevices,
  removeDevice: mockRemoveDevice,
  disableAll: mockDisableAll,
}))

vi.mock('../src/services/user.service.js', () => ({
  upsertUser: mockUpsertUser,
}))

vi.mock('../src/middleware/auth.middleware.js', () => ({
  authMiddleware: async (ctx: { headers: Record<string, string>; state: Record<string, unknown>; status?: number; body?: unknown }, next: () => Promise<void>) => {
    if (ctx.headers.authorization === 'Bearer valid') {
      ctx.state.user = { supabaseId: 'sup-1' }
      await next()
    } else {
      ctx.status = 401
      ctx.body = { error: 'Unauthorized' }
    }
  },
}))

import { app } from '../src/app.js'

describe('push.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertUser.mockResolvedValue({ id: 'user-1', supabaseId: 'sup-1' })
    mockSubscribe.mockResolvedValue(undefined)
    mockUnsubscribe.mockResolvedValue(undefined)
    mockMarkClicked.mockResolvedValue(undefined)
    mockSetPushEnabled.mockResolvedValue(undefined)
    mockGetPushStatus.mockResolvedValue({ pushEnabled: true, activeSubscriptions: 1 })
    mockListDevices.mockResolvedValue([])
    mockRemoveDevice.mockResolvedValue({ removed: true, remainingDevices: 0, pushEnabled: false })
    mockDisableAll.mockResolvedValue(undefined)
  })

  describe('GET /api/push/status', () => {
    it('401 without token', async () => {
      const res = await request(app.callback()).get('/api/push/status')
      expect(res.status).toBe(401)
    })
    it('returns push status with valid token', async () => {
      const res = await request(app.callback()).get('/api/push/status').set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ pushEnabled: true, activeSubscriptions: 1 })
      expect(mockGetPushStatus).toHaveBeenCalledWith('user-1')
    })
  })

  describe('POST /api/push/subscribe', () => {
    const validBody = { endpoint: 'https://push.example.com/x', auth: 'a', p256dh: 'p' }

    it('401 without token', async () => {
      const res = await request(app.callback()).post('/api/push/subscribe').send(validBody)
      expect(res.status).toBe(401)
    })

    it('201 with valid body, calls subscribe', async () => {
      const res = await request(app.callback())
        .post('/api/push/subscribe')
        .set('Authorization', 'Bearer valid')
        .send({ ...validBody, userAgent: 'Mozilla/5.0' })
      expect(res.status).toBe(201)
      expect(mockSubscribe).toHaveBeenCalledWith({
        userId: 'user-1',
        endpoint: 'https://push.example.com/x',
        auth: 'a',
        p256dh: 'p',
        userAgent: 'Mozilla/5.0',
      })
    })

    it('400 when endpoint is missing', async () => {
      const res = await request(app.callback())
        .post('/api/push/subscribe')
        .set('Authorization', 'Bearer valid')
        .send({ auth: 'a', p256dh: 'p' })
      expect(res.status).toBe(400)
      expect(mockSubscribe).not.toHaveBeenCalled()
    })

    it('400 when auth or p256dh missing', async () => {
      const res = await request(app.callback())
        .post('/api/push/subscribe')
        .set('Authorization', 'Bearer valid')
        .send({ endpoint: 'https://x' })
      expect(res.status).toBe(400)
    })

    it('truncates userAgent over 500 chars', async () => {
      const longUa = 'A'.repeat(800)
      await request(app.callback())
        .post('/api/push/subscribe')
        .set('Authorization', 'Bearer valid')
        .send({ ...validBody, userAgent: longUa })
      const call = mockSubscribe.mock.calls[0]?.[0] as { userAgent: string }
      expect(call.userAgent.length).toBe(500)
    })
  })

  describe('DELETE /api/push/subscribe', () => {
    it('401 without token', async () => {
      const res = await request(app.callback()).delete('/api/push/subscribe')
      expect(res.status).toBe(401)
    })

    it('204 with no body deletes all subscriptions', async () => {
      const res = await request(app.callback())
        .delete('/api/push/subscribe')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(204)
      expect(mockUnsubscribe).toHaveBeenCalledWith('user-1', undefined)
    })

    it('204 with endpoint deletes specific subscription', async () => {
      const res = await request(app.callback())
        .delete('/api/push/subscribe')
        .set('Authorization', 'Bearer valid')
        .send({ endpoint: 'https://x' })
      expect(res.status).toBe(204)
      expect(mockUnsubscribe).toHaveBeenCalledWith('user-1', 'https://x')
    })
  })

  describe('PUT /api/users/me/push-enabled', () => {
    it('401 without token', async () => {
      const res = await request(app.callback()).put('/api/users/me/push-enabled').send({ enabled: false })
      expect(res.status).toBe(401)
    })

    it('400 when enabled is not boolean', async () => {
      const res = await request(app.callback())
        .put('/api/users/me/push-enabled')
        .set('Authorization', 'Bearer valid')
        .send({ enabled: 'yes' })
      expect(res.status).toBe(400)
      expect(mockSetPushEnabled).not.toHaveBeenCalled()
    })

    it('toggles pushEnabled', async () => {
      const res = await request(app.callback())
        .put('/api/users/me/push-enabled')
        .set('Authorization', 'Bearer valid')
        .send({ enabled: false })
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ pushEnabled: false })
      expect(mockSetPushEnabled).toHaveBeenCalledWith('user-1', false)
    })
  })

  describe('POST /api/push/clicked', () => {
    it('public endpoint — no auth required', async () => {
      const res = await request(app.callback())
        .post('/api/push/clicked')
        .send({ logId: 'log-1' })
      expect(res.status).toBe(204)
      expect(mockMarkClicked).toHaveBeenCalledWith('log-1')
    })

    it('400 when logId missing', async () => {
      const res = await request(app.callback()).post('/api/push/clicked').send({})
      expect(res.status).toBe(400)
      expect(mockMarkClicked).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/push/devices', () => {
    it('401 without token', async () => {
      const res = await request(app.callback()).get('/api/push/devices')
      expect(res.status).toBe(401)
    })

    it('returns devices for authenticated user', async () => {
      const devices = [
        { id: 'd1', endpoint: 'e1', browserName: 'Chrome (macOS)', createdAt: '2026-06-01T00:00:00Z', lastUsedAt: '2026-06-03T00:00:00Z' },
      ]
      mockListDevices.mockResolvedValueOnce(devices)
      const res = await request(app.callback()).get('/api/push/devices').set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ devices })
      expect(mockListDevices).toHaveBeenCalledWith('user-1')
    })
  })

  describe('DELETE /api/push/devices/:id', () => {
    it('401 without token', async () => {
      const res = await request(app.callback()).delete('/api/push/devices/d1')
      expect(res.status).toBe(401)
    })

    it('200 with success body when removed', async () => {
      mockRemoveDevice.mockResolvedValueOnce({ removed: true, remainingDevices: 1, pushEnabled: true })
      const res = await request(app.callback())
        .delete('/api/push/devices/d1')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true, remainingDevices: 1, pushEnabled: true })
      expect(mockRemoveDevice).toHaveBeenCalledWith('user-1', 'd1')
    })

    it('404 when device does not belong to the user', async () => {
      mockRemoveDevice.mockResolvedValueOnce({ removed: false, remainingDevices: 0, pushEnabled: false })
      const res = await request(app.callback())
        .delete('/api/push/devices/foreign')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/push/disable-all', () => {
    it('401 without token', async () => {
      const res = await request(app.callback()).post('/api/push/disable-all')
      expect(res.status).toBe(401)
    })

    it('soft-deletes everything for the user', async () => {
      const res = await request(app.callback())
        .post('/api/push/disable-all')
        .set('Authorization', 'Bearer valid')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ success: true })
      expect(mockDisableAll).toHaveBeenCalledWith('user-1')
    })
  })
})
