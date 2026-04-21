import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockIsValidEmail, mockAddToWaitlist, mockRateLimit } = vi.hoisted(() => {
  const mockIsValidEmail = vi.fn()
  const mockAddToWaitlist = vi.fn()
  const mockRateLimit = vi.fn((_opts: unknown) => async (_ctx: unknown, next: () => Promise<void>) => next())
  return { mockIsValidEmail, mockAddToWaitlist, mockRateLimit }
})

vi.mock('../src/services/waitlist.service.js', () => ({
  isValidEmail: mockIsValidEmail,
  addToWaitlist: mockAddToWaitlist,
}))

vi.mock('../src/middleware/rateLimit.middleware.js', () => ({
  createRateLimit: mockRateLimit,
}))

import { waitlistRouter } from '../src/routes/waitlist.routes.js'

type Body = Record<string, unknown>

function makeCtx(body: Body): { ctx: Record<string, unknown>; next: () => Promise<void> } {
  const ctx: Record<string, unknown> = {
    ip: '1.2.3.4',
    request: { body },
    status: 200,
    body: undefined,
    method: 'POST',
    path: '/api/waitlist',
    url: '/api/waitlist',
    get: () => '',
    set: vi.fn(),
    accepts: () => 'json',
    is: () => null,
    state: {},
    query: {},
    params: {},
    headers: {},
    header: {},
    originalUrl: '/api/waitlist',
    host: 'localhost',
    hostname: 'localhost',
    protocol: 'http',
    href: 'http://localhost/api/waitlist',
    type: 'application/json',
    charset: 'utf-8',
    length: 0,
    fresh: false,
    stale: true,
    secure: false,
    ips: [],
    subdomains: [],
    app: { emit: vi.fn() },
    req: { headers: {} },
    res: { setHeader: vi.fn(), end: vi.fn(), getHeader: vi.fn() },
    response: { set: vi.fn(), status: 200, body: undefined },
    cookies: { get: vi.fn(), set: vi.fn() },
    throw: (s: number, msg: string) => {
      ctx.status = s
      ctx.body = { error: msg }
    },
  }
  return { ctx, next: vi.fn().mockResolvedValue(undefined) as unknown as () => Promise<void> }
}

async function dispatch(body: Body): Promise<{ status: number; body: unknown }> {
  const matched = waitlistRouter.match('/api/waitlist', 'POST')
  const layers = matched.pathAndMethod
  const ctx: Record<string, unknown> = {
    ip: '1.2.3.4',
    request: { body },
    status: 200,
    body: undefined,
    method: 'POST',
    path: '/api/waitlist',
    url: '/api/waitlist',
    _matchedRoute: '/api/waitlist',
    params: {},
    state: {},
    get: () => '',
    set: vi.fn(),
    app: { emit: vi.fn() },
  }

  for (const layer of layers) {
    await layer.stack[layer.stack.length - 1](ctx as never, async () => {})
  }

  return { status: ctx.status as number, body: ctx.body }
}

describe('POST /api/waitlist', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockIsValidEmail.mockReturnValue(true)
    mockAddToWaitlist.mockResolvedValue(undefined)
  })

  it('valid email → 201 + calls addToWaitlist', async () => {
    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { email: 'test@example.com', source: 'hero', _t: 5000 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(201)
    expect(ctx.body).toEqual({ message: 'Subscribed' })
    expect(mockAddToWaitlist).toHaveBeenCalledWith('test@example.com', 'hero')
  })

  it('honeypot filled → 201 but does NOT call addToWaitlist', async () => {
    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { email: 'bot@example.com', source: 'hero', website: 'http://spam.com', _t: 5000 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(201)
    expect(ctx.body).toEqual({ message: 'Subscribed' })
    expect(mockAddToWaitlist).not.toHaveBeenCalled()
  })

  it('timing < 3000ms → 201 but does NOT call addToWaitlist', async () => {
    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { email: 'fast@example.com', source: 'hero', _t: 1500 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(201)
    expect(ctx.body).toEqual({ message: 'Subscribed' })
    expect(mockAddToWaitlist).not.toHaveBeenCalled()
  })

  it('invalid email → 400', async () => {
    mockIsValidEmail.mockReturnValue(false)

    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { email: 'bad-email', source: 'hero', _t: 5000 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({ error: 'Invalid email address' })
    expect(mockAddToWaitlist).not.toHaveBeenCalled()
  })

  it('invalid source → 400', async () => {
    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { email: 'test@example.com', source: 'invalid', _t: 5000 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({ error: 'Invalid source' })
    expect(mockAddToWaitlist).not.toHaveBeenCalled()
  })

  it('missing email → 400', async () => {
    mockIsValidEmail.mockReturnValue(false)

    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { source: 'hero', _t: 5000 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(400)
    expect(ctx.body).toEqual({ error: 'Invalid email address' })
  })

  it('footer source → calls addToWaitlist with footer', async () => {
    const matched = waitlistRouter.match('/api/waitlist', 'POST')
    const handler = matched.pathAndMethod[matched.pathAndMethod.length - 1]
    const ctx: Record<string, unknown> = {
      ip: '1.2.3.4',
      request: { body: { email: 'user@example.com', source: 'footer', _t: 5000 } },
      status: 200,
      body: undefined,
    }

    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})

    expect(ctx.status).toBe(201)
    expect(mockAddToWaitlist).toHaveBeenCalledWith('user@example.com', 'footer')
  })
})
