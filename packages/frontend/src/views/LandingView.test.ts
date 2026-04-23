import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LandingView from '@/views/LandingView.vue'
import { buildTestRouter } from '@/test-utils/router'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}))

vi.mock('@/api/index', () => ({
  api: {
    health: vi.fn(),
    auth: { me: vi.fn() },
  },
}))

function buildRouter(query = '') {
  const router = buildTestRouter({ '/': LandingView })
  return { router, path: query ? `/?${query}` : '/' }
}

async function mountLanding(query = '') {
  const { router, path } = buildRouter(query)
  await router.push(path)
  await router.isReady()
  return mount(LandingView, { global: { plugins: [router] } })
}

describe('LandingView – bejelentkezés gomb láthatósága', () => {
  it('alapértelmezetten a bejelentkezés gomb nem jelenik meg a navban', async () => {
    const wrapper = await mountLanding()
    const loginLinks = wrapper.findAll('a[href="/login"]')
    expect(loginLinks).toHaveLength(0)
  })

  it('force_enable_login=true esetén a nav CTA megjelenik', async () => {
    const wrapper = await mountLanding('force_enable_login=true')
    const loginLinks = wrapper.findAll('a[href="/login"]')
    expect(loginLinks.length).toBeGreaterThan(0)
  })

  it('force_enable_login=false esetén a bejelentkezés gomb nem jelenik meg', async () => {
    const wrapper = await mountLanding('force_enable_login=false')
    const loginLinks = wrapper.findAll('a[href="/login"]')
    expect(loginLinks).toHaveLength(0)
  })

  it('tetszőleges egyéb query paraméter nem kapcsolja be a gombot', async () => {
    const wrapper = await mountLanding('utm_source=google')
    const loginLinks = wrapper.findAll('a[href="/login"]')
    expect(loginLinks).toHaveLength(0)
  })

  it('force_enable_login=true esetén a sticky CTA is megjelenik a DOM-ban', async () => {
    const wrapper = await mountLanding('force_enable_login=true')
    expect(wrapper.find('.lp-sticky-cta').exists()).toBe(true)
  })

  it('force_enable_login nélkül a sticky CTA nem jelenik meg a DOM-ban', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-sticky-cta').exists()).toBe(false)
  })
})

describe('LandingView – alap renderelés', () => {
  it('a landing oldal megjelenik', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp').exists()).toBe(true)
  })

  it('nav logo szövege megjelenik', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('VB Tippjáték')
  })

  it('hero title megjelenik', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('Tippelj')
  })

  it('feliratkozási form megjelenik alapból', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
  })
})
