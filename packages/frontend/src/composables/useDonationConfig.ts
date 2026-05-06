import { useI18n } from 'vue-i18n'

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

const PRESET_AMOUNTS: readonly { key: string; amount: number }[] = [
  { key: 'donation.tier1', amount: 1000 },
  { key: 'donation.tier2', amount: 2000 },
  { key: 'donation.tier3', amount: 4000 },
]

function buildUrl(template: string, amount: number, note: string): string {
  const minorUnits = (amount * 100).toString()
  return template
    .replace('{amount}', minorUnits)
    .replace('{currency}', 'HUF')
    .replace('{note}', encodeURIComponent(note))
}

export function useDonationConfig(): UseDonationConfigReturn {
  const { t } = useI18n()
  const urlTemplate = (import.meta.env.VITE_DONATION_URL as string | undefined) || undefined
  const isConfigured = urlTemplate !== undefined
  const note = t('donation.noteParam')

  const amounts: readonly DonationAmount[] = urlTemplate
    ? PRESET_AMOUNTS.map(({ key, amount }) => ({
        label: t(key),
        amount: amount.toString(),
        url: buildUrl(urlTemplate, amount, note),
      }))
    : []

  const openAmountUrl = urlTemplate
    ?.replace('&amount={amount}', '')
    .replace('{currency}', 'HUF')
    .replace('{note}', encodeURIComponent(note))

  return { amounts, openAmountUrl, isConfigured }
}
