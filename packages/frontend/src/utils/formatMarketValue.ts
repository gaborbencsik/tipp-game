const MILLION = 1_000_000
const BILLION = 1_000_000_000

function formatBillions(eur: number, locale: 'hu' | 'en'): string {
  const value = eur / BILLION
  const rounded = Math.round(value * 10) / 10
  const decimalSep = locale === 'hu' ? ',' : '.'
  const text = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(1).replace('.', decimalSep)
  return locale === 'hu' ? `${text} mrd €` : `€${text}B`
}

function formatMillions(eur: number, locale: 'hu' | 'en'): string {
  const rounded = Math.round(eur / MILLION)
  return locale === 'hu' ? `${rounded} M €` : `€${rounded}M`
}

export function formatMarketValueEur(eur: number, locale: 'hu' | 'en'): string {
  if (eur === 0) return locale === 'hu' ? '0 €' : '€0'
  if (eur < MILLION) return locale === 'hu' ? '<1 M €' : '<€1M'
  if (eur < BILLION) return formatMillions(eur, locale)
  return formatBillions(eur, locale)
}
