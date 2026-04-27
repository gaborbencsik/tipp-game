<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Felhasználók kezelése</h1>
    </div>
    <div class="flex gap-2 mb-6">
      <router-link to="/admin/matches" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Mérkőzések</router-link>
      <router-link to="/admin/teams" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Csapatok</router-link>
      <router-link to="/admin/players" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Játékosok</router-link>
      <router-link to="/admin/users" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Felhasználók</router-link>
      <router-link to="/admin/scoring" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Pontrendszer</router-link>
      <router-link to="/admin/waitlist" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Waitlist</router-link>
      <router-link to="/admin/global-types" class="px-3 py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300" exact-active-class="!bg-blue-600 !text-white">Stat tippek</router-link>
    </div>

    <div v-if="store.error" data-testid="error-banner" class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      {{ store.error }}
    </div>

    <div v-if="store.isLoading" data-testid="spinner" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="bg-gray-50 text-left">
            <th class="px-4 py-2 font-semibold">Email</th>
            <th class="px-4 py-2 font-semibold">Felhasználó</th>
            <th class="px-4 py-2 font-semibold">Szerepkör</th>
            <th class="px-4 py-2 font-semibold">Státusz</th>
            <th class="px-4 py-2 font-semibold">Regisztrálva</th>
            <th class="px-4 py-2 font-semibold">Műveletek</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in store.users"
            :key="user.id"
            data-testid="user-row"
            class="border-t hover:bg-gray-50"
          >
            <td class="px-4 py-2">{{ user.email }}</td>
            <td class="px-4 py-2">
              <div class="flex items-center gap-2">
                <img
                  :src="dicebearUrl(user.displayName)"
                  :alt="user.displayName"
                  class="w-7 h-7 rounded-full object-cover shrink-0"
                />
                <span>{{ user.displayName }}</span>
              </div>
            </td>
            <td class="px-4 py-2">
              <select
                data-testid="role-select"
                :value="user.role"
                :disabled="user.id === authStore.user?.id"
                class="text-xs border border-gray-300 rounded px-2 py-1 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                @change="onRoleChange(user, ($event.target as HTMLSelectElement).value as 'user' | 'admin')"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </td>
            <td class="px-4 py-2">
              <span
                :class="user.bannedAt ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'"
                class="px-2 py-0.5 rounded-full text-xs font-medium"
              >
                {{ user.bannedAt ? 'Tiltott' : 'Aktív' }}
              </span>
            </td>
            <td class="px-4 py-2 text-gray-500">{{ formatDate(user.createdAt) }}</td>
            <td class="px-4 py-2 flex gap-2">
              <button
                data-testid="ban-btn"
                :disabled="user.id === authStore.user?.id"
                :class="user.bannedAt ? 'border-green-500 text-green-700 hover:bg-green-50' : 'border-red-400 text-red-600 hover:bg-red-50'"
                class="px-3 py-1 text-xs rounded border disabled:opacity-40 disabled:cursor-not-allowed"
                @click="toggleBan(user)"
              >
                {{ user.bannedAt ? 'Feloldás' : 'Tiltás' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import { useAdminUsersStore } from '../stores/admin-users.store.js'
import { useAuthStore } from '../stores/auth.store.js'
import { dicebearUrl } from '../lib/avatar.js'
import type { AdminUser } from '../types/index.js'

const store = useAdminUsersStore()
const authStore = useAuthStore()

onMounted(() => { void store.fetchUsers() })

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('hu-HU')
}

async function onRoleChange(user: AdminUser, newRole: 'user' | 'admin'): Promise<void> {
  await store.updateUserRole(user.id, newRole)
}

async function toggleBan(user: AdminUser): Promise<void> {
  await store.banUser(user.id, !user.bannedAt)
}
</script>
