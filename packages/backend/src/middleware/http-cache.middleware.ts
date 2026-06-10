import type { Context, Next } from 'koa'
import { createHash } from 'node:crypto'

export interface HttpCacheOptions {
  readonly maxAge: number
  readonly swr?: number
  readonly scope?: 'private' | 'public'
}

const ETAG_HASH_LENGTH = 16

function buildCacheControl(options: HttpCacheOptions): string {
  const scope = options.scope ?? 'private'
  const parts: string[] = [scope, `max-age=${options.maxAge}`]
  if (options.swr !== undefined) {
    parts.push(`stale-while-revalidate=${options.swr}`)
  }
  return parts.join(', ')
}

function computeEtag(body: unknown): string {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body)
  const hash = createHash('sha256').update(serialized).digest('hex').slice(0, ETAG_HASH_LENGTH)
  return `W/"${hash}"`
}

export function withHttpCache(options: HttpCacheOptions): (ctx: Context, next: Next) => Promise<void> {
  const cacheControl = buildCacheControl(options)

  return async function httpCacheMiddleware(ctx: Context, next: Next): Promise<void> {
    await next()

    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') return
    if (ctx.status !== 200) return
    if (ctx.body === null || ctx.body === undefined) return

    const etag = computeEtag(ctx.body)
    ctx.set('Cache-Control', cacheControl)
    ctx.set('ETag', etag)

    if (ctx.request.headers['if-none-match'] === etag) {
      ctx.status = 304
      ctx.body = null
    }
  }
}
