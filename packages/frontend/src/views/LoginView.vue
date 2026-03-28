<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">VB Tippjáték</h1>
      <p class="text-gray-500 mb-8">Jelentkezz be a folytatáshoz</p>
      <button
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        @click="handleLogin"
      >
        Bejelentkezés
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '../stores/auth.store.js'

const authStore = useAuthStore()

async function handleLogin(): Promise<void> {
  await authStore.login()
}
</script>
