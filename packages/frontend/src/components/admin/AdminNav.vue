<template>
  <nav class="flex flex-wrap gap-2 mb-6" aria-label="Admin navigáció">
    <router-link
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="px-3 py-1.5 md:py-1 text-sm rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
      exact-active-class="!bg-blue-600 !text-white"
    >
      {{ link.label }}
    </router-link>
  </nav>
</template>

<script setup lang="ts">
interface AdminNavLink {
  readonly to: string
  readonly label: string
}

const links: ReadonlyArray<AdminNavLink> = [
  { to: '/admin/stats', label: 'Statisztikák' },
  { to: '/admin/matches', label: 'Mérkőzések' },
  { to: '/admin/teams', label: 'Csapatok' },
  { to: '/admin/players', label: 'Játékosok' },
  { to: '/admin/users', label: 'Felhasználók' },
  { to: '/admin/scoring', label: 'Pontrendszer' },
  { to: '/admin/waitlist', label: 'Waitlist' },
  { to: '/admin/global-types', label: 'Speciális tippek' },
  { to: '/admin/sync', label: 'Szinkron' },
] as const
</script>
