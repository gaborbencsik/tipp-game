<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900">Waitlist</h1>
    </div>
    <div class="flex gap-2 mb-6">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Meccsek</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/players" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Játékosok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasznalok</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
    </div>

    <!-- Counter card -->
    <div data-testid="counter-card" class="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6 text-center">
      <div class="text-4xl font-bold text-blue-600">{{ store.totalCount }}</div>
      <div class="text-sm text-gray-500 mt-1">feliratkozott</div>
    </div>

    <!-- Add button -->
    <div class="mb-4">
      <button
        v-if="!showAddForm"
        data-testid="add-button"
        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
        @click="showAddForm = true"
      >
        + Email hozzaadasa
      </button>
    </div>

    <!-- Add form -->
    <div v-if="showAddForm" data-testid="add-form" class="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
      <form @submit.prevent="handleAdd" class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="addEmail"
          data-testid="add-email-input"
          type="email"
          placeholder="Email cim..."
          class="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
          :class="{ 'border-red-400': addFormError }"
          :disabled="store.isAdding"
        />
        <select
          v-model="addSource"
          data-testid="add-source-select"
          class="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
          :disabled="store.isAdding"
        >
          <option value="admin">Admin</option>
          <option value="hero">Hero</option>
          <option value="footer">Footer</option>
        </select>
        <div class="flex gap-2">
          <button
            type="submit"
            data-testid="add-submit"
            class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="store.isAdding"
          >
            {{ store.isAdding ? 'Hozzaadas...' : 'Hozzaadas' }}
          </button>
          <button
            type="button"
            data-testid="add-cancel"
            class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            :disabled="store.isAdding"
            @click="closeAddForm"
          >
            Megse
          </button>
        </div>
      </form>
      <p v-if="addFormError" data-testid="add-form-error" class="mt-2 text-sm text-red-600">{{ addFormError }}</p>
      <p v-if="store.addError" data-testid="add-api-error" class="mt-2 text-sm text-red-600">{{ store.addError }}</p>
    </div>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <select
        data-testid="source-filter"
        :value="store.filters.source ?? ''"
        class="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
        @change="onSourceChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Osszes forras</option>
        <option value="hero">Hero</option>
        <option value="footer">Footer</option>
        <option value="admin">Admin</option>
      </select>
      <input
        data-testid="search-input"
        type="text"
        placeholder="Kereses email alapjan..."
        :value="store.filters.search ?? ''"
        class="border border-gray-300 rounded px-3 py-2 text-sm flex-1"
        @input="onSearchInput(($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Error banner -->
    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <!-- Confirm delete dialog -->
    <div v-if="confirmDeleteId" data-testid="confirm-dialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
        <p class="text-gray-800 mb-4">Biztosan torlod ezt a bejegyzest? Ez a muvelet nem vonhato vissza.</p>
        <div class="flex gap-3 justify-end">
          <button
            data-testid="confirm-cancel"
            class="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            @click="confirmDeleteId = null"
          >
            Megse
          </button>
          <button
            data-testid="confirm-delete"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
            @click="handleConfirmDelete"
          >
            Torles
          </button>
        </div>
      </div>
    </div>

    <!-- Spinner -->
    <div v-if="store.isLoading" data-testid="spinner" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Table -->
    <div v-else-if="store.entries.length > 0" class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-100">
          <tr>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Email</th>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Forras</th>
            <th class="text-left px-4 py-2 text-xs text-gray-500 font-medium">Feliratkozas</th>
            <th class="px-4 py-2 text-xs text-gray-500 font-medium w-16"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in store.entries"
            :key="entry.id"
            data-testid="waitlist-row"
            class="border-b border-gray-50 last:border-0 hover:bg-gray-50"
          >
            <td class="px-4 py-2 text-gray-800">{{ entry.email }}</td>
            <td class="px-4 py-2">
              <span
                :class="sourceBadgeClass(entry.source)"
                class="px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ sourceLabel(entry.source) }}
              </span>
            </td>
            <td class="px-4 py-2 text-gray-500">{{ formatDate(entry.createdAt) }}</td>
            <td class="px-4 py-2 text-center">
              <button
                data-testid="delete-button"
                class="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="store.deletingId === entry.id"
                :title="'Torles'"
                @click="confirmDeleteId = entry.id"
              >
                <svg v-if="store.deletingId === entry.id" class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="opacity-75" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty state -->
    <div v-else data-testid="empty-state" class="bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-12 text-center text-gray-400 text-sm">
      Meg nincs feliratkozott
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useAdminWaitlistStore } from '../stores/admin-waitlist.store.js'
import type { WaitlistSource } from '../types/index.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const store = useAdminWaitlistStore()

const showAddForm = ref(false)
const addEmail = ref('')
const addSource = ref<WaitlistSource>('admin')
const addFormError = ref<string | null>(null)
const confirmDeleteId = ref<string | null>(null)

onMounted(() => { void store.fetchWaitlist() })

function onSourceChange(value: string): void {
  const source = value === 'hero' || value === 'footer' || value === 'admin' ? value as WaitlistSource : undefined
  store.setSourceFilter(source)
  void store.fetchWaitlist()
}

function onSearchInput(value: string): void {
  store.setSearchFilter(value)
  void store.fetchWaitlist()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU')
}

function sourceBadgeClass(source: WaitlistSource): string {
  if (source === 'hero') return 'bg-blue-100 text-blue-700'
  if (source === 'footer') return 'bg-green-100 text-green-700'
  return 'bg-purple-100 text-purple-700'
}

function sourceLabel(source: WaitlistSource): string {
  if (source === 'hero') return 'Hero'
  if (source === 'footer') return 'Footer'
  return 'Admin'
}

function closeAddForm(): void {
  showAddForm.value = false
  addEmail.value = ''
  addSource.value = 'admin'
  addFormError.value = null
  store.addError = null
}

async function handleAdd(): Promise<void> {
  addFormError.value = null
  store.addError = null

  const email = addEmail.value.trim()
  if (!email || !EMAIL_REGEX.test(email)) {
    addFormError.value = 'Ervenytelen email cim'
    return
  }

  const success = await store.addEntry(email, addSource.value)
  if (success) {
    closeAddForm()
  }
}

async function handleConfirmDelete(): Promise<void> {
  const id = confirmDeleteId.value
  confirmDeleteId.value = null
  if (id) {
    await store.deleteEntry(id)
  }
}
</script>
