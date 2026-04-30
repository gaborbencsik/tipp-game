export interface DonationAmount {
  readonly label: string
  readonly amount: string
  readonly url: string
}

export interface UseDonationConfigReturn {
  readonly amounts: readonly DonationAmount[]
  readonly openAmountUrl: string | undefined
  readonly isConfigured: boolean
}

const PRESET_AMOUNTS: readonly { label: string; amount: number }[] = [
  { label: 'Egy sör 🍺 — 1000 Ft', amount: 1000 },
  { label: 'Egy kör 🍻 — 2000 Ft', amount: 2000 },
  { label: 'VIP páholy 🏟️ — 4000 Ft', amount: 4000 },
]

function buildUrl(template: string, amount: number): string {
  const minorUnits = (amount * 100).toString()
  return template
    .replace('{amount}', minorUnits)
    .replace('{currency}', 'HUF')
    .replace('{note}', encodeURIComponent('VB Tippjáték támogatás'))
}

export function useDonationConfig(): UseDonationConfigReturn {
  const urlTemplate = (import.meta.env.VITE_DONATION_URL as string | undefined) || undefined
  const isConfigured = urlTemplate !== undefined

  const amounts: readonly DonationAmount[] = urlTemplate
    ? PRESET_AMOUNTS.map(({ label, amount }) => ({
        label,
        amount: amount.toString(),
        url: buildUrl(urlTemplate, amount),
      }))
    : []

  const openAmountUrl = urlTemplate
    ?.replace('&amount={amount}', '')
    .replace('{currency}', 'HUF')
    .replace('{note}', encodeURIComponent('VB Tippjáték támogatás'))

  return { amounts, openAmountUrl, isConfigured }
}
