<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Csoportok</h1>
    </div>

    <div v-if="isLoading" data-testid="spinner" class="flex justify-center py-12">
      <div class="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>

    <div v-else-if="groups.length === 0" data-testid="empty-state" class="flex flex-col items-center justify-center py-24 gap-4">
      <p class="text-gray-500 text-sm">Még nem vagy egyetlen csoport tagja sem.</p>
      <button
        data-testid="create-group-btn"
        class="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        @click="showCreateForm = true"
      >
        Csoport létrehozása
      </button>
    </div>

    <div v-else data-testid="groups-list">
      <ul class="flex flex-col gap-3">
        <li
          v-for="group in groups"
          :key="group.id"
          data-testid="group-item"
          class="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between hover:border-blue-300 transition-colors"
        >
          <div>
            <p class="font-semibold text-gray-900">{{ group.name }}</p>
            <p v-if="group.description" class="text-xs text-gray-500 mt-0.5">{{ group.description }}</p>
          </div>
        </li>
      </ul>
    </div>

    <p v-if="error" data-testid="error-banner" class="mt-4 p-3 bg-red-100 text-red-700 rounded text-sm">
      {{ error }}
    </p>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'

interface Group {
  readonly id: string
  readonly name: string
  readonly description: string | null
}

const groups = ref<Group[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const showCreateForm = ref(false)

onMounted(() => {
  // US-601 implementálja a tényleges API hívást; itt az üres állapot a kezdőpont
  isLoading.value = false
})
</script>
