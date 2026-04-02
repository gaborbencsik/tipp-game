<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold text-gray-900">VB Tippjáték – Főoldal</h1>
        <button
          class="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          @click="authStore.logout()"
        >
          Kijelentkezés
        </button>
      </div>
      <p class="text-gray-600">
        Üdvözlünk, <strong>{{ authStore.user?.displayName }}</strong>!
        Be vagy jelentkezve.
      </p>
      <div class="mt-6">
        <router-link
          to="/matches"
          class="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Meccsek
        </router-link>
        <router-link
          v-if="isAdmin"
          to="/admin/teams"
          class="inline-block ml-2 px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          Admin – Csapatok
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth.store.js'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
</script>
