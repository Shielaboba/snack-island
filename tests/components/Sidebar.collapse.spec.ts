/** @vitest-environment happy-dom */
import { describe, it, expect, vi } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import Sidebar from '../../src/components/Sidebar.vue'

vi.mock('../../src/assets/logo.png', () => ({ default: 'logo.png' }))

describe('Sidebar collapse toggle', () => {
  it('toggles collapsed class when clicking the menu button', async () => {
    const container = document.createElement('div')
    const app = createApp(Sidebar)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    app.use(router)
    app.mount(container)

    const sidebar = container.querySelector('.sidebar') as HTMLElement
    const btn = container.querySelector('.menu-toggle') as HTMLButtonElement

    expect(sidebar.classList.contains('collapsed')).toBe(false)

    btn.click()
    await Promise.resolve()
    expect(sidebar.classList.contains('collapsed')).toBe(true)

    btn.click()
    await Promise.resolve()
    expect(sidebar.classList.contains('collapsed')).toBe(false)

    app.unmount()
  })
})


