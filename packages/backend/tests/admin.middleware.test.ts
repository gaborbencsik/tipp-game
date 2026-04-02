import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Context, Next } from 'koa'
import { adminMiddleware } from '../src/middleware/admin.middleware.js'

function makeCtx(role?: string): Context {
  return {
    state: role ? { user: { role } } : {},
    status: 200,
    body: undefined,
  } as unknown as Context
}

describe('adminMiddleware', () => {
  let next: Next

  beforeEach(() => {
    next = vi.fn().mockResolvedValue(undefined)
  })

  it('admin role → next() called', async () => {
    const ctx = makeCtx('admin')
    await adminMiddleware(ctx, next)
    expect(next).toHaveBeenCalledOnce()
    expect(ctx.status).toBe(200)
  })

  it('user role → 403', async () => {
    const ctx = makeCtx('user')
    await adminMiddleware(ctx, next)
    expect(ctx.status).toBe(403)
    expect(ctx.body).toEqual({ error: 'Forbidden' })
    expect(next).not.toHaveBeenCalled()
  })

  it('no user → 403', async () => {
    const ctx = makeCtx()
    await adminMiddleware(ctx, next)
    expect(ctx.status).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })
})
