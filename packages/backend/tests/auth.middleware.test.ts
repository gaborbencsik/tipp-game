import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context, Next } from 'koa'
import type { AuthenticatedUser } from '../src/types/index.js'

const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}))

vi.mock('jsonwebtoken', () => ({
  default: { verify: mockVerify },
}))

import { authMiddleware } from '../src/middleware/auth.middleware.js'

const MOCK_CLAIMS = {
  sub: 'supabase-uuid-123',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' },
}

function makeCtx(authHeader?: string): Context {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    state: {},
    status: 200,
    body: undefined,
  } as unknown as Context
}

describe('authMiddleware', () => {
  const next: Next = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    mockVerify.mockReset()
    ;(next as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    process.env['NODE_ENV'] = 'test'
    process.env['SUPABASE_JWT_SECRET'] = 'test-secret'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('valid JWT → ctx.state.user filled, next() called', async () => {
    mockVerify.mockReturnValue(MOCK_CLAIMS)
    const ctx = makeCtx('Bearer valid-token')
    await authMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    const user = ctx.state['user'] as AuthenticatedUser
    expect(user.supabaseId).toBe('supabase-uuid-123')
    expect(user.email).toBe('test@example.com')
    expect(user.displayName).toBe('Test User')
    expect(user.avatarUrl).toBe('https://example.com/avatar.png')
  })

  it('missing Authorization header → 401', async () => {
    const ctx = makeCtx()
    await authMiddleware(ctx, next)
    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('invalid Bearer token → 401', async () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid signature') })
    const ctx = makeCtx('Bearer bad-token')
    await authMiddleware(ctx, next)
    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('expired token → 401', async () => {
    const expiredError = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' })
    mockVerify.mockImplementation(() => { throw expiredError })
    const ctx = makeCtx('Bearer expired-token')
    await authMiddleware(ctx, next)
    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('dev-bypass-token in test env → mock user, next() called', async () => {
    const ctx = makeCtx('Bearer dev-bypass-token')
    await authMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    const user = ctx.state['user'] as AuthenticatedUser
    expect(user.supabaseId).toBe('00000000-0000-0000-0000-000000000001')
    expect(user.email).toBe('dev@local')
  })

  it('dev-bypass-token in production → 401', async () => {
    process.env['NODE_ENV'] = 'production'
    mockVerify.mockImplementation(() => { throw new Error('invalid') })
    const ctx = makeCtx('Bearer dev-bypass-token')
    await authMiddleware(ctx, next)
    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
    process.env['NODE_ENV'] = 'test'
  })
})
