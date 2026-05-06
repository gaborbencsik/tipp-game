import { createI18n } from 'vue-i18n'
import hu from '../locales/hu.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'hu',
  fallbackLocale: 'hu',
  messages: { hu },
})
