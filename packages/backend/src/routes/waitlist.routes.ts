import Router from '@koa/router'
import { createRateLimit } from '../middleware/rateLimit.middleware.js'
import { isValidEmail, addToWaitlist } from '../services/waitlist.service.js'

const router = new Router()

const waitlistRateLimit = createRateLimit({ windowMs: 10 * 60 * 1000, max: 5 })

const VALID_SOURCES = ['hero', 'footer'] as const

const MIN_ELAPSED_MS = 3000

router.post('/api/waitlist', waitlistRateLimit, async (ctx) => {
  const body = ctx.request.body as Record<string, unknown>

  // Honeypot check — bots fill hidden fields, real users don't
  if (body.website) {
    ctx.status = 201
    ctx.body = { message: 'Subscribed' }
    return
  }

  // Timing check — bots submit instantly
  if (typeof body._t === 'number' && body._t < MIN_ELAPSED_MS) {
    ctx.status = 201
    ctx.body = { message: 'Subscribed' }
    return
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const source = body.source as string

  if (!email || !isValidEmail(email)) {
    ctx.status = 400
    ctx.body = { error: 'Invalid email address' }
    return
  }

  if (!VALID_SOURCES.includes(source as typeof VALID_SOURCES[number])) {
    ctx.status = 400
    ctx.body = { error: 'Invalid source' }
    return
  }

  await addToWaitlist(email, source as 'hero' | 'footer')

  ctx.status = 201
  ctx.body = { message: 'Subscribed' }
})

export { router as waitlistRouter }
