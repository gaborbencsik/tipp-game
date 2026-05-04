import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DayNavigator from './DayNavigator.vue'

function mountNav(props: Partial<{
  dateLabel: string
  canGoPrev: boolean
  canGoNext: boolean
  isShowingAll: boolean
}> = {}) {
  return mount(DayNavigator, {
    props: {
      dateLabel: props.dateLabel ?? 'jún. 3., kedd',
      canGoPrev: props.canGoPrev ?? true,
      canGoNext: props.canGoNext ?? true,
      isShowingAll: props.isShowingAll ?? false,
    },
  })
}

describe('DayNavigator', () => {
  it('renders date label when not showing all', () => {
    const w = mountNav({ isShowingAll: false, dateLabel: 'máj. 10., szombat' })
    expect(w.find('[data-testid="day-nav-label"]').text()).toBe('máj. 10., szombat')
  })

  it('hides date label when showing all', () => {
    const w = mountNav({ isShowingAll: true })
    expect(w.find('[data-testid="day-nav-label"]').exists()).toBe(false)
  })

  it('emits prev on prev button click', async () => {
    const w = mountNav()
    await w.find('[data-testid="day-nav-prev"]').trigger('click')
    expect(w.emitted('prev')).toHaveLength(1)
  })

  it('emits next on next button click', async () => {
    const w = mountNav()
    await w.find('[data-testid="day-nav-next"]').trigger('click')
    expect(w.emitted('next')).toHaveLength(1)
  })

  it('emits showAll on Összes button click', async () => {
    const w = mountNav()
    await w.find('[data-testid="day-nav-all"]').trigger('click')
    expect(w.emitted('showAll')).toHaveLength(1)
  })

  it('prev button is disabled when canGoPrev is false', () => {
    const w = mountNav({ canGoPrev: false })
    expect(w.find('[data-testid="day-nav-prev"]').attributes('disabled')).toBeDefined()
  })

  it('next button is disabled when canGoNext is false', () => {
    const w = mountNav({ canGoNext: false })
    expect(w.find('[data-testid="day-nav-next"]').attributes('disabled')).toBeDefined()
  })

  it('does not emit prev when button is disabled', async () => {
    const w = mountNav({ canGoPrev: false })
    await w.find('[data-testid="day-nav-prev"]').trigger('click')
    expect(w.emitted('prev')).toBeUndefined()
  })

  it('does not emit next when button is disabled', async () => {
    const w = mountNav({ canGoNext: false })
    await w.find('[data-testid="day-nav-next"]').trigger('click')
    expect(w.emitted('next')).toBeUndefined()
  })

  it('Összes button has active styling when isShowingAll is true', () => {
    const w = mountNav({ isShowingAll: true })
    const btn = w.find('[data-testid="day-nav-all"]')
    expect(btn.classes()).toContain('bg-blue-600')
  })

  it('Összes button has inactive styling when isShowingAll is false', () => {
    const w = mountNav({ isShowingAll: false })
    const btn = w.find('[data-testid="day-nav-all"]')
    expect(btn.classes()).toContain('bg-gray-200')
  })

  it('shows checkmark icon when isShowingAll is true', () => {
    const w = mountNav({ isShowingAll: true })
    const btn = w.find('[data-testid="day-nav-all"]')
    const svg = btn.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.find('path').exists()).toBe(true)
  })

  it('shows empty checkbox icon when isShowingAll is false', () => {
    const w = mountNav({ isShowingAll: false })
    const btn = w.find('[data-testid="day-nav-all"]')
    const svg = btn.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.find('rect').exists()).toBe(true)
  })
})
