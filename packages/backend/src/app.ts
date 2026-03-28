import Koa from 'koa'
import cors from '@koa/cors'
import helmet from 'koa-helmet'
import compress from 'koa-compress'
import bodyParser from 'koa-bodyparser'
import { errorMiddleware } from './middleware/error.middleware.js'
import { healthRouter } from './routes/health.routes.js'

const app = new Koa()

app.use(errorMiddleware)
app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }))
app.use(compress())
app.use(bodyParser())

app.use(healthRouter.routes())
app.use(healthRouter.allowedMethods())

app.on('error', (err: Error, ctx: Koa.Context) => {
  console.error('Unhandled error:', err.message, ctx.url)
})

export { app }
