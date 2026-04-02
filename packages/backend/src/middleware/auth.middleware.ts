import type { Context, Next } from 'koa'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import type { SupabaseUserClaims, AuthenticatedUser } from '../types/index.js'

declare module 'koa' {
  interface DefaultState {
    user: AuthenticatedUser
  }
}

function resolveRole(email: string): 'user' | 'admin' {
  const adminEmails = (process.env['ADMIN_EMAILS'] ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'user'
}

const DEV_BYPASS_USER: AuthenticatedUser = {
  supabaseId: '00000000-0000-0000-0000-000000000001',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
  role: resolveRole('dev@local'),
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

async function verifyToken(token: string): Promise<SupabaseUserClaims> {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw Object.assign(new Error('Missing or invalid kid'), { isAuthError: true })
  }
  const publicKey = await getSigningKey(decoded.header.kid)
  return jwt.verify(token, publicKey, { algorithms: ['RS256', 'ES256'] }) as SupabaseUserClaims
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

  let claims: SupabaseUserClaims
  try {
    claims = await verifyToken(token)
  } catch (err) {
    console.error('[authMiddleware] JWT verification failed:', err instanceof Error ? err.message : err)
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }

  ctx.state.user = {
    supabaseId: claims.sub,
    email: claims.email,
    displayName: claims.user_metadata?.full_name ?? claims.email.split('@')[0],
    avatarUrl: claims.user_metadata?.avatar_url ?? null,
    role: resolveRole(claims.email),
  }

  await next()
}
