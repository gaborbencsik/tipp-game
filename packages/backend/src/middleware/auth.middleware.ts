import type { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
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

function makeJwksClient(): jwksClient.JwksClient {
  const supabaseUrl = process.env['SUPABASE_URL']
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not set')
  return jwksClient({
    jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 600000, // 10 min
  })
}

async function getSigningKey(kid: string): Promise<string> {
  const client = makeJwksClient()
  const key = await client.getSigningKey(kid)
  return key.getPublicKey()
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

  try {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      ctx.status = 401
      ctx.body = { error: 'Unauthorized' }
      return
    }

    const publicKey = await getSigningKey(decoded.header.kid)
    const claims = jwt.verify(token, publicKey, { algorithms: ['RS256', 'ES256'] }) as SupabaseUserClaims

    ctx.state.user = {
      supabaseId: claims.sub,
      email: claims.email,
      displayName: claims.user_metadata?.full_name ?? claims.email.split('@')[0],
      avatarUrl: claims.user_metadata?.avatar_url ?? null,
    }
    await next()
  } catch (err) {
    console.error('[authMiddleware] JWT verification failed:', err instanceof Error ? err.message : err)
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
  }
}
