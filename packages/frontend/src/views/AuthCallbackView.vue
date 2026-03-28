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
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    await authStore.handleSession(data.session)
  }
  await router.push('/')
})
</script>
