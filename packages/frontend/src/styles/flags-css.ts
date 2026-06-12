/* CSS string builder for the tournament flag tree-shaker. Extracted from
 * `flags.ts` so it is unit-testable without the static SVG imports.
 *
 * The url() value MUST be wrapped in double quotes: Vite emits inline
 * `data:image/svg+xml,...` URLs that contain single quotes inside the
 * SVG (xmlns='http://www.w3.org/2000/svg', fill='#fff', ...). Without
 * quoting, the CSS parser treats those single quotes as a string-quote
 * inside `url(...)` and rejects the value, so the flag never paints.
 */
export function buildFlagCss(flags: Readonly<Record<string, string>>): string {
  return Object.entries(flags)
    .map(([code, url]) => `.fi-${code}{background-image:url("${url}")}`)
    .join('\n')
}
