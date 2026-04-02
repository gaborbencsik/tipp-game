<template>
  <AppLayout>
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Profil</h1>

      <div class="bg-white rounded shadow p-6 space-y-4">
        <div class="flex justify-center mb-4">
          <img
            :src="avatarSrc"
            alt="Avatar"
            data-testid="avatar"
            class="w-16 h-16 rounded-full"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
          <p data-testid="email" class="text-gray-900">{{ authStore.user?.email }}</p>
        </div>

        <form @submit.prevent="save">
          <div class="mb-4">
            <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">Megjelenített név</label>
            <input
              id="displayName"
              v-model="displayName"
              data-testid="displayName-input"
              type="text"
              maxlength="30"
              class="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div v-if="errorMessage" data-testid="error-banner" class="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {{ errorMessage }}
          </div>

          <div v-if="saveSuccess" data-testid="save-success" class="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
            Profil elmentve!
          </div>

          <button
            type="submit"
            data-testid="save-btn"
            :disabled="isSaving"
            class="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {{ isSaving ? 'Mentés...' : 'Mentés' }}
          </button>
        </form>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth.store.js'
import AppLayout from '../components/AppLayout.vue'
import { dicebearUrl } from '../lib/avatar.js'

const authStore = useAuthStore()

const avatarSrc = computed((): string => {
  const user = authStore.user
  if (user?.avatarUrl) return user.avatarUrl
  return dicebearUrl(user?.displayName || user?.email || 'user')
})

const displayName = ref(authStore.user?.displayName ?? '')
const isSaving = ref(false)
const errorMessage = ref<string | null>(null)
const saveSuccess = ref(false)

onMounted(() => {
  displayName.value = authStore.user?.displayName ?? ''
})

async function save(): Promise<void> {
  if (!displayName.value.trim()) return
  isSaving.value = true
  errorMessage.value = null
  saveSuccess.value = false
  try {
    await authStore.updateProfile(displayName.value.trim())
    saveSuccess.value = true
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isSaving.value = false
  }
}
</script>
