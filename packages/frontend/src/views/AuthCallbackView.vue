<template>
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-gray-500">Bejelentkezés folyamatban...</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../stores/auth.store.js'

const authStore = useAuthStore()
const router = useRouter()

onMounted(async () => {
  let unsubscribeFn: (() => void) | null = null

  const result = supabase.auth.onAuthStateChange(async (_event, session) => {
    unsubscribeFn?.()
    if (session) {
      await authStore.handleSession(session)
    }
    await router.push('/')
  })
  unsubscribeFn = () => result.data.subscription.unsubscribe()

  // fallback: ha már van session (pl. frissítéskor)
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    unsubscribeFn()
    await authStore.handleSession(data.session)
    await router.push('/')
  }
})
</script>
