import { describe, it, expect, beforeEach } from 'vitest'
import { buildFlagCss } from './flags-css.js'

describe('buildFlagCss', () => {
  beforeEach(() => {
    /* no-op */
  })

  it('emits one rule per code', () => {
    const css = buildFlagCss({ mx: '/assets/mx.svg', za: '/assets/za.svg' })
    expect(css).toContain('.fi-mx{')
    expect(css).toContain('.fi-za{')
  })

  it('quotes url() so single-quoted SVG data URLs do not break the parser', () => {
    const dataUrl = `data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg'%3e%3c/svg%3e`
    const css = buildFlagCss({ za: dataUrl })
    // url() value MUST be wrapped in double quotes so the embedded
    // single quotes inside the SVG data URL are parsed as the URL body,
    // not as the url() string-quote.
    expect(css).toContain(`url("${dataUrl}")`)
    expect(css).not.toContain(`url(${dataUrl})`)
  })

  it('keeps hashed asset URLs intact', () => {
    const css = buildFlagCss({ mx: '/assets/mx-Cc8Ccfe8.svg' })
    expect(css).toContain('.fi-mx{background-image:url("/assets/mx-Cc8Ccfe8.svg")}')
  })

  it('handles compound codes like gb-eng', () => {
    const css = buildFlagCss({ 'gb-eng': '/assets/gb-eng.svg' })
    expect(css).toContain('.fi-gb-eng{')
  })
})
