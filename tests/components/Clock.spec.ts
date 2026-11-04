/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import Clock from '../../src/components/Clock.vue'
import type { StaffClockShift } from '../../src/models/StaffClock'

const list = vi.fn(async (): Promise<StaffClockShift[]> => [])
const clockIn = vi.fn()
const clockOut = vi.fn()

vi.mock('../../src/services/staffClockService', () => ({
  staffClockService: {
    list: (...args: unknown[]) => list(...args),
    clockIn: (...args: unknown[]) => clockIn(...args),
    clockOut: (...args: unknown[]) => clockOut(...args)
  }
}))

vi.mock('../../src/services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: '3', username: 'staff', roleId: 1 })
  }
}))

function mountPage() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const app = createApp(Clock)
  app.mount(el)
  return { el, app }
}

describe('Clock.vue', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    list.mockReset()
    clockIn.mockReset()
    clockOut.mockReset()
    list.mockResolvedValue([])
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    })
  })

  it('lets staff pick Shai or Den and shows Clock in when not on the clock', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    const select = el.querySelector('[data-testid="clock-staff"]') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['Shai', 'Den'])
    expect(el.querySelector('[data-testid="clock-in-btn"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).toBeNull()
    expect(el.textContent).not.toMatch(/overtime/i)
    app.unmount()
  })

  it('shows only Clock out when that person is open', async () => {
    list.mockResolvedValue([
      {
        id: 's1',
        staff_name: 'Shai',
        clock_in_at: '2026-11-04T06:00:00.000Z',
        clock_out_at: null,
        clock_in_photo_path: 'p',
        clock_out_photo_path: null,
        clock_in_status: 'pending',
        clock_out_status: null,
        clock_in_override: false,
        clock_out_override: false,
        created_by: 'staff',
        updated_by: null,
        created_at: '2026-11-04T06:00:00.000Z',
        updated_at: '2026-11-04T06:00:00.000Z'
      }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-out-btn"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    expect(el.textContent).toMatch(/waiting for approval/i)
    app.unmount()
  })

  it('opens camera capture after Clock in, with capture on the right', async () => {
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    ;(el.querySelector('[data-testid="clock-in-btn"]') as HTMLButtonElement).click()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-capture-btn"]')?.textContent).toMatch(
      /Capture clock in/i
    )
    expect(el.querySelector('[data-testid="clock-camera"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).toBeNull()
    const layout = el.querySelector('[data-testid="clock-capture-layout"]') as HTMLElement
    expect(layout.className).toMatch(/capture-layout/)
    app.unmount()
  })

  it('lets them clock in again after a declined in', async () => {
    list.mockResolvedValue([
      {
        id: 's1',
        staff_name: 'Shai',
        clock_in_at: '2026-11-04T06:00:00.000Z',
        clock_out_at: null,
        clock_in_photo_path: 'p',
        clock_out_photo_path: null,
        clock_in_status: 'declined',
        clock_out_status: null,
        clock_in_override: false,
        clock_out_override: false,
        created_by: 'staff',
        updated_by: null,
        created_at: '2026-11-04T06:00:00.000Z',
        updated_at: '2026-11-04T06:00:00.000Z'
      }
    ])
    const { el, app } = mountPage()
    await nextTick()
    await nextTick()
    expect(el.querySelector('[data-testid="clock-in-btn"]')).not.toBeNull()
    expect(el.textContent).toMatch(/you can clock in again/i)
    app.unmount()
  })
})
