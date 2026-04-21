<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900">Waitlist</h1>
    </div>
    <div class="flex gap-2 mb-6">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Meccsek</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasznalok</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
    </div>

    <!-- Counter card -->
    <div data-testid="counter-card" class="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-6 text-center">
      <div class="text-4xl font-bold text-blue-600">{{ store.totalCount }}</div>
      <div class="text-sm text-gray-500 mt-1">feliratkozott</div>
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
                :class="entry.source === 'hero' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'"
                class="px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ entry.source === 'hero' ? 'Hero' : 'Footer' }}
              </span>
            </td>
            <td class="px-4 py-2 text-gray-500">{{ formatDate(entry.createdAt) }}</td>
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
import { onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useAdminWaitlistStore } from '../stores/admin-waitlist.store.js'
import type { WaitlistSource } from '../types/index.js'

const store = useAdminWaitlistStore()

onMounted(() => { void store.fetchWaitlist() })

function onSourceChange(value: string): void {
  const source = value === 'hero' || value === 'footer' ? value as WaitlistSource : undefined
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
</script>
