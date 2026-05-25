import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminNav from './AdminNav.vue'
import { buildTestRouter } from '@/test-utils/router'

const ADMIN_ROUTES: ReadonlyArray<{ readonly to: string; readonly label: string }> = [
  { to: '/admin/stats', label: 'Statisztikák' },
  { to: '/admin/matches', label: 'Mérkőzések' },
  { to: '/admin/teams', label: 'Csapatok' },
  { to: '/admin/players', label: 'Játékosok' },
  { to: '/admin/users', label: 'Felhasználók' },
  { to: '/admin/scoring', label: 'Pontrendszer' },
  { to: '/admin/waitlist', label: 'Waitlist' },
  { to: '/admin/global-types', label: 'Speciális tippek' },
  { to: '/admin/sync', label: 'Szinkron' },
]

async function mountNav(): Promise<ReturnType<typeof mount>> {
  const router = buildTestRouter()
  await router.push('/admin/stats')
  await router.isReady()
  return mount(AdminNav, { global: { plugins: [router] } })
}

describe('AdminNav', () => {
  it('renders all 9 admin links with correct labels and targets', async () => {
    const wrapper = await mountNav()
    const links = wrapper.findAll('a')
    expect(links.length).toBe(ADMIN_ROUTES.length)
    for (const [i, route] of ADMIN_ROUTES.entries()) {
      expect(links[i].text()).toBe(route.label)
      expect(links[i].attributes('href')).toBe(route.to)
    }
  })

  it('uses flex-wrap layout so links wrap on narrow viewports', async () => {
    const wrapper = await mountNav()
    const nav = wrapper.find('nav')
    expect(nav.exists()).toBe(true)
    expect(nav.classes()).toContain('flex')
    expect(nav.classes()).toContain('flex-wrap')
  })

  it('has accessible label for the navigation landmark', async () => {
    const wrapper = await mountNav()
    const nav = wrapper.find('nav')
    expect(nav.attributes('aria-label')).toBeTruthy()
  })
})
