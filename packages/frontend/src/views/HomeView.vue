<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold text-gray-900">{{ $t('home.title') }}</h1>
      </div>
      <p class="text-gray-600">{{ $t('home.welcome', { name: authStore.user?.displayName }) }}</p>
      <div class="mt-6">
        <router-link
          to="/app/matches"
          class="inline-block px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {{ $t('home.matchesBtn') }}
        </router-link>
        <router-link
          v-if="isAdmin"
          to="/admin/teams"
          class="inline-block ml-2 px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
        >
          {{ $t('home.adminTeamsBtn') }}
        </router-link>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth.store.js'
import AppLayout from '../components/AppLayout.vue'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.user?.role === 'admin')
</script>
