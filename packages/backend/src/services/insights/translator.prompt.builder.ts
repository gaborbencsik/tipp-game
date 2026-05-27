export interface TranslatorPromptInput {
  readonly title: string
  readonly body: string
}

export function buildTranslatorPrompt(input: TranslatorPromptInput): string {
  const payload = JSON.stringify({ title: input.title, body: input.body })
  return `Translate the following football insight from English to natural, journalistic Hungarian. Keep numbers and team names verbatim. Do not add or remove information.

Style: natural, journalistic Hungarian — not a literal word-by-word translation. Sport jargon is welcome ("együttes", "találkozó", "góltermés", "veretlenségi sorozat"). Tone is neutral and factual.

Length limits (must respect):
- titleHu: max 100 characters
- bodyHu: max 500 characters

INPUT (English):
${payload}

OUTPUT JSON ONLY, no markdown, no commentary. Schema:
{ "titleHu": "string (max 100 chars)", "bodyHu": "string (max 500 chars)" }`
}
