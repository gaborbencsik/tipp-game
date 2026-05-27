import { describe, it, expect } from 'vitest'
import { buildTranslatorPrompt } from '../src/services/insights/translator.prompt.builder.js'

describe('translator.prompt.builder', () => {
  it('contains the title and body to translate as JSON input', () => {
    const prompt = buildTranslatorPrompt({
      title: 'Germany defensive solidity is unmatched',
      body: 'Germany conceded only 0.73 goals per match across 30 fixtures, the lowest in the field.',
    })
    expect(prompt).toContain('Germany defensive solidity is unmatched')
    expect(prompt).toContain('0.73')
  })

  it('demands JSON output with titleHu and bodyHu keys', () => {
    const prompt = buildTranslatorPrompt({ title: 'X', body: 'Y' })
    expect(prompt).toMatch(/JSON ONLY/)
    expect(prompt).toMatch(/titleHu/)
    expect(prompt).toMatch(/bodyHu/)
  })

  it('instructs natural journalistic Hungarian (not literal)', () => {
    const prompt = buildTranslatorPrompt({ title: 'X', body: 'Y' })
    expect(prompt).toMatch(/journalistic Hungarian/i)
    expect(prompt).toMatch(/not.*literal|natural/i)
  })

  it('forbids adding or removing information', () => {
    const prompt = buildTranslatorPrompt({ title: 'X', body: 'Y' })
    expect(prompt).toMatch(/Do not add or remove information/i)
  })

  it('preserves numbers and team names verbatim', () => {
    const prompt = buildTranslatorPrompt({ title: 'X', body: 'Y' })
    expect(prompt).toMatch(/Keep numbers and team names/i)
  })

  it('declares Hungarian char limits matching DB constraints', () => {
    const prompt = buildTranslatorPrompt({ title: 'X', body: 'Y' })
    expect(prompt).toMatch(/title.*100/i)
    expect(prompt).toMatch(/body.*500/i)
  })
})
