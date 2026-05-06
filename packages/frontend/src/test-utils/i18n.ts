import { createI18n } from 'vue-i18n'
import hu from '../locales/hu.json'

export function buildTestI18n() {
  return createI18n({
    legacy: false,
    locale: 'hu',
    messages: { hu },
  })
}
