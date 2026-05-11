import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VenueBanner from '@/components/VenueBanner.vue'

describe('VenueBanner', () => {
  it('does not render when venue is null', () => {
    const wrapper = mount(VenueBanner, { props: { venue: null } })
    expect(wrapper.find('[data-testid="venue-banner"]').exists()).toBe(false)
  })

  it('renders with fallback gradient when imageUrl is null', () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'MetLife Stadium', city: 'East Rutherford', imageUrl: null } },
    })
    expect(wrapper.find('[data-testid="venue-banner"]').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="venue-name"]').text()).toBe('MetLife Stadium')
    expect(wrapper.find('[data-testid="venue-city"]').text()).toBe('East Rutherford')
  })

  it('renders img element when imageUrl is provided', () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'SoFi Stadium', city: 'Inglewood', imageUrl: '/venues/sofi-stadium.jpg' } },
    })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/venues/sofi-stadium.jpg')
    expect(img.attributes('alt')).toBe('SoFi Stadium, Inglewood')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
  })

  it('displays venue name and city text', () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'BC Place', city: 'Vancouver', imageUrl: '/venues/bc-place.jpg' } },
    })
    expect(wrapper.find('[data-testid="venue-name"]').text()).toBe('BC Place')
    expect(wrapper.find('[data-testid="venue-city"]').text()).toBe('Vancouver')
  })

  it('hides image and shows fallback on image error', async () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'Test', city: 'City', imageUrl: '/venues/broken.jpg' } },
    })
    expect(wrapper.find('img').exists()).toBe(true)
    await wrapper.find('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('applies fade-in class on image load', async () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'Test', city: 'City', imageUrl: '/venues/test.jpg' } },
    })
    const img = wrapper.find('img')
    expect(img.classes()).toContain('opacity-0')
    await img.trigger('load')
    expect(img.classes()).toContain('opacity-100')
  })

  it('has correct aria-label for accessibility', () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'Estadio Azteca', city: 'Mexico City', imageUrl: null } },
    })
    const banner = wrapper.find('[data-testid="venue-banner"]')
    expect(banner.attributes('role')).toBe('img')
    expect(banner.attributes('aria-label')).toBe('Estadio Azteca, Mexico City')
  })

  it('expand icon is visible when venue exists', () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'MetLife Stadium', city: 'East Rutherford', imageUrl: '/venues/metlife.webp' } },
    })
    const icon = wrapper.find('[data-testid="expand-icon"]')
    expect(icon.exists()).toBe(true)
  })

  it('expand icon is not rendered when venue is null', () => {
    const wrapper = mount(VenueBanner, { props: { venue: null } })
    expect(wrapper.find('[data-testid="expand-icon"]').exists()).toBe(false)
  })

  it('clicking banner opens lightbox', async () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'SoFi Stadium', city: 'Inglewood', imageUrl: '/venues/sofi.webp' } },
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.find('[data-testid="venue-lightbox"]').exists()).toBe(false)
    await wrapper.find('[data-testid="venue-banner"]').trigger('click')
    expect(wrapper.find('[data-testid="venue-lightbox"]').exists()).toBe(true)
  })

  it('clicking lightbox backdrop closes it', async () => {
    const wrapper = mount(VenueBanner, {
      props: { venue: { name: 'SoFi Stadium', city: 'Inglewood', imageUrl: '/venues/sofi.webp' } },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.find('[data-testid="venue-banner"]').trigger('click')
    expect(wrapper.find('[data-testid="venue-lightbox"]').exists()).toBe(true)
    await wrapper.find('[data-testid="venue-lightbox"]').trigger('click')
    expect(wrapper.find('[data-testid="venue-lightbox"]').exists()).toBe(false)
  })
})
