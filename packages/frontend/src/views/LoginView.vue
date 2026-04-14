<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">VB Tippjáték</h1>
        <p class="text-gray-500">{{ mode === 'login' ? 'Jelentkezz be a folytatáshoz' : 'Hozz létre fiókot' }}</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="mode === 'register'">
          <input
            v-model="displayName"
            type="text"
            placeholder="Megjelenítendő név"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            v-model="email"
            type="email"
            placeholder="Email cím"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            v-model="password"
            type="password"
            placeholder="Jelszó"
            required
            minlength="8"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <p v-if="infoMessage" class="text-blue-600 text-sm">{{ infoMessage }}</p>
        <p v-if="errorMessage" class="text-red-600 text-sm">{{ errorMessage }}</p>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {{ isLoading ? 'Folyamatban...' : mode === 'login' ? 'Bejelentkezés' : 'Regisztráció' }}
        </button>
      </form>

      <div class="my-4 flex items-center gap-3">
        <hr class="flex-1 border-gray-300" />
        <span class="text-sm text-gray-400">vagy</span>
        <hr class="flex-1 border-gray-300" />
      </div>

      <button
        disabled
        class="w-full px-6 py-3 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed"
      >
        Bejelentkezés Google-lel
      </button>

      <p class="mt-6 text-center text-sm text-gray-500">
        <span v-if="mode === 'login'">
          Nincs fiókod?
          <a href="#" class="text-blue-600 hover:underline" @click.prevent="mode = 'register'">Regisztrálj</a>
        </span>
        <span v-else>
          Már van fiókod?
          <a href="#" class="text-blue-600 hover:underline" @click.prevent="mode = 'login'">Belépés</a>
        </span>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.store.js'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const displayName = ref('')
const errorMessage = ref('')
const infoMessage = ref('')
const isLoading = ref(false)

async function handleSubmit(): Promise<void> {
  errorMessage.value = ''
  infoMessage.value = ''
  isLoading.value = true
  try {
    if (mode.value === 'login') {
      await authStore.loginWithEmail(email.value, password.value)
    } else {
      await authStore.registerWithEmail(email.value, password.value, displayName.value)
    }
    const redirect = route.query.redirect
    if (typeof redirect === 'string' && redirect.startsWith('/')) {
      await router.push(redirect)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ismeretlen hiba'
    if (message.includes('Erősítsd meg')) {
      infoMessage.value = message
      mode.value = 'login'
    } else {
      errorMessage.value = message
    }
  } finally {
    isLoading.value = false
  }
}

</script>
