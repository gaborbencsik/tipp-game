<template>
  <AppLayout>
    <div class="flex flex-col items-center justify-center py-24 gap-4">
      <div v-if="isLoading" class="text-gray-500">{{ $t('join.loading') }}</div>
      <div v-else-if="error" class="text-center">
        <p class="text-red-600 mb-4">{{ error }}</p>
        <router-link to="/app/groups" class="text-blue-600 hover:text-blue-800 text-sm">{{ $t('join.backToGroups') }}</router-link>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '../components/AppLayout.vue'
import { useGroupsStore } from '../stores/groups.store.js'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()

const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const code = route.params.code as string
  try {
    const group = await groupsStore.joinGroup({ inviteCode: code })
    await router.replace(`/app/groups/${group.id}`)
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('common.unknownError')
    isLoading.value = false
  }
})
</script>
