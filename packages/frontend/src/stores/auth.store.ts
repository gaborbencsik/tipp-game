import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { User } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  supabaseId: '00000000-0000-0000-0000-000000000001',
  email: 'dev@local',
  displayName: 'Dev User',
  avatarUrl: null,
  role: 'admin',
}

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const router = useRouter()

  function isAuthenticated(): boolean {
    return user.value !== null
  }

  async function handleSession(session: Session): Promise<void> {
    try {
      user.value = await api.auth.me(session.access_token)
    } catch {
      user.value = null
    }
  }

  async function restoreSession(): Promise<void> {
    if (DEV_AUTH_BYPASS) return

    const { data } = await supabase.auth.getSession()
    if (data.session) {
      await handleSession(data.session)
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await handleSession(session)
      } else {
        user.value = null
      }
    })
  }

  async function login(): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      user.value = MOCK_USER
      await router.push('/')
      return
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
  }

  async function logout(): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      user.value = null
      await router.push('/login')
      return
    }
    await supabase.auth.signOut()
    user.value = null
    await router.push('/login')
  }

  async function loginWithEmail(email: string, password: string): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      user.value = MOCK_USER
      await router.push('/')
      return
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new AuthError(error.message)
    await handleSession(data.session as Session)
    await router.push('/')
  }

  async function registerWithEmail(email: string, password: string, displayName: string): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      user.value = { ...MOCK_USER, email, displayName }
      await router.push('/')
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    })
    if (error) throw new AuthError(error.message)
    await handleSession(data.session as Session)
    await router.push('/')
  }

  return { user, isAuthenticated, handleSession, restoreSession, login, logout, loginWithEmail, registerWithEmail }
})

