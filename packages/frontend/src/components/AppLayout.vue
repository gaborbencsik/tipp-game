<template>
  <div class="h-screen bg-gray-50 flex flex-col overflow-hidden">

    <!-- Topbar -->
    <header class="flex items-center gap-3 bg-white px-2 py-2 h-14 shrink-0 border-b border-gray-200">
      <button
        data-testid="hamburger-btn"
        class="w-10 h-10 flex items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
        :aria-expanded="sidebarOpen"
        :aria-label="$t('nav.openNav')"
        @click="sidebarOpen = !sidebarOpen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span class="text-base font-semibold text-gray-800 select-none">{{ $t('login.title') }}</span>
      <div class="ml-auto">
        <UserMenuButton />
      </div>
    </header>

    <div class="flex flex-1 min-h-0 relative h-full">

      <!-- Mobile overlay backdrop -->
      <div
        v-if="sidebarOpen"
        class="md:hidden fixed inset-0 top-14 bg-black/30 z-10"
        @click="sidebarOpen = false"
      />

      <!-- Sidebar -->
      <aside
        class="bg-white flex flex-col overflow-hidden transition-all duration-200 border-r border-gray-200
               md:relative md:shrink-0 md:h-full
               max-md:fixed max-md:top-14 max-md:bottom-0 max-md:left-0 max-md:z-20"
        :class="[
          isExpanded ? 'w-56' : 'md:w-14 max-md:w-0',
        ]"
        @mouseleave="onSidebarMouseLeave"
      >
        <nav class="flex flex-col flex-1 gap-0.5 px-2 pt-3 min-w-[14rem] md:min-w-0 overflow-y-auto">

          <!-- Meccsek -->
          <router-link
            to="/app/matches"
            data-testid="nav-matches"
            class="flex items-center gap-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            :class="isExpanded ? 'px-3' : 'px-3 justify-center'"
            active-class="bg-blue-50 text-blue-700 font-semibold hover:bg-blue-50"
            @click="sidebarOpen = false"
            @mouseenter="onSidebarMouseEnter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span v-if="isExpanded" class="flex-1">{{ $t('nav.matches') }}</span>
            <span
              v-if="isExpanded && untippedTodayCount > 0"
              class="text-[0.65rem] font-bold bg-amber-400 text-white px-1.5 py-0.5 rounded-full min-w-[1.2rem] text-center"
            >{{ untippedTodayCount }}</span>
          </router-link>

          <!-- Torna tippek -->
          <router-link
            to="/app/tournament-tips"
            data-testid="nav-tournament-tips"
            class="flex items-center gap-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            :class="isExpanded ? 'px-3' : 'px-3 justify-center'"
            active-class="bg-blue-50 text-blue-700 font-semibold hover:bg-blue-50"
            @click="sidebarOpen = false"
            @mouseenter="onSidebarMouseEnter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 4h14v3a5 5 0 01-5 5h-4a5 5 0 01-5-5V4zm0 0H3m16 0h2M9 12v3m6-3v3m-7 3h8a1 1 0 011 1v2H7v-2a1 1 0 011-1z" />
            </svg>
            <span v-if="isExpanded">{{ $t('nav.tournamentTips') }}</span>
          </router-link>

          <!-- Tippjeim -->
          <router-link
            to="/app/my-tips"
            data-testid="nav-my-tips"
            class="flex items-center gap-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            :class="isExpanded ? 'px-3' : 'px-3 justify-center'"
            active-class="bg-blue-50 text-blue-700 font-semibold hover:bg-blue-50"
            @click="sidebarOpen = false"
            @mouseenter="onSidebarMouseEnter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span v-if="isExpanded">{{ $t('nav.myTips') }}</span>
          </router-link>

          <!-- Csoportok -->
          <router-link
            to="/app/groups"
            data-testid="nav-groups"
            class="flex items-center gap-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            :class="isExpanded ? 'px-3' : 'px-3 justify-center'"
            active-class="bg-blue-50 text-blue-700 font-semibold hover:bg-blue-50"
            @click="sidebarOpen = false"
            @mouseenter="onSidebarMouseEnter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5m6 0v-2a4 4 0 00-2-2H9a4 4 0 00-2 2v2m6 0H9" />
            </svg>
            <span v-if="isExpanded">{{ $t('nav.groups') }}</span>
          </router-link>

          <!-- Ranglista -->
          <router-link
            to="/app/leaderboard"
            data-testid="nav-leaderboard"
            class="flex items-center gap-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            :class="isExpanded ? 'px-3' : 'px-3 justify-center'"
            active-class="bg-blue-50 text-blue-700 font-semibold hover:bg-blue-50"
            @click="sidebarOpen = false"
            @mouseenter="onSidebarMouseEnter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span v-if="isExpanded">{{ $t('nav.leaderboard') }}</span>
          </router-link>

          <DonationButton :sidebar-open="isExpanded" />
        </nav>
      </aside>

      <!-- Main content -->
      <div class="flex-1 p-4 md:p-8 min-w-0 overflow-y-auto">
        <div class="max-w-5xl">
          <slot />
        </div>
      </div>

    </div>

    <!-- Onboarding overlay -->
    <OnboardingOverlay
      v-if="showOnboarding"
      @complete="onOnboardingComplete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import UserMenuButton from './UserMenuButton.vue'
import OnboardingOverlay from './OnboardingOverlay.vue'
import DonationButton from './DonationButton.vue'
import { useAuthStore } from '../stores/auth.store.js'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'

const authStore = useAuthStore()
const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()
const sidebarOpen = ref(false)
const sidebarHover = ref(false)
let hoverTimeout: ReturnType<typeof setTimeout> | null = null

function onSidebarMouseEnter(): void {
  if (window.innerWidth < 768) return
  hoverTimeout = setTimeout(() => { sidebarHover.value = true }, 150)
}

function onSidebarMouseLeave(): void {
  if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null }
  sidebarHover.value = false
}

const isExpanded = computed((): boolean => sidebarOpen.value || sidebarHover.value)

const showOnboarding = computed((): boolean => {
  return !!authStore.user && !authStore.user.onboardingCompletedAt
})

const untippedTodayCount = computed((): number => {
  const today = new Date()
  const now = new Date()
  return matchesStore.matches.filter(m => {
    if (m.status !== 'scheduled') return false
    const d = new Date(m.scheduledAt)
    if (d.getFullYear() !== today.getFullYear() || d.getMonth() !== today.getMonth() || d.getDate() !== today.getDate()) return false
    if (d <= now) return false
    return !predictionsStore.predictionByMatchId(m.id)
  }).length
})

async function onOnboardingComplete(): Promise<void> {
  await authStore.completeOnboarding()
}
</script>
