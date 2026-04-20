import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.store.js'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('../views/LandingView.vue'),
    },
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
      path: '/app/matches',
      name: 'home',
      component: () => import('../views/MatchesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/app/groups',
      name: 'groups',
      component: () => import('../views/GroupsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/app/groups/:id',
      name: 'group-detail',
      component: () => import('../views/GroupDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/app/matches/:id',
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
    {
      path: '/admin/users',
      name: 'admin-users',
      component: () => import('../views/AdminUsersView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/admin/scoring',
      name: 'admin-scoring',
      component: () => import('../views/AdminScoringView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/app/my-tips',
      name: 'my-tips',
      component: () => import('../views/MyTipsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/app/leaderboard',
      name: 'leaderboard',
      component: () => import('../views/LeaderboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/app/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/app/join/:code',
      name: 'join',
      component: () => import('../views/JoinView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/join/:code',
      redirect: (to) => ({ path: `/app/join/${to.params.code}` }),
    },
    {
      path: '/matches/:id',
      redirect: (to) => ({ path: `/app/matches/${to.params.id}` }),
    },
    {
      path: '/groups/:id',
      redirect: (to) => ({ path: `/app/groups/${to.params.id}` }),
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (!authStore.ready) {
    await authStore.restoreSession()
  }
  if (to.name === 'login' && authStore.isAuthenticated()) {
    return { name: 'home' }
  }
  if (to.meta.requiresAuth && !authStore.isAuthenticated()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.requiresAdmin && !authStore.isAdmin()) {
    return { name: 'home' }
  }
})
