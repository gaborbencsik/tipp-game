import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.store.js'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/auth/callback',
      name: 'auth-callback',
      component: () => import('../views/AuthCallbackView.vue'),
    },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/MatchesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/matches',
      name: 'matches',
      component: () => import('../views/MatchesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/matches/:id',
      name: 'match-detail',
      component: () => import('../views/MatchDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/matches',
      name: 'admin-matches',
      component: () => import('../views/AdminMatchesView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/teams',
      name: 'admin-teams',
      component: () => import('../views/AdminTeamsView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  if (to.name === 'login' && authStore.isAuthenticated()) {
    return { name: 'home' }
  }
  if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
    return { name: 'login' }
  }
  if (to.meta.requiresAdmin && !authStore.isAdmin()) {
    return { name: 'home' }
  }
})
