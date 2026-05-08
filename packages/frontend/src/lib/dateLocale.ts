import { i18n } from '../i18n/index.js'

const LOCALE_MAP: Record<string, string> = {
  hu: 'hu-HU',
  en: 'en-GB',
}

export function getDateLocale(): string {
  const locale = (i18n.global.locale as unknown as { value: string }).value
  return LOCALE_MAP[locale] ?? 'hu-HU'
}
