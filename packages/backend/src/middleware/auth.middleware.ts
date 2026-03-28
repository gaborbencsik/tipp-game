import type { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
const { verify } = jwt
import type { SupabaseUserClaims, AuthenticatedUser } from '../types/index.js'

declare module 'koa' {
  interface DefaultState {
    user: AuthenticatedUser
  }
}

const DEV_BYPASS_USER: AuthenticatedUser = {
  supabaseId: '00000000-0000-0000-0000-000000000001',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
}

export async function authMiddleware(ctx: Context, next: Next): Promise<void> {
  const authHeader = ctx.headers['authorization']

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  const token = authHeader.slice(7)

  if (token === 'dev-bypass-token' && process.env['NODE_ENV'] !== 'production') {
    ctx.state.user = DEV_BYPASS_USER
    await next()
    return
  }

  const secret = process.env['SUPABASE_JWT_SECRET']
  if (!secret) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  try {
    const claims = verify(token, secret) as SupabaseUserClaims
    ctx.state.user = {
      supabaseId: claims.sub,
      email: claims.email,
      displayName: claims.user_metadata?.full_name ?? claims.email.split('@')[0],
      avatarUrl: claims.user_metadata?.avatar_url ?? null,
    }
    await next()
  } catch {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
  }
}
