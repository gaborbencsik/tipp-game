import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { User } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
  role: 'admin',
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const router = useRouter()

  function isAuthenticated(): boolean {
    return user.value !== null
  }

  async function login(): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      user.value = MOCK_USER
      await router.push('/')
      return
    }
    // Supabase Google OAuth – implementálandó
    throw new Error('OAuth not configured')
  }

  async function logout(): Promise<void> {
    user.value = null
    await router.push('/login')
  }

  return { user, isAuthenticated, login, logout }
})
