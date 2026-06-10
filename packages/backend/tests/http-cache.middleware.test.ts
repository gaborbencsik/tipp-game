import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context, Next } from 'koa'
import { withHttpCache } from '../src/middleware/http-cache.middleware.js'

interface MockContext {
  method: string
  status: number
  body: unknown
  request: { headers: Record<string, string | undefined> }
  headers: Record<string, string>
  set: (key: string, value: string) => void
}

function makeCtx(opts: {
  method?: string
  ifNoneMatch?: string
  setBody?: unknown
} = {}): MockContext {
  const headers: Record<string, string> = {}
  return {
    method: opts.method ?? 'GET',
    status: 200,
    body: opts.setBody,
    request: { headers: { 'if-none-match': opts.ifNoneMatch } },
    headers,
    set(key: string, value: string): void {
      headers[key.toLowerCase()] = value
    },
  }
}

function makeNext(setBody: unknown, status = 200): Next {
  return vi.fn(async () => {
    // simulate route handler that already ran by stage; the middleware sets body BEFORE next.
    // For this test we run next() second-to-last and have it mutate the ctx via closure.
    // Actually the middleware runs next() first then inspects ctx.body, so we use a closure-bound ctx.
    return undefined
  })
}

/**
 * Helper that wires a "route handler as next()" — the next() call in our middleware
 * should set ctx.body and ctx.status before returning.
 */
function makeNextThatSets(ctx: MockContext, body: unknown, status = 200): Next {
  return vi.fn(async () => {
    ctx.status = status
    ctx.body = body
  })
}

describe('withHttpCache middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ETag generation', () => {
    it('produces stable ETag for identical body', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const body = { foo: 'bar', list: [1, 2, 3] }

      const ctx1 = makeCtx()
      await middleware(ctx1 as unknown as Context, makeNextThatSets(ctx1, body))
      const etag1 = ctx1.headers['etag']

      const ctx2 = makeCtx()
      await middleware(ctx2 as unknown as Context, makeNextThatSets(ctx2, body))
      const etag2 = ctx2.headers['etag']

      expect(etag1).toBeDefined()
      expect(etag1).toBe(etag2)
    })

    it('produces different ETags for different bodies', async () => {
      const middleware = withHttpCache({ maxAge: 300 })

      const ctx1 = makeCtx()
      await middleware(ctx1 as unknown as Context, makeNextThatSets(ctx1, { a: 1 }))
      const ctx2 = makeCtx()
      await middleware(ctx2 as unknown as Context, makeNextThatSets(ctx2, { a: 2 }))

      expect(ctx1.headers['etag']).not.toBe(ctx2.headers['etag'])
    })

    it('uses W/ weak ETag prefix', async () => {
      const middleware = withHttpCache({ maxAge: 60 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { x: 'y' }))
      expect(ctx.headers['etag']).toMatch(/^W\/"[a-f0-9]+"$/)
    })
  })

  describe('Cache-Control header', () => {
    it('sets Cache-Control with private scope by default', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { ok: true }))
      expect(ctx.headers['cache-control']).toContain('private')
      expect(ctx.headers['cache-control']).toContain('max-age=300')
    })

    it('sets public scope when requested', async () => {
      const middleware = withHttpCache({ maxAge: 600, scope: 'public' })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { ok: true }))
      expect(ctx.headers['cache-control']).toContain('public')
      expect(ctx.headers['cache-control']).not.toContain('private')
    })

    it('includes stale-while-revalidate when swr provided', async () => {
      const middleware = withHttpCache({ maxAge: 300, swr: 600 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { ok: true }))
      expect(ctx.headers['cache-control']).toContain('stale-while-revalidate=600')
    })

    it('omits stale-while-revalidate when not provided', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { ok: true }))
      expect(ctx.headers['cache-control']).not.toContain('stale-while-revalidate')
    })
  })

  describe('If-None-Match → 304', () => {
    it('returns 304 with null body when If-None-Match matches', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const body = { same: 'data' }

      // First call to determine the ETag
      const probe = makeCtx()
      await middleware(probe as unknown as Context, makeNextThatSets(probe, body))
      const etag = probe.headers['etag']!

      // Second call with If-None-Match
      const ctx = makeCtx({ ifNoneMatch: etag })
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, body))

      expect(ctx.status).toBe(304)
      expect(ctx.body).toBeNull()
      expect(ctx.headers['etag']).toBe(etag)
      expect(ctx.headers['cache-control']).toContain('max-age=300')
    })

    it('returns 200 with body when If-None-Match does not match', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx({ ifNoneMatch: 'W/"deadbeef0000aaaa"' })
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { fresh: true }))

      expect(ctx.status).toBe(200)
      expect(ctx.body).toEqual({ fresh: true })
    })
  })

  describe('no-op cases', () => {
    it('does not set headers on non-GET request', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx({ method: 'POST' })
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { x: 1 }))
      expect(ctx.headers['etag']).toBeUndefined()
      expect(ctx.headers['cache-control']).toBeUndefined()
    })

    it('does process HEAD requests', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx({ method: 'HEAD' })
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { x: 1 }))
      expect(ctx.headers['etag']).toBeDefined()
    })

    it('does not set headers when status is not 200', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, { error: 'x' }, 500))
      expect(ctx.headers['etag']).toBeUndefined()
      expect(ctx.headers['cache-control']).toBeUndefined()
    })

    it('does not set headers when body is null', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, null))
      expect(ctx.headers['etag']).toBeUndefined()
    })

    it('does not set headers when body is undefined', async () => {
      const middleware = withHttpCache({ maxAge: 300 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, undefined))
      expect(ctx.headers['etag']).toBeUndefined()
    })
  })

  describe('serialization', () => {
    it('handles string body', async () => {
      const middleware = withHttpCache({ maxAge: 60 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, 'plain text'))
      expect(ctx.headers['etag']).toBeDefined()
    })

    it('handles array body', async () => {
      const middleware = withHttpCache({ maxAge: 60 })
      const ctx = makeCtx()
      await middleware(ctx as unknown as Context, makeNextThatSets(ctx, [1, 2, 3]))
      expect(ctx.headers['etag']).toBeDefined()
    })
  })
})
