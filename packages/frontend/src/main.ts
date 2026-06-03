import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router/index.js'
import { i18n } from './i18n/index.js'
import { useAuthStore } from './stores/auth.store.js'
import './lib/install-prompt.js'
import './style.css'

const bootstrap = async (): Promise<void> => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(i18n)

  const authStore = useAuthStore()
  await authStore.restoreSession()

  app.mount('#app')

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('SW registration failed', err)
    })
  }
}

bootstrap()
