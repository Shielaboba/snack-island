/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import Sidebar from '../../src/components/Sidebar.vue'
import { authService } from '../../src/services/authService'

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    signOut: vi.fn()
  }
}))

vi.mock('../../src/assets/logo.png', () => ({ default: 'logo.png' }))

function mountSidebar() {
  const el = document.createElement('div')
  const app = createApp(Sidebar)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
  app.use(router)
  app.mount(el)
  return { el, app }
}

describe('Sidebar.vue ledger link', () => {
  beforeEach(() => {
    vi.mocked(authService.getCurrentUser).mockReset()
  })

  it('shows Ledger for admin', () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'admin',
      roleId: 0
    } as any)
    const { el, app } = mountSidebar()
    const link = el.querySelector('a[href="/ledger"]')
    expect(link).not.toBeNull()
    expect(link?.textContent).toContain('Ledger')
    app.unmount()
  })

  it('shows Ledger for auditor', () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      id: '2',
      username: 'ana',
      roleId: 2
    } as any)
    const { el, app } = mountSidebar()
    expect(el.querySelector('a[href="/ledger"]')).not.toBeNull()
    app.unmount()
  })

  it('hides Ledger for staff', () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      id: '3',
      username: 'staff',
      roleId: 1
    } as any)
    const { el, app } = mountSidebar()
    expect(el.querySelector('a[href="/ledger"]')).toBeNull()
    app.unmount()
  })
})
