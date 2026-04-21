<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Csoportok</h1>
      <div v-if="store.groups.length > 0" class="flex gap-2">
        <button
          data-testid="join-group-btn"
          class="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          @click="showJoinForm = true"
        >
          Csatlakozás
        </button>
        <button
          data-testid="create-group-btn"
          class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          @click="showCreateForm = true"
        >
          Csoport létrehozása
        </button>
      </div>
    </div>

    <!-- Create form -->
    <div v-if="showCreateForm" data-testid="create-form" class="mb-6 bg-white border border-gray-200 rounded-xl p-5">
      <h2 class="text-base font-semibold text-gray-900 mb-4">Új csoport létrehozása</h2>
      <form @submit.prevent="onCreateSubmit">
        <div class="flex flex-col gap-3">
          <input
            v-model="createName"
            data-testid="create-name-input"
            type="text"
            placeholder="Csoport neve"
            maxlength="60"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            v-model="createDescription"
            data-testid="create-description-input"
            type="text"
            placeholder="Leírás (opcionális)"
            maxlength="200"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="createError" data-testid="create-error" class="text-red-600 text-xs">{{ createError }}</p>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              @click="closeCreateForm"
            >
              Mégse
            </button>
            <button
              type="submit"
              data-testid="create-submit-btn"
              :disabled="isSubmitting"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Létrehozás
            </button>
          </div>
        </div>
      </form>
    </div>

    <!-- Join form -->
    <div v-if="showJoinForm" data-testid="join-form" class="mb-6 bg-white border border-gray-200 rounded-xl p-5">
      <h2 class="text-base font-semibold text-gray-900 mb-4">Csatlakozás meghívó kóddal</h2>
      <form @submit.prevent="onJoinSubmit">
        <div class="flex flex-col gap-3">
          <input
            v-model="joinCode"
            data-testid="join-code-input"
            type="text"
            placeholder="Meghívó kód (pl. ABCD1234)"
            maxlength="8"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p v-if="joinError" data-testid="join-error" class="text-red-600 text-xs">{{ joinError }}</p>
          <div class="flex gap-2 justify-end">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              @click="closeJoinForm"
            >
              Mégse
            </button>
            <button
              type="submit"
              data-testid="join-submit-btn"
              :disabled="isSubmitting"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Csatlakozás
            </button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="store.isLoading" data-testid="spinner" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <div v-else-if="store.groups.length === 0 && !showCreateForm && !showJoinForm" data-testid="empty-state" class="flex flex-col items-center justify-center py-24 gap-4">
      <p class="text-gray-500 text-sm">Még nem vagy egyetlen csoport tagja sem.</p>
      <div class="flex gap-3">
        <button
          data-testid="empty-join-btn"
          class="px-5 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          @click="showJoinForm = true"
        >
          Csatlakozás
        </button>
        <button
          data-testid="create-group-btn"
          class="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          @click="showCreateForm = true"
        >
          Csoport létrehozása
        </button>
      </div>
    </div>

    <div v-else-if="store.groups.length > 0" data-testid="groups-list">
      <ul class="flex flex-col gap-3">
        <li
          v-for="group in store.groups"
          :key="group.id"
          data-testid="group-item"
        >
          <router-link
            :to="`/app/groups/${group.id}`"
            class="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-5 py-4 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900">{{ group.name }}</span>
                <span v-if="group.isAdmin" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">admin</span>
              </div>
              <p v-if="group.description" class="text-xs text-gray-500 mt-0.5">{{ group.description }}</p>
              <div v-if="group.inviteActive" class="flex items-center gap-2 mt-1.5" @click.prevent>
                <span class="font-mono text-xs text-gray-500 tracking-widest" data-testid="invite-code">{{ group.inviteCode }}</span>
                <button
                  class="text-xs px-1.5 py-0.5 rounded transition-all duration-200"
                  :class="copiedState.get(group.id) === 'code' ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-gray-600'"
                  @click.stop.prevent="copyCode(group.id, group.inviteCode)"
                >
                  {{ copiedState.get(group.id) === 'code' ? '✓ Másolva' : 'Kód' }}
                </button>
                <button
                  class="text-xs px-1.5 py-0.5 rounded transition-all duration-200"
                  :class="copiedState.get(group.id) === 'url' ? 'bg-green-100 text-green-600' : 'text-blue-600 hover:text-blue-800'"
                  @click.stop.prevent="copyUrl(group.id, group.inviteCode)"
                >
                  {{ copiedState.get(group.id) === 'url' ? '✓ Másolva' : 'Link másolása' }}
                </button>
              </div>
              <div v-else-if="group.isAdmin" class="flex items-center gap-2 mt-1.5">
                <span data-testid="invite-inactive-badge" class="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Meghívó inaktív</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-4">
              <span v-if="group.userRank != null" data-testid="rank-badge" class="text-xs font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">#{{ group.userRank }}</span>
              <span class="text-sm text-gray-400">{{ group.memberCount }} tag</span>
            </div>
          </router-link>
        </li>
      </ul>
    </div>

    <p v-if="store.error" data-testid="error-banner" class="mt-4 p-3 bg-red-100 text-red-700 rounded text-sm">
      {{ store.error }}
    </p>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useGroupsStore } from '../stores/groups.store.js'

const store = useGroupsStore()

const showCreateForm = ref(false)
const showJoinForm = ref(false)
const isSubmitting = ref(false)

const createName = ref('')
const createDescription = ref('')
const createError = ref<string | null>(null)

const joinCode = ref('')
const joinError = ref<string | null>(null)
const copiedState = ref(new Map<string, 'code' | 'url'>())

function setCopied(groupId: string, type: 'code' | 'url'): void {
  copiedState.value = new Map(copiedState.value).set(groupId, type)
  setTimeout(() => {
    const next = new Map(copiedState.value)
    next.delete(groupId)
    copiedState.value = next
  }, 2000)
}

async function copyCode(groupId: string, code: string): Promise<void> {
  await navigator.clipboard.writeText(code)
  setCopied(groupId, 'code')
}

async function copyUrl(groupId: string, code: string): Promise<void> {
  await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`)
  setCopied(groupId, 'url')
}

onMounted(async () => {
  await store.fetchMyGroups()
})

function closeCreateForm(): void {
  showCreateForm.value = false
  createName.value = ''
  createDescription.value = ''
  createError.value = null
}

function closeJoinForm(): void {
  showJoinForm.value = false
  joinCode.value = ''
  joinError.value = null
}

async function onCreateSubmit(): Promise<void> {
  createError.value = null
  isSubmitting.value = true
  try {
    await store.createGroup({
      name: createName.value.trim(),
      description: createDescription.value.trim() || null,
    })
    closeCreateForm()
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isSubmitting.value = false
  }
}

async function onJoinSubmit(): Promise<void> {
  joinError.value = null
  isSubmitting.value = true
  try {
    await store.joinGroup({ inviteCode: joinCode.value.trim().toUpperCase() })
    closeJoinForm()
  } catch (err) {
    joinError.value = err instanceof Error ? err.message : 'Ismeretlen hiba'
  } finally {
    isSubmitting.value = false
  }
}
</script>
