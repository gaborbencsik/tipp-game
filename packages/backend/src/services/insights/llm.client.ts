import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { getRateLimiter, LlmDailyLimitExceededError } from './rate-limiter.js'
import { recordUsage } from './usage.repository.js'

export type InsightType =
  | 'defense'
  | 'attack'
  | 'form'
  | 'set_pieces'
  | 'key_matchup'
  | 'fatigue'
  | 'historical'

const InsightSchema = z.object({
  type: z.enum(['defense', 'attack', 'form', 'set_pieces', 'key_matchup', 'fatigue', 'historical']),
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(400),
  dataPoints: z.record(z.string(), z.number()),
})

const ResponseSchema = z.object({
  insights: z.array(InsightSchema).min(1),
})

const TranslationSchema = z.object({
  titleHu: z.string().min(1).max(100),
  bodyHu: z.string().min(1).max(500),
})

export type LlmInsight = z.infer<typeof InsightSchema>
export type LlmTranslation = z.infer<typeof TranslationSchema>

export class LlmClientError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'LlmClientError'
  }
}

export interface LlmClient {
  generateInsights(input: { prompt: string; matchId: string | null }): Promise<readonly LlmInsight[]>
  translate(input: { prompt: string; matchId: string | null }): Promise<LlmTranslation>
}

interface LlmProviderImpl {
  call(prompt: string): Promise<{ text: string; inputTokens: number; outputTokens: number }>
}

function getProviderImpl(provider: string, model: string): LlmProviderImpl {
  if (provider === 'gemini') {
    const apiKey = process.env['GEMINI_API_KEY'] ?? ''
    if (!apiKey) throw new LlmClientError('GEMINI_API_KEY is not configured', 'NO_API_KEY')
    const client = new GoogleGenAI({ apiKey })
    return {
      async call(prompt: string) {
        const resp = await client.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        })
        const text = resp.text ?? ''
        const usage = resp.usageMetadata ?? {}
        return {
          text,
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
        }
      },
    }
  }
  throw new LlmClientError(`Unsupported LLM provider: ${provider}`, 'UNSUPPORTED_PROVIDER')
}

export function createLlmClient(): LlmClient {
  const provider = process.env['INSIGHT_LLM_PROVIDER'] ?? 'gemini'
  const model = process.env['INSIGHT_LLM_MODEL'] ?? 'gemini-flash-latest'
  const limiter = getRateLimiter()
  const impl = getProviderImpl(provider, model)

  async function callJson<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    matchId: string | null,
    providerLabel: string,
  ): Promise<T> {
    const startedAt = Date.now()
    let result: { text: string; inputTokens: number; outputTokens: number } | null = null
    try {
      result = await impl.call(prompt)
    } catch (err) {
      const code = err instanceof Error ? (err.name || 'API_ERROR') : 'API_ERROR'
      await recordUsage({
        provider: providerLabel, model, matchId,
        inputTokens: 0, outputTokens: 0,
        latencyMs: Date.now() - startedAt,
        success: false,
        errorCode: code.slice(0, 64),
      })
      throw new LlmClientError(err instanceof Error ? err.message : 'LLM call failed', 'API_ERROR')
    }
    const latencyMs = Date.now() - startedAt
    let parsed: unknown
    try {
      parsed = JSON.parse(stripJsonFence(result.text))
    } catch {
      await recordUsage({
        provider: providerLabel, model, matchId,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        latencyMs, success: false, errorCode: 'INVALID_JSON',
      })
      throw new LlmClientError('LLM returned invalid JSON', 'INVALID_JSON')
    }
    const validated = schema.safeParse(parsed)
    if (!validated.success) {
      await recordUsage({
        provider: providerLabel, model, matchId,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        latencyMs, success: false, errorCode: 'SCHEMA_INVALID',
      })
      throw new LlmClientError('LLM response failed schema validation', 'SCHEMA_INVALID')
    }
    await recordUsage({
      provider: providerLabel, model, matchId,
      inputTokens: result.inputTokens, outputTokens: result.outputTokens,
      latencyMs, success: true, errorCode: null,
    })
    return validated.data
  }

  return {
    async generateInsights({ prompt, matchId }) {
      const data = await limiter.run(() => callJson(prompt, ResponseSchema, matchId, provider))
      return data.insights
    },
    async translate({ prompt, matchId }) {
      return limiter.run(() => callJson(prompt, TranslationSchema, matchId, `${provider}-translate`))
    },
  }
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  return trimmed
}

export { LlmDailyLimitExceededError }
