<template>
  <div class="flex items-center justify-center min-h-screen">
    <p class="text-gray-500">{{ $t('authCallback.loading') }}</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase.js'
import { useAuthStore } from '../stores/auth.store.js'
import { useGroupsStore } from '../stores/groups.store.js'

const authStore = useAuthStore()
const groupsStore = useGroupsStore()
const router = useRouter()

function mapJoinErrorToKey(err: unknown): string {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('not found')) return 'notFound'
  if (message.includes('no longer active')) return 'inactive'
  if (message.includes('Already a member')) return 'alreadyMember'
  return 'generic'
}

async function handlePostLogin(): Promise<void> {
  const code = authStore.pendingInviteCode
  if (!code) {
    await router.push({ name: 'home' })
    return
  }
  try {
    const group = await groupsStore.joinGroup({ inviteCode: code })
    authStore.clearPendingInviteCode()
    await router.replace(`/app/groups/${group.id}`)
  } catch (err) {
    authStore.clearPendingInviteCode()
    const errorKey = mapJoinErrorToKey(err)
    await router.replace({ path: '/app/groups', query: { inviteError: errorKey } })
  }
}

onMounted(async () => {
  let unsubscribeFn: (() => void) | null = null

  const result = supabase.auth.onAuthStateChange(async (_event, session) => {
    unsubscribeFn?.()
    if (session) {
      await authStore.handleSession(session)
    }
    await handlePostLogin()
  })
  unsubscribeFn = () => result.data.subscription.unsubscribe()

  // fallback: ha már van session (pl. frissítéskor)
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    unsubscribeFn()
    await authStore.handleSession(data.session)
    await handlePostLogin()
  }
})
</script>
