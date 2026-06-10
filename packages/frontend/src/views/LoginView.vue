<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="fixed top-4 right-4">
      <LocaleToggle />
    </div>
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('login.title') }}</h1>
        <p class="text-gray-500">{{ mode === 'login' ? $t('login.subtitleLogin') : $t('login.subtitleRegister') }}</p>
      </div>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div v-if="mode === 'register'">
          <input
            v-model="displayName"
            type="text"
            :placeholder="$t('login.displayNamePlaceholder')"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            v-model="email"
            type="email"
            :placeholder="$t('login.emailPlaceholder')"
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <input
            v-model="password"
            type="password"
            :placeholder="$t('login.passwordPlaceholder')"
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
          {{ isLoading ? $t('login.submitting') : mode === 'login' ? $t('login.submitLogin') : $t('login.submitRegister') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-gray-500">
        <span v-if="mode === 'login'">
          {{ $t('login.noAccount') }}
          <a href="#" class="text-blue-600 hover:underline" @click.prevent="mode = 'register'">{{ $t('login.register') }}</a>
        </span>
        <span v-else>
          {{ $t('login.hasAccount') }}
          <a href="#" class="text-blue-600 hover:underline" @click.prevent="mode = 'login'">{{ $t('login.signIn') }}</a>
        </span>
      </p>

      <p v-if="mode === 'login'" class="mt-3 text-center text-xs text-gray-400">
        <span class="font-medium">{{ $t('login.forgotPassword.label') }}</span>
        {{ ' ' }}{{ $t('login.forgotPassword.hint') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.store.js'
import { extractInviteCodeFromRedirect } from '../lib/inviteRedirect.js'
import LocaleToggle from '../components/LocaleToggle.vue'

const { t } = useI18n()
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
    const inviteCode = extractInviteCodeFromRedirect(route.query.redirect)
    if (inviteCode) {
      authStore.savePendingInviteCode(inviteCode)
    }
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
    const message = err instanceof Error ? err.message : t('common.unknownError')
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
