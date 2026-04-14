<template>
  <div class="relative">
    <!-- Avatar trigger -->
    <button
      data-testid="user-menu-btn"
      class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      @click="menuOpen = !menuOpen"
    >
      <img
        :src="avatarSrc"
        data-testid="avatar-img"
        class="w-full h-full object-cover"
        alt="Avatar"
      />
    </button>

    <!-- Backdrop (z-10) -->
    <div
      v-if="menuOpen"
      class="fixed inset-0 z-10"
      data-testid="user-menu-backdrop"
      @click="menuOpen = false"
    />

    <!-- Dropdown panel (z-20) -->
    <div
      v-if="menuOpen"
      data-testid="user-menu-dropdown"
      class="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 z-20 overflow-hidden"
    >
      <div class="px-4 py-3 border-b border-gray-100">
        <p data-testid="menu-display-name" class="text-sm font-semibold text-gray-800 truncate">
          {{ authStore.user?.displayName }}
        </p>
        <p data-testid="menu-email" class="text-xs text-gray-500 truncate mt-0.5">
          {{ authStore.user?.email }}
        </p>
      </div>
      <router-link
        v-if="isAdmin"
        to="/admin/matches"
        data-testid="menu-admin-matches"
        class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        @click="menuOpen = false"
      >
        Admin – Mérkőzések
      </router-link>
      <router-link
        v-if="isAdmin"
        to="/admin/teams"
        data-testid="menu-admin-teams"
        class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        @click="menuOpen = false"
      >
        Admin – Csapatok
      </router-link>
      <router-link
        v-if="isAdmin"
        to="/admin/users"
        data-testid="menu-admin-users"
        class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        @click="menuOpen = false"
      >
        Admin – Felhasználók
      </router-link>
      <router-link
        v-if="isAdmin"
        to="/admin/scoring"
        data-testid="menu-admin-scoring"
        class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        @click="menuOpen = false"
      >
        Admin – Pontrendszer
      </router-link>
      <div v-if="isAdmin" class="border-t border-gray-100" />
      <router-link
        to="/profile"
        data-testid="menu-profile"
        class="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        @click="menuOpen = false"
      >
        Profil
      </router-link>
      <div class="border-t border-gray-100" />
      <button
        data-testid="menu-logout"
        class="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
        @click="menuOpen = false; authStore.logout()"
      >
        Kijelentkezés
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth.store.js'
import { dicebearUrl } from '../lib/avatar.js'

const authStore = useAuthStore()
const menuOpen = ref(false)
const isAdmin = computed((): boolean => authStore.user?.role === 'admin')
const avatarSrc = computed((): string => {
  const user = authStore.user
  if (user?.avatarUrl) return user.avatarUrl
  return dicebearUrl(user?.displayName || user?.email || 'user')
})
</script>
