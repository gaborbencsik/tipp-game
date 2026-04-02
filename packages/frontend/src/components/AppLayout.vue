<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">

    <!-- Topbar -->
    <header class="flex items-center gap-3 bg-white px-2 py-2 h-14 shrink-0">
      <button
        data-testid="hamburger-btn"
        class="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
        :aria-expanded="sidebarOpen"
        aria-label="Navigáció megnyitása"
        @click="sidebarOpen = !sidebarOpen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span class="text-base font-semibold text-gray-800 select-none">VB Tippjáték</span>
      <div class="ml-auto">
        <UserMenuButton />
      </div>
    </header>

    <div class="flex flex-1 min-h-0 relative">

      <!-- Mobile overlay backdrop -->
      <div
        v-if="sidebarOpen"
        class="md:hidden fixed inset-0 top-14 bg-black/30 z-10"
        @click="sidebarOpen = false"
      />

      <!-- Sidebar -->
      <aside
        class="bg-white flex flex-col py-2 overflow-hidden transition-all duration-200
               md:relative md:shrink-0
               max-md:fixed max-md:top-14 max-md:bottom-0 max-md:left-0 max-md:z-20"
        :class="[
          sidebarOpen ? 'w-56' : 'md:w-14 max-md:w-0',
        ]"
      >
        <nav class="flex flex-col gap-1 px-2 min-w-[14rem] md:min-w-0">

          <!-- Meccsek -->
          <router-link
            to="/matches"
            data-testid="nav-matches"
            class="flex items-center gap-3 py-2 rounded-full text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            :class="sidebarOpen ? 'px-4' : 'px-3 justify-center'"
            active-class="bg-blue-100 text-blue-800 font-semibold hover:bg-blue-100"
            @click="sidebarOpen = false"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span v-if="sidebarOpen">Meccsek</span>
          </router-link>

          <!-- Ranglista (disabled) -->
          <button
            disabled
            class="flex items-center gap-3 py-2 rounded-full text-sm text-gray-400 cursor-not-allowed"
            :class="sidebarOpen ? 'px-4' : 'px-3 justify-center'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span v-if="sidebarOpen">Ranglista</span>
          </button>

          <!-- Csoportok (disabled) -->
          <button
            disabled
            class="flex items-center gap-3 py-2 rounded-full text-sm text-gray-400 cursor-not-allowed"
            :class="sidebarOpen ? 'px-4' : 'px-3 justify-center'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5m6 0v-2a4 4 0 00-2-2H9a4 4 0 00-2 2v2m6 0H9" />
            </svg>
            <span v-if="sidebarOpen">Csoportok</span>
          </button>

        </nav>
      </aside>

      <!-- Main content -->
      <div class="flex-1 p-4 md:p-8 min-w-0">
        <div class="max-w-5xl">
          <slot />
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UserMenuButton from './UserMenuButton.vue'

const sidebarOpen = ref(false)
</script>
