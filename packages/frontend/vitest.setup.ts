import { config } from '@vue/test-utils'
import { buildTestI18n } from './src/test-utils/i18n'

const i18n = buildTestI18n()
config.global.plugins.push(i18n)
