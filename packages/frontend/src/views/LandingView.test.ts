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

function buildRouter() {
  const router = buildTestRouter({ '/': LandingView })
  return { router, path: '/' }
}

async function mountLanding() {
  const { router, path } = buildRouter()
  await router.push(path)
  await router.isReady()
  return mount(LandingView, { global: { plugins: [router] } })
}

describe('LandingView – authentikációs CTA-k', () => {
  it('a navban jelen van a Bejelentkezés és a Regisztráció link is', async () => {
    const wrapper = await mountLanding()
    const loginLinks = wrapper.findAll('a[href="/login"]')
    expect(loginLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('a hero szekció primary CTA-ja a /login-re mutat', async () => {
    const wrapper = await mountLanding()
    const heroPrimary = wrapper.find('.lp-hero__primary')
    expect(heroPrimary.exists()).toBe(true)
    expect(heroPrimary.attributes('href')).toBe('/login')
  })

  it('a footer CTA row tartalmaz primary és secondary linket /login-re', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-footer__primary').attributes('href')).toBe('/login')
    expect(wrapper.find('.lp-footer__secondary').attributes('href')).toBe('/login')
  })

  it('a sticky CTA mindig a DOM-ban van (mobilon CSS rejti desktopon)', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-sticky-cta').exists()).toBe(true)
    expect(wrapper.find('.lp-sticky-cta__btn').attributes('href')).toBe('/login')
  })

  it('nincs feliratkozási email űrlap a landing oldalon', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
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

  it('hero title megjelenik (tippverseny copy)', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('tippverseny')
  })

  it('a 6 funkció kártya mind megjelenik', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.findAll('.lp-feat-card')).toHaveLength(6)
  })

  it('a kedvenc csapat × dupla pont funkció szerepel', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('Kedvenc csapat ×2')
  })

  it('a speciális tippek funkció szerepel', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('Speciális tippek')
  })

  it('a pontrendszer értékei a tényleges defaultot tükrözik (3/2/1/0)', async () => {
    const wrapper = await mountLanding()
    const ptsCells = wrapper.findAll('.lp-score-pts').map(el => el.text().trim())
    expect(ptsCells).toEqual(['3', '2', '1', '0'])
  })

  it('a FAQ 6 elemet tartalmaz', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.findAll('.lp-faq__item')).toHaveLength(6)
  })

  it('a community szekció CTA-ja /login-re visz', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-community__cta').attributes('href')).toBe('/login')
  })
})
