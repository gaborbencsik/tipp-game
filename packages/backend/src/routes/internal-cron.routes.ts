import Router from '@koa/router'
import { serviceTokenMiddleware } from '../middleware/service-token.middleware.js'
import { runMatchKickoffReminderJob } from '../jobs/match-kickoff-reminder.job.js'
import { runDailyMatchReviewJob } from '../jobs/daily-match-review.job.js'

const internalCronRouter = new Router({ prefix: '/api/internal/cron' })

internalCronRouter.use(serviceTokenMiddleware)

internalCronRouter.post('/match-kickoff-reminder', async (ctx) => {
  const result = await runMatchKickoffReminderJob()
  ctx.body = result
})

internalCronRouter.post('/daily-match-review', async (ctx) => {
  const result = await runDailyMatchReviewJob()
  ctx.body = result
})

export { internalCronRouter }
