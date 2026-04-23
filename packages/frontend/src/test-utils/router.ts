import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router'

const Stub = { template: '<div />' }

/**
 * All app routes as stubs — silences "No match found" Vue Router warnings
 * when AppLayout renders <router-link> elements in tests.
 */
const APP_ROUTES: RouteRecordRaw[] = [
  { path: '/', component: Stub },
  { path: '/login', component: Stub },
  { path: '/auth/callback', component: Stub },
  { path: '/app/matches', component: Stub },
  { path: '/app/matches/:id', component: Stub },
  { path: '/app/my-tips', component: Stub },
  { path: '/app/groups', component: Stub },
  { path: '/app/groups/:id', component: Stub },
  { path: '/app/leaderboard', component: Stub },
  { path: '/app/profile', component: Stub },
  { path: '/app/join/:code', component: Stub },
  { path: '/admin/matches', component: Stub },
  { path: '/admin/teams', component: Stub },
  { path: '/admin/users', component: Stub },
  { path: '/admin/scoring', component: Stub },
  { path: '/admin/waitlist', component: Stub },
]

/**
 * Creates a test router with all app routes stubbed.
 * Pass `overrides` to replace specific paths with real components.
 *
 * @example
 *   buildTestRouter({ '/app/matches': MatchesView })
 */
export function buildTestRouter(
  overrides: Record<string, ReturnType<typeof import('vue')['defineComponent']>> = {},
): ReturnType<typeof createRouter> {
  const routes = APP_ROUTES.map((r) => {
    const override = overrides[r.path as string]
    return override ? { ...r, component: override } : r
  })
  return createRouter({ history: createMemoryHistory(), routes })
}
