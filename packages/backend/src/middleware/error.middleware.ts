import type { Context, Next } from 'koa'

interface AppError extends Error {
  status?: number
  expose?: boolean
}

export async function errorMiddleware(ctx: Context, next: Next): Promise<void> {
  try {
    await next()
  } catch (err: unknown) {
    const error = err as AppError

    const status = error.status ?? 500
    const message =
      status < 500 || error.expose
        ? error.message
        : 'Internal Server Error'

    ctx.status = status
    ctx.body = { error: message }

    if (status >= 500) {
      ctx.app.emit('error', err, ctx)
    }
  }
}
