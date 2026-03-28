import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router/index.js'
import { useAuthStore } from './stores/auth.store.js'
import './style.css'

const bootstrap = async (): Promise<void> => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  const authStore = useAuthStore()
  await authStore.restoreSession()

  app.mount('#app')
}

bootstrap()
