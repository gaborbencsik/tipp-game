import crypto from 'node:crypto'
import type { Context, Next } from 'koa'

export async function serviceTokenMiddleware(ctx: Context, next: Next): Promise<void> {
  const expected = process.env['SYNC_SERVICE_TOKEN']
  if (!expected) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const header = (ctx.headers['authorization'] as string) ?? ''
  if (!header.startsWith('Bearer ')) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const token = header.slice(7)
  if (token.length !== expected.length) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected),
  )

  if (!isValid) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  await next()
}
