import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { serviceTokenMiddleware } from '../src/middleware/service-token.middleware.js'

function createMockCtx(authHeader?: string): any {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    status: 200,
    body: undefined,
  }
}

describe('serviceTokenMiddleware', () => {
  const originalEnv = process.env['SYNC_SERVICE_TOKEN']

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['SYNC_SERVICE_TOKEN'] = originalEnv
    } else {
      delete process.env['SYNC_SERVICE_TOKEN']
    }
  })

  it('returns 401 when SYNC_SERVICE_TOKEN is not configured', async () => {
    delete process.env['SYNC_SERVICE_TOKEN']
    const ctx = createMockCtx('Bearer some-token')
    const next = vi.fn()

    await serviceTokenMiddleware(ctx, next)

    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when no Authorization header', async () => {
    process.env['SYNC_SERVICE_TOKEN'] = 'secret-123'
    const ctx = createMockCtx()
    const next = vi.fn()

    await serviceTokenMiddleware(ctx, next)

    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token does not match', async () => {
    process.env['SYNC_SERVICE_TOKEN'] = 'secret-123'
    const ctx = createMockCtx('Bearer wrong-token')
    const next = vi.fn()

    await serviceTokenMiddleware(ctx, next)

    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('calls next() when token matches', async () => {
    process.env['SYNC_SERVICE_TOKEN'] = 'secret-123'
    const ctx = createMockCtx('Bearer secret-123')
    const next = vi.fn()

    await serviceTokenMiddleware(ctx, next)

    expect(next).toHaveBeenCalled()
    expect(ctx.status).toBe(200)
  })

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    process.env['SYNC_SERVICE_TOKEN'] = 'secret-123'
    const ctx = createMockCtx('secret-123')
    const next = vi.fn()

    await serviceTokenMiddleware(ctx, next)

    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })
})
