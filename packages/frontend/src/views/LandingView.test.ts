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

describe('LandingView – authentication CTAs', () => {
  it('both Login and Register links are present in the nav', async () => {
    const wrapper = await mountLanding()
    const loginLinks = wrapper.findAll('a[href="/login"]')
    expect(loginLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('hero section primary CTA points to /login', async () => {
    const wrapper = await mountLanding()
    const heroPrimary = wrapper.find('.lp-hero__primary')
    expect(heroPrimary.exists()).toBe(true)
    expect(heroPrimary.attributes('href')).toBe('/login')
  })

  it('footer CTA row contains primary and secondary links to /login', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-footer__primary').attributes('href')).toBe('/login')
    expect(wrapper.find('.lp-footer__secondary').attributes('href')).toBe('/login')
  })

  it('sticky CTA is always in the DOM (CSS hides it on desktop)', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-sticky-cta').exists()).toBe(true)
    expect(wrapper.find('.lp-sticky-cta__btn').attributes('href')).toBe('/login')
  })

  it('no email subscription form on the landing page', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('input[type="email"]').exists()).toBe(false)
  })
})

describe('LandingView – basic rendering', () => {
  it('landing page is rendered', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp').exists()).toBe(true)
  })

  it('nav logo text is shown', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('VB Tippjáték')
  })

  it('hero title is shown (tippverseny copy)', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('tippverseny')
  })

  it('all 6 feature cards are shown', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.findAll('.lp-feat-card')).toHaveLength(6)
  })

  it('favorite team × double points feature is present', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('Kedvenc csapat ×2')
  })

  it('special predictions feature is present', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.text()).toContain('Speciális tippek')
  })

  it('scoring values reflect the actual default (3/2/1/0)', async () => {
    const wrapper = await mountLanding()
    const ptsCells = wrapper.findAll('.lp-score-pts').map(el => el.text().trim())
    expect(ptsCells).toEqual(['3', '2', '1', '0'])
  })

  it('FAQ contains 6 items', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.findAll('.lp-faq__item')).toHaveLength(6)
  })

  it('community section CTA leads to /login', async () => {
    const wrapper = await mountLanding()
    expect(wrapper.find('.lp-community__cta').attributes('href')).toBe('/login')
  })
})
