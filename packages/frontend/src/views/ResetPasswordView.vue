<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="fixed top-4 right-4">
      <LocaleToggle />
    </div>
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ $t('resetPassword.title') }}</h1>
        <p class="text-gray-500">{{ $t('resetPassword.subtitle') }}</p>
      </div>

      <p
        v-if="!sessionReady && !sessionChecking"
        class="text-red-600 text-sm text-center mb-4"
        data-testid="link-expired"
      >
        {{ $t('resetPassword.errors.linkExpired') }}
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div>
          <label class="sr-only" for="reset-password-new">{{ $t('resetPassword.newPasswordLabel') }}</label>
          <input
            id="reset-password-new"
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="$t('resetPassword.newPasswordPlaceholder')"
            :disabled="!sessionReady || isLoading"
            required
            minlength="8"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>
        <div>
          <label class="sr-only" for="reset-password-confirm">{{ $t('resetPassword.confirmLabel') }}</label>
          <input
            id="reset-password-confirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            :placeholder="$t('resetPassword.confirmPlaceholder')"
            :disabled="!sessionReady || isLoading"
            required
            minlength="8"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        <p v-if="errorMessage" class="text-red-600 text-sm">{{ errorMessage }}</p>
        <p v-if="successMessage" class="text-green-600 text-sm">{{ successMessage }}</p>

        <button
          type="submit"
          :disabled="!sessionReady || isLoading"
          class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {{ isLoading ? $t('resetPassword.submitting') : $t('resetPassword.submit') }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.js'
import LocaleToggle from '../components/LocaleToggle.vue'

const { t } = useI18n()
const router = useRouter()

const MIN_PASSWORD_LENGTH = 8
const SUCCESS_REDIRECT_DELAY_MS = 2000

const newPassword = ref('')
const confirmPassword = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isLoading = ref(false)
const sessionReady = ref(false)
const sessionChecking = ref(true)

onMounted(async () => {
  try {
    const { data } = await supabase.auth.getSession()
    sessionReady.value = data.session !== null && data.session !== undefined
  } catch {
    sessionReady.value = false
  } finally {
    sessionChecking.value = false
  }
})

function mapSupabaseErrorToKey(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('password') && (lower.includes('weak') || lower.includes('strong') || lower.includes('short'))) {
    return 'resetPassword.errors.weakPassword'
  }
  return 'resetPassword.errors.generic'
}

async function handleSubmit(): Promise<void> {
  errorMessage.value = ''
  successMessage.value = ''

  if (!sessionReady.value) {
    errorMessage.value = t('resetPassword.errors.linkExpired')
    return
  }
  if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
    errorMessage.value = t('resetPassword.errors.tooShort')
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = t('resetPassword.errors.mismatch')
    return
  }

  isLoading.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword.value })
    if (error) {
      errorMessage.value = t(mapSupabaseErrorToKey(error.message))
      return
    }
    successMessage.value = t('resetPassword.successMessage')
    setTimeout(() => {
      void router.push('/app/matches')
    }, SUCCESS_REDIRECT_DELAY_MS)
  } catch {
    errorMessage.value = t('resetPassword.errors.generic')
  } finally {
    isLoading.value = false
  }
}
</script>
