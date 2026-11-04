/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import Attendance from '../../src/components/Attendance.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const closed: StaffClockShift = {
  id: 's1',
  staff_name: 'Shai',
  clock_in_at: '2026-11-04T06:00:00.000Z',
  clock_out_at: '2026-11-04T16:00:00.000Z',
  clock_in_photo_path: 'Shai/s1-in.jpg',
  clock_out_photo_path: 'Shai/s1-out.jpg',
  clock_in_status: 'pending',
  clock_out_status: 'pending',
  clock_in_override: false,
  clock_out_override: false,
  ot_requested: true,
  ot_status: 'pending',
  ot_requested_at: '2026-11-04T16:00:00.000Z',
  created_by: 'staff',
  updated_by: null,
  created_at: '2026-11-04T06:00:00.000Z',
  updated_at: '2026-11-04T15:00:00.000Z'
}

const list = vi.fn(async () => [closed])
const setPunchStatus = vi.fn()
const setOtStatus = vi.fn()
const photoUrl = vi.fn((path: string) => `https://cdn.example/${path}`)

vi.mock('../../src/services/staffClockService', () => ({
  staffClockService: {
    list: (...args: unknown[]) => list(...args),
    setPunchStatus: (...args: unknown[]) => setPunchStatus(...args),
    setOtStatus: (...args: unknown[]) => setOtStatus(...args),
    updateTimes: vi.fn(),
    createMissedPunch: vi.fn(),
    remove: vi.fn(),
    photoUrl: (...args: unknown[]) => photoUrl(...(args as [string]))
  }
}))

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: '2', username: 'ana', roleId: 2 })
  }
}))

function mountPage() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(Attendance)
  app.mount(el)
  return { el, app }
}

describe('Attendance.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    list.mockClear()
    setPunchStatus.mockClear()
    setOtStatus.mockClear()
    setPunchStatus.mockResolvedValue(closed)
    setOtStatus.mockResolvedValue(closed)
    list.mockResolvedValue([closed])
  })

  it('lists punches with OT and photo links, not the staff clock buttons', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.textContent).toContain('Shai')
    expect(el.querySelector('[data-testid="ot-s1"]')?.textContent).toMatch(/2\.00h/)
    expect(el.querySelector('[data-testid="photo-in-s1"]')?.textContent).toMatch(/In photo/i)
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    app.unmount()
  })

  it('opens a centered photo modal from the link', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="photo-in-s1"]') as HTMLButtonElement).click()
    await nextTick()
    const modal = document.querySelector('[data-testid="clock-photo-modal"]')
    expect(modal).not.toBeNull()
    expect(modal?.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example/Shai/s1-in.jpg'
    )
    app.unmount()
  })

  it('approves and declines punches', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="approve-in-s1"]') as HTMLButtonElement).click()
    ;(el.querySelector('[data-testid="decline-out-s1"]') as HTMLButtonElement).click()
    ;(el.querySelector('[data-testid="approve-ot-s1"]') as HTMLButtonElement).click()
    await nextTick()
    expect(setPunchStatus).toHaveBeenCalledWith('s1', 'in', 'approved', 'ana')
    expect(setPunchStatus).toHaveBeenCalledWith('s1', 'out', 'declined', 'ana')
    expect(setOtStatus).toHaveBeenCalledWith('s1', 'approved', 'ana')
    app.unmount()
  })

  it('opens edit, delete, and add missed punch', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="edit-s1"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="delete-s1"]')).not.toBeNull()
    ;(el.querySelector('[data-testid="add-missed-btn"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-testid="clock-edit-modal"]')).not.toBeNull()
    app.unmount()
  })
})
