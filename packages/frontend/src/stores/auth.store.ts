import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { User } from '../types/index.js'

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

const DEV_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000
const DEV_SESSION_KEY = 'dev_session'

interface DevSession {
  user: User
  expiresAt: number
}

const MOCK_USER: User = {
  id: '00000000-0000-0000-0000-000000000001',
  supabaseId: '00000000-0000-0000-0000-000000000001',
  email: 'admin@dev.local',
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

  function isAdmin(): boolean {
    return user.value?.role === 'admin'
  }

  async function handleSession(session: Session): Promise<void> {
    user.value = await api.auth.me(session.access_token)
  }

  async function restoreSession(): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      const raw = sessionStorage.getItem(DEV_SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DevSession
        if (parsed.expiresAt > Date.now()) {
          user.value = parsed.user
        } else {
          sessionStorage.removeItem(DEV_SESSION_KEY)
        }
      }
      return
    }

    return new Promise((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (session) {
            try {
              await handleSession(session)
            } catch {
              user.value = null
            }
          }
          subscription.unsubscribe()
          resolve()
        } else if (session) {
          try {
            await handleSession(session)
          } catch {
            user.value = null
          }
        } else {
          user.value = null
        }
      })
    })
  }

  async function login(): Promise<void> {
    if (DEV_AUTH_BYPASS) {
      sessionStorage.setItem(DEV_SESSION_KEY, JSON.stringify({
        user: MOCK_USER,
        expiresAt: Date.now() + DEV_SESSION_TTL_MS,
      }))
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
      sessionStorage.removeItem(DEV_SESSION_KEY)
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
      sessionStorage.setItem(DEV_SESSION_KEY, JSON.stringify({
        user: MOCK_USER,
        expiresAt: Date.now() + DEV_SESSION_TTL_MS,
      }))
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
      const mockUser = { ...MOCK_USER, email, displayName }
      sessionStorage.setItem(DEV_SESSION_KEY, JSON.stringify({
        user: mockUser,
        expiresAt: Date.now() + DEV_SESSION_TTL_MS,
      }))
      user.value = mockUser
      await router.push('/')
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    })
    if (error) throw new AuthError(error.message)
    await handleSession(data.session as Session)
    await router.push('/')
  }

  async function updateProfile(displayName: string): Promise<void> {
    let token: string
    if (DEV_AUTH_BYPASS) {
      token = 'dev-bypass-token'
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token ?? ''
    }
    const updated = await api.users.updateProfile(token, displayName)
    if (user.value) {
      user.value = { ...user.value, displayName: updated.displayName }
    }
    if (DEV_AUTH_BYPASS) {
      const raw = sessionStorage.getItem(DEV_SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DevSession
        sessionStorage.setItem(DEV_SESSION_KEY, JSON.stringify({
          ...parsed,
          user: { ...parsed.user, displayName: updated.displayName },
        }))
      }
    }
  }

  return { user, isAuthenticated, isAdmin, handleSession, restoreSession, login, logout, loginWithEmail, registerWithEmail, updateProfile }
})

