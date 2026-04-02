import type { Context, Next } from 'koa'

export async function adminMiddleware(ctx: Context, next: Next): Promise<void> {
  if (ctx.state.user?.role !== 'admin') {
    ctx.status = 403
    ctx.body = { error: 'Forbidden' }
    return
  }
  await next()
}
