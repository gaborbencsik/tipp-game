import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context, Next } from 'koa'
import type { AuthenticatedUser } from '../src/types/index.js'

const { mockGetSigningKey, mockVerify, mockDecode } = vi.hoisted(() => ({
  mockGetSigningKey: vi.fn(),
  mockVerify: vi.fn(),
  mockDecode: vi.fn(),
}))

vi.mock('jwks-rsa', () => ({
  default: vi.fn(() => ({
    getSigningKey: mockGetSigningKey,
  })),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    decode: mockDecode,
    verify: mockVerify,
  },
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
    mockGetSigningKey.mockReset()
    mockVerify.mockReset()
    mockDecode.mockReset()
    ;(next as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    process.env['NODE_ENV'] = 'test'
    process.env['SUPABASE_URL'] = 'https://test.supabase.co'
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => 'mock-public-key' })
    mockDecode.mockReturnValue({ header: { kid: 'test-kid' }, payload: MOCK_CLAIMS })
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

  it('token without kid → 401', async () => {
    mockDecode.mockReturnValue({ header: {}, payload: MOCK_CLAIMS })
    const ctx = makeCtx('Bearer no-kid-token')
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
    mockDecode.mockReturnValue({ header: { kid: 'test-kid' }, payload: {} })
    mockVerify.mockImplementation(() => { throw new Error('invalid') })
    const ctx = makeCtx('Bearer dev-bypass-token')
    await authMiddleware(ctx, next)
    expect(ctx.status).toBe(401)
    expect(next).not.toHaveBeenCalled()
    process.env['NODE_ENV'] = 'test'
  })

  it('ES256 token → accepted, ctx.state.user filled', async () => {
    mockDecode.mockReturnValue({ header: { kid: 'es-kid', alg: 'ES256' }, payload: MOCK_CLAIMS })
    mockVerify.mockReturnValue(MOCK_CLAIMS)
    const ctx = makeCtx('Bearer es256-token')
    await authMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    const user = ctx.state['user'] as AuthenticatedUser
    expect(user.supabaseId).toBe('supabase-uuid-123')
    const verifyCall = mockVerify.mock.calls[0] as [string, string, { algorithms: string[] }]
    expect(verifyCall[2].algorithms).toContain('ES256')
  })
})
