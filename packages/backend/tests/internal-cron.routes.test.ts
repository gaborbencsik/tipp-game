import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunJob, mockRunDaily } = vi.hoisted(() => ({
  mockRunJob: vi.fn(),
  mockRunDaily: vi.fn(),
}))

vi.mock('../src/jobs/match-kickoff-reminder.job.js', () => ({
  runMatchKickoffReminderJob: mockRunJob,
}))

vi.mock('../src/jobs/daily-match-review.job.js', () => ({
  runDailyMatchReviewJob: mockRunDaily,
}))

vi.mock('../src/middleware/service-token.middleware.js', () => ({
  serviceTokenMiddleware: async (_ctx: unknown, next: () => Promise<void>) => next(),
}))

import { internalCronRouter } from '../src/routes/internal-cron.routes.js'

function getHandler(path: string, method: string): { stack: Array<(ctx: never, next: () => Promise<void>) => Promise<void>> } {
  const matched = internalCronRouter.match(path, method)
  const layers = matched.pathAndMethod
  return layers[layers.length - 1]
}

describe('POST /api/internal/cron/match-kickoff-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the job and returns its result', async () => {
    mockRunJob.mockResolvedValue({ matchesProcessed: 3, sent: 7, failed: 1, durationMs: 42 })
    const handler = getHandler('/api/internal/cron/match-kickoff-reminder', 'POST')
    const ctx: Record<string, unknown> = {}
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(mockRunJob).toHaveBeenCalledOnce()
    expect(ctx.body).toEqual({ matchesProcessed: 3, sent: 7, failed: 1, durationMs: 42 })
  })
})

describe('POST /api/internal/cron/daily-match-review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('runs the daily review job and returns its result', async () => {
    mockRunDaily.mockResolvedValue({
      date: '2026-06-11',
      firstMatchId: 'm1',
      targetCount: 5,
      sent: 5,
      failed: 0,
      durationMs: 100,
    })
    const handler = getHandler('/api/internal/cron/daily-match-review', 'POST')
    const ctx: Record<string, unknown> = {}
    await handler.stack[handler.stack.length - 1](ctx as never, async () => {})
    expect(mockRunDaily).toHaveBeenCalledOnce()
    expect(ctx.body).toMatchObject({ date: '2026-06-11', sent: 5 })
  })
})
