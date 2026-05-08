import { createI18n } from 'vue-i18n'
import hu from '../locales/hu.json'
import en from '../locales/en.json'

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: localStorage.getItem('locale') ?? 'hu',
  fallbackLocale: 'hu',
  messages: { hu, en },
})
