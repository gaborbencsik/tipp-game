# Security Audit Report - VB Tippjáték

**Date:** 2026-04-30
**Scope:** Full application (backend, frontend, infrastructure)

---

## Executive Summary

The application demonstrates generally good security practices (Drizzle ORM preventing SQL injection, proper use of helmet, parameterized queries). However, several findings ranging from Critical to Low severity should be addressed before production deployment.

---

## CRITICAL FINDINGS

---

### [CRITICAL] Hardcoded Secrets in .env File

**Category:** CWE-798 (Use of Hard-coded Credentials)
**Location:** `.env` lines 8-9, 31
**Severity:** Critical

**Description:**
The `.env` file contains a real Football API key and a commented-out Supabase production database password with connection string. While `.env` is gitignored, if this file was ever committed or shared, these credentials are compromised.

**Exploit scenario:**
If this file was ever committed to git history, or if the machine is compromised, an attacker gains direct access to the production database and the Football API account.

**Fix:**
1. Immediately rotate the Football API key at api-sports.io
2. Immediately rotate the Supabase database password
3. Remove the commented-out production connection string from the `.env` file
4. Verify git history with `git log -p -- .env` to ensure these were never committed
5. Use a secrets manager (Render's environment variables UI, not files) for production credentials

---

### [CRITICAL] JWT Verification Missing Issuer and Audience Validation

**Category:** CWE-287 (Improper Authentication) / OWASP A07:2021
**Location:** `packages/backend/src/middleware/auth.middleware.ts:47`
**Severity:** Critical

**Description:**
The `jwt.verify()` call only validates the algorithm (`RS256`, `ES256`) but does not verify `iss` (issuer) or `aud` (audience) claims. A token from any Supabase project that uses the same JWKS endpoint structure could potentially be accepted. Additionally, the JWKS client is created fresh on every verification call, defeating the caching mechanism.

**Exploit scenario:**
An attacker with a valid JWT from a different Supabase project (same signing infrastructure) could craft a request with their token. Since issuer/audience are not checked, the token would be accepted, granting access to the application.

**Fix:**
```typescript
// Create JWKS client as singleton
let jwksClientInstance: jwksClient.JwksClient | null = null

function getJwksClient(): jwksClient.JwksClient {
  if (!jwksClientInstance) {
    const supabaseUrl = process.env['SUPABASE_URL']
    if (!supabaseUrl) throw new Error('SUPABASE_URL is not set')
    jwksClientInstance = jwksClient({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000,
    })
  }
  return jwksClientInstance
}

async function verifyToken(token: string): Promise<SupabaseUserClaims> {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw Object.assign(new Error('Missing or invalid kid'), { isAuthError: true })
  }
  const client = getJwksClient()
  const key = await client.getSigningKey(decoded.header.kid)
  const publicKey = key.getPublicKey()

  const supabaseUrl = process.env['SUPABASE_URL']!
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: `${supabaseUrl}/auth/v1`,
    audience: 'authenticated',
  }) as SupabaseUserClaims
}
```

---

## HIGH FINDINGS

---

### [HIGH] Dev Auth Bypass Token Accepted When NODE_ENV is Unset

**Category:** CWE-287 (Improper Authentication)
**Location:** `packages/backend/src/middleware/auth.middleware.ts:61`
**Severity:** High

**Description:**
The dev bypass is only blocked when `NODE_ENV === 'production'`. If the production deployment fails to set `NODE_ENV=production` (misconfiguration on Render), the hardcoded `dev-bypass-token` grants admin access to anyone.

**Exploit scenario:**
If Render's deployment ever fails to inject `NODE_ENV=production`, any unauthenticated user can send `Authorization: Bearer dev-bypass-token` and gain full admin access.

**Fix:**
```typescript
const DEV_BYPASS_ENABLED = process.env['DEV_AUTH_BYPASS'] === 'true' && process.env['NODE_ENV'] === 'development'

if (token === 'dev-bypass-token' && DEV_BYPASS_ENABLED) {
  ctx.state.user = DEV_BYPASS_USER
  await next()
  return
}
```

---

### [HIGH] Banned Users Can Still Access the Application

**Category:** CWE-285 (Improper Authorization)
**Location:** `packages/backend/src/middleware/auth.middleware.ts` (entire file)
**Severity:** High

**Description:**
The application has a ban mechanism (`bannedAt` field in the users table), but the auth middleware never checks if a user is banned. A banned user can continue to use the application with their existing valid JWT.

**Exploit scenario:**
An admin bans a malicious user. The user continues making predictions, joining groups, and using all features because their JWT remains valid and no middleware checks the ban status.

**Fix:**
```typescript
// In auth middleware, after setting ctx.state.user:
const dbUser = await db
  .select({ bannedAt: users.bannedAt })
  .from(users)
  .where(eq(users.supabaseId, claims.sub))
  .limit(1)

if (dbUser[0]?.bannedAt) {
  ctx.status = 403
  ctx.body = { error: 'Account suspended' }
  return
}
```

Note: This adds a DB query per request. Consider caching ban status with a short TTL (e.g., 60 seconds).

---

### [HIGH] SQL Injection via ILIKE Pattern in Waitlist Search

**Category:** CWE-89 (SQL Injection) / OWASP A03:2021
**Location:** `packages/backend/src/services/waitlist.service.ts:94`
**Severity:** High (but limited blast radius — admin-only endpoint)

**Description:**
The waitlist search uses `ilike(waitlistEntries.email, `%${filters.search}%`)` which directly interpolates user input into a LIKE pattern. While Drizzle ORM parameterizes the value, LIKE metacharacters (`%`, `_`) are not escaped, allowing pattern-based data extraction.

**Exploit scenario:**
An admin user can use LIKE wildcards to probe for email patterns. Searching `_a%@gmail.com` reveals all gmail addresses with 'a' as second character.

**Fix:**
```typescript
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, '\\$&')
}

if (filters?.search) {
  conditions.push(ilike(waitlistEntries.email, `%${escapeLikePattern(filters.search)}%`))
}
```

---

### [HIGH] Role Determination Based Solely on Email Without DB Check

**Category:** CWE-269 (Improper Privilege Management)
**Location:** `packages/backend/src/middleware/auth.middleware.ts:12-14`, `packages/backend/src/services/user.service.ts:24,31,47`
**Severity:** High

**Description:**
Admin role is determined by `ADMIN_EMAILS` env var and written to the database on every `upsertUser` call. This means:
1. The `updateUserRole` admin action is immediately overwritten on the user's next request
2. If `ADMIN_EMAILS` is accidentally cleared, all admins lose access instantly
3. There's no concept of DB-authoritative role

**Exploit scenario:**
Admin uses `updateUserRole` to grant another user admin. On the next request, `upsertUser` overwrites the role back to 'user' because that email isn't in ADMIN_EMAILS.

**Fix:**
```typescript
// Only set role on first user creation, not on every upsert
.onConflictDoUpdate({
  target: users.supabaseId,
  set: {
    email: user.email,
    avatarUrl: user.avatarUrl,
    // Do NOT overwrite role on update
    updatedAt: new Date(),
  },
})
```

Use `ADMIN_EMAILS` only for initial user creation (seeding the first admin).

---

## MEDIUM FINDINGS

---

### [MEDIUM] Rate Limiter is In-Memory and Not Shared Across Instances

**Category:** CWE-770 (Allocation of Resources Without Limits)
**Location:** `packages/backend/src/middleware/rateLimit.middleware.ts`
**Severity:** Medium

**Description:**
The rate limiter uses an in-memory `Map<string, number[]>()`. Issues:
1. Multiple instances have separate state — rate limits are ineffective with horizontal scaling
2. The map is never pruned — old entries accumulate indefinitely (memory leak)

**Fix:**
```typescript
// Add cleanup of old entries
setInterval(() => {
  const now = Date.now()
  for (const [ip, timestamps] of hits) {
    const filtered = timestamps.filter(t => t > now - windowMs)
    if (filtered.length === 0) hits.delete(ip)
    else hits.set(ip, filtered)
  }
}, windowMs)
```

For multi-instance: consider Redis-based rate limiting (`rate-limiter-flexible`).

---

### [MEDIUM] Missing Rate Limiting on Sensitive Endpoints

**Category:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
**Location:** `packages/backend/src/routes/auth.routes.ts`, `packages/backend/src/routes/admin.routes.ts`
**Severity:** Medium

**Description:**
Rate limiting is only applied to `/api/waitlist` and `/api/groups/join`. Missing from:
- `POST /api/auth/me` — token probing
- `POST /api/predictions` — no submission limit
- `POST /api/admin/sync/run` — triggers expensive external API calls
- All admin endpoints

**Fix:**
```typescript
const authRateLimit = createRateLimit({ windowMs: 60_000, max: 30 })
router.post('/api/auth/me', authRateLimit, authMiddleware, ...)

const syncRateLimit = createRateLimit({ windowMs: 60_000, max: 3 })
syncRouter.post('/run', syncRateLimit, async (ctx) => { ... })
```

---

### [MEDIUM] Invite Code Uses Math.random()

**Category:** CWE-330 (Use of Insufficiently Random Values)
**Location:** `packages/backend/src/services/groups.service.ts:21-27`
**Severity:** Medium

**Description:**
Invite codes use `Math.random()` which is not cryptographically secure. While the keyspace (32^8 ≈ 1.1 trillion) is large, weak RNG is a concern.

**Fix:**
```typescript
import crypto from 'crypto'

function generateInviteCode(): string {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH)
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARS[bytes[i]! % INVITE_CODE_CHARS.length]
  }
  return code
}
```

---

### [MEDIUM] No Input Length Validation on displayName

**Category:** CWE-20 (Improper Input Validation)
**Location:** `packages/backend/src/routes/auth.routes.ts:17`
**Severity:** Medium

**Description:**
`PUT /api/users/me` validates `displayName` is non-empty but not max length. DB column is `varchar(30)` so it rejects with a 500 error instead of a clean 400.

**Fix:**
```typescript
if (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.trim().length > 30) {
  ctx.status = 400
  ctx.body = { error: 'displayName must be between 1 and 30 characters' }
  return
}
```

---

### [MEDIUM] CORS Configuration Not Validated at Startup

**Category:** CWE-346 (Origin Validation Error)
**Location:** `packages/backend/src/app.ts:18-29`
**Severity:** Medium

**Description:**
CORS origins from `CORS_ORIGIN` env var are not validated as proper URLs. A misconfiguration could inadvertently allow unwanted origins.

**Fix:**
```typescript
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(origin => {
    try {
      new URL(origin)
      return true
    } catch {
      console.warn(`[CORS] Invalid origin ignored: ${origin}`)
      return false
    }
  })

if (allowedOrigins.length === 0) {
  throw new Error('No valid CORS origins configured')
}
```

---

## LOW FINDINGS

---

### [LOW] Docker Containers Run as Root

**Category:** CWE-250 (Execution with Unnecessary Privileges)
**Location:** `packages/backend/Dockerfile.prod`, `packages/backend/Dockerfile.dev`, `packages/frontend/Dockerfile.dev`
**Severity:** Low

**Fix:**
```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
```

---

### [LOW] JWKS Client Created Per Request

**Category:** CWE-400 (Uncontrolled Resource Consumption)
**Location:** `packages/backend/src/middleware/auth.middleware.ts:36`
**Severity:** Low (performance issue, potential DoS surface)

**Description:**
Every authenticated request creates a new JWKS client and fetches from Supabase's JWKS endpoint. Cache is useless because client is discarded immediately.

**Fix:** See Critical finding #2 (singleton pattern).

---

### [LOW] Missing JWT clockTolerance

**Category:** CWE-613 (Insufficient Session Expiration)
**Location:** `packages/backend/src/middleware/auth.middleware.ts:47`
**Severity:** Low

**Fix:**
```typescript
jwt.verify(token, publicKey, {
  algorithms: ['RS256'],
  clockTolerance: 30,
  issuer: `${supabaseUrl}/auth/v1`,
  audience: 'authenticated',
})
```

---

### [LOW] No Startup Warning for Missing ADMIN_EMAILS

**Category:** CWE-269 (Improper Privilege Management)
**Location:** `packages/backend/src/middleware/auth.middleware.ts:12-14`
**Severity:** Low

**Fix:**
```typescript
const adminEmails = (process.env['ADMIN_EMAILS'] ?? '').split(',').filter(Boolean)
if (adminEmails.length === 0) {
  console.warn('[SECURITY] No ADMIN_EMAILS configured - admin features will be inaccessible')
}
```

---

## POSITIVE OBSERVATIONS

| Area | Status |
|------|--------|
| SQL Injection | Safe — Drizzle ORM parameterizes all queries |
| XSS | Safe — No `v-html` or `innerHTML` usage |
| Security Headers | `koa-helmet` applied globally |
| CORS | Allowlist-based (not wildcard) |
| Authorization | Group operations properly check membership |
| Audit Logging | Critical admin ops are logged |
| Dependencies | Recent versions, no known critical CVEs |

---

## PRIORITY ACTION ITEMS

| # | Finding | Effort | Severity |
|---|---------|--------|----------|
| 1 | Rotate exposed API key & DB password | 15 min | Critical |
| 2 | Add issuer/audience to JWT verification + singleton JWKS | 30 min | Critical |
| 3 | Strengthen dev bypass guard | 10 min | High |
| 4 | Add banned user check to auth flow | 30 min | High |
| 5 | Fix role overwrite in upsertUser | 20 min | High |
| 6 | Escape LIKE pattern in waitlist search | 5 min | High |
| 7 | Add rate limiting to sync/admin endpoints | 15 min | Medium |
| 8 | Use crypto.randomBytes for invite codes | 5 min | Medium |
| 9 | Add input length validation | 10 min | Medium |
| 10 | Add non-root user to Dockerfiles | 5 min | Low |
