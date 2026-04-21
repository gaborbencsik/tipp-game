import Koa from 'koa'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import compress from 'koa-compress'
import bodyParser from 'koa-bodyparser'
import { errorMiddleware } from './middleware/error.middleware.js'
import { healthRouter } from './routes/health.routes.js'
import { authRouter } from './routes/auth.routes.js'
import { matchesRouter } from './routes/matches.routes.js'
import { predictionsRouter } from './routes/predictions.routes.js'
import { adminRouter } from './routes/admin.routes.js'
import { groupsRouter } from './routes/groups.routes.js'
import { leaderboardRouter } from './routes/leaderboard.routes.js'
import { waitlistRouter } from './routes/waitlist.routes.js'

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map(o => o.trim())

const app = new Koa()

app.use(errorMiddleware)
app.use(helmet())
app.use(cors({
  origin: (ctx) => {
    const requestOrigin = ctx.get('Origin')
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : ''
  },
}))
app.use(compress())
app.use(bodyParser())

app.use(healthRouter.routes())
app.use(healthRouter.allowedMethods())
app.use(authRouter.routes())
app.use(authRouter.allowedMethods())
app.use(matchesRouter.routes())
app.use(matchesRouter.allowedMethods())
app.use(predictionsRouter.routes())
app.use(predictionsRouter.allowedMethods())
app.use(adminRouter.routes())
app.use(adminRouter.allowedMethods())
app.use(groupsRouter.routes())
app.use(groupsRouter.allowedMethods())
app.use(leaderboardRouter.routes())
app.use(leaderboardRouter.allowedMethods())
app.use(waitlistRouter.routes())
app.use(waitlistRouter.allowedMethods())

app.on('error', (err: Error, ctx: Koa.Context) => {
  const entry: Record<string, unknown> = {
    level: 'error',
    message: err.message,
    url: ctx.url,
    method: ctx.method,
    stack: err.stack,
  }
  if ('cause' in err) entry['cause'] = String((err as Error & { cause: unknown }).cause)
  if ('code' in err) entry['pgCode'] = (err as Error & { code: unknown }).code
  console.error(JSON.stringify(entry))
})

export { app }
