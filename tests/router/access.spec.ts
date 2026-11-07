/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: vi.fn()
  }
}))

import router from '../../src/router'
import { authService } from '../../src/services/authService'

function signIn(roleId: number) {
  vi.mocked(authService.getCurrentUser).mockReturnValue({
    id: '1',
    username: 'user',
    roleId
  } as any)
}

async function visit(roleId: number, path: string) {
  vi.mocked(authService.getCurrentUser).mockReturnValue(null)
  await router.push('/login')
  signIn(roleId)
  await router.push(path)
}

describe('attendance, staff, and clock access', () => {
  beforeEach(async () => {
    vi.mocked(authService.getCurrentUser).mockReturnValue(null)
    await router.push('/login')
  })

  it('lets admin and auditor open attendance, and sends staff away', async () => {
    await visit(0, '/employee/attendance')
    expect(router.currentRoute.value.path).toBe('/employee/attendance')

    await visit(2, '/employee/attendance')
    expect(router.currentRoute.value.path).toBe('/employee/attendance')

    await visit(1, '/employee/attendance')
    expect(router.currentRoute.value.path).toBe('/order')
  })

  it('lets only admin open staff', async () => {
    await visit(0, '/employee/staff')
    expect(router.currentRoute.value.path).toBe('/employee/staff')

    await visit(2, '/employee/staff')
    expect(router.currentRoute.value.path).toBe('/audit')

    await visit(1, '/employee/staff')
    expect(router.currentRoute.value.path).toBe('/order')
  })

  it('lets only staff open clock', async () => {
    await visit(1, '/clock')
    expect(router.currentRoute.value.path).toBe('/clock')

    await visit(0, '/clock')
    expect(router.currentRoute.value.path).toBe('/dashboard')

    await visit(2, '/clock')
    expect(router.currentRoute.value.path).toBe('/audit')
  })
})
