/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import Employee from '../../src/components/Employee.vue'
import { authService } from '../../src/services/authService'

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn()
  }
}))

async function mountAt(path: string) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/employee',
        component: Employee,
        children: [
          { path: 'attendance', component: { template: '<p data-testid="attendance-slot">Punch list</p>' } },
          { path: 'staff', component: { template: '<p data-testid="staff-slot">Staff list</p>' } }
        ]
      }
    ]
  })
  const app = createApp({ template: '<router-view />' })
  app.use(router)
  app.mount(el)
  await router.push(path)
  await router.isReady()
  await nextTick()
  return { el, app }
}

describe('Employee.vue', () => {
  it('opens Attendance and Staff from the Employee section for admin', async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'admin',
      roleId: 0
    } as any)
    const { el, app } = await mountAt('/employee/attendance')
    expect(el.querySelector('h1')?.textContent).toContain('Employee')
    expect(el.querySelector('a[href="/employee/attendance"]')?.textContent).toContain('Attendance')
    expect(el.querySelector('a[href="/employee/staff"]')?.textContent).toContain('Staff')
    expect(el.querySelector('[data-testid="attendance-slot"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="staff-slot"]')).toBeNull()
    app.unmount()
  })

  it('shows Attendance only for an auditor', async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      id: '2',
      username: 'ana',
      roleId: 2
    } as any)
    const { el, app } = await mountAt('/employee/attendance')
    expect(el.querySelector('a[href="/employee/attendance"]')).not.toBeNull()
    expect(el.querySelector('a[href="/employee/staff"]')).toBeNull()
    expect(el.textContent).not.toContain('staff list')
    app.unmount()
  })

  it('shows the staff page when Staff is opened', async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue({
      id: '1',
      username: 'admin',
      roleId: 0
    } as any)
    const { el, app } = await mountAt('/employee/staff')
    expect(el.querySelector('[data-testid="staff-slot"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="attendance-slot"]')).toBeNull()
    app.unmount()
  })
})
