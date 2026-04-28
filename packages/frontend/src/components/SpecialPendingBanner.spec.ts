import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import SpecialPendingBanner from './SpecialPendingBanner.vue'
import type { PendingGroupSummary } from '../composables/usePendingSpecialTips.js'

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime()
const FUTURE = '2026-06-20T18:00:00.000Z'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/app/groups/:id', component: { template: '<div />' } },
    ],
  })
}

function makeGroup(id: string, name: string, pendingCount: number): PendingGroupSummary {
  return { groupId: id, groupName: name, pendingCount, nearestDeadline: FUTURE }
}

describe('SpecialPendingBanner', () => {
  let router: ReturnType<typeof makeRouter>

  beforeEach(async () => {
    router = makeRouter()
    router.push('/')
    await router.isReady()
  })

  it('renders banner with total pending count', () => {
    const wrapper = mount(SpecialPendingBanner, {
      props: { pendingGroups: [makeGroup('g1', 'A', 3)], totalPendingCount: 3, now: NOW },
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('3 speciális tipp vár rád')
  })

  it('shows nearest deadline info', () => {
    const wrapper = mount(SpecialPendingBanner, {
      props: { pendingGroups: [makeGroup('g1', 'A', 1)], totalPendingCount: 1, now: NOW },
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('Legközelebbi határidő:')
  })

  it('navigates on click when single group', async () => {
    const pushSpy = vi.spyOn(router, 'push')
    const wrapper = mount(SpecialPendingBanner, {
      props: { pendingGroups: [makeGroup('g1', 'A', 2)], totalPendingCount: 2, now: NOW },
      global: { plugins: [router] },
    })

    await wrapper.find('[data-testid="special-pending-banner"]').trigger('click')

    expect(pushSpy).toHaveBeenCalledWith({ path: '/app/groups/g1', query: { tab: 'special' } })
  })

  it('shows chevron for single group', () => {
    const wrapper = mount(SpecialPendingBanner, {
      props: { pendingGroups: [makeGroup('g1', 'A', 1)], totalPendingCount: 1, now: NOW },
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('›')
  })

  it('shows toggle link for multiple groups', () => {
    const wrapper = mount(SpecialPendingBanner, {
      props: {
        pendingGroups: [makeGroup('g1', 'A', 1), makeGroup('g2', 'B', 2)],
        totalPendingCount: 3,
        now: NOW,
      },
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('Csoportok')
    expect(wrapper.text()).not.toContain('›')
  })

  it('expands group list on banner click with multiple groups', async () => {
    const wrapper = mount(SpecialPendingBanner, {
      props: {
        pendingGroups: [makeGroup('g1', 'A', 1), makeGroup('g2', 'B', 2)],
        totalPendingCount: 3,
        now: NOW,
      },
      global: { plugins: [router] },
    })

    await wrapper.find('[data-testid="special-pending-banner"]').trigger('click')

    expect(wrapper.text()).toContain('A · 1 tipp')
    expect(wrapper.text()).toContain('B · 2 tipp')
    expect(wrapper.text()).toContain('Bezárás')
  })
})
